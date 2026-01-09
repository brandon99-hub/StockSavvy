import requests
import hashlib
import json
import logging
from django.utils import timezone
from api.models import Product, Category

logger = logging.getLogger(__name__)

class BCSyncService:
    API_URL = "http://4.246.219.109:5000/items/details"
    API_KEY = "t3RNW0W0BRxIEMRJrcHcMUWOl9p5ZkMZ+0xEDM3mtfNEEcm9pG+L/7/AVsZjmXHG"

    @classmethod
    def calculate_hash(cls, item_data):
        """Calculate a stable hash for the item data to detect changes."""
        # Focus on fields that affect the data we care about
        relevant_data = {
            "name": item_data.get("displayName"),
            "buy_price": float(item_data.get("unitCost", 0)),
            "sell_price": float(item_data.get("unitPrice", 0)),
            "barcode": item_data.get("barcode"),
            "uom": item_data.get("uomDefinition")
        }
        data_str = json.dumps(relevant_data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()

    @classmethod
    def sync_all(cls):
        """Fetch all items from BC and sync to local database."""
        headers = {"x-api-key": cls.API_KEY}
        try:
            response = requests.get(cls.API_URL, headers=headers, timeout=30)
            response.raise_for_status()
            items = response.json()
        except Exception as e:
            logger.error(f"Failed to fetch data from BC API: {str(e)}")
            return {"error": str(e), "synced": 0}

        synced_count = 0
        updated_count = 0
        created_count = 0
        skipped_count = 0

        total_items = len(items)
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()

        for index, item in enumerate(items):
            bc_id = item.get("number")
            if not bc_id:
                continue

            item_hash = cls.calculate_hash(item)
            
            # Find existing product by BC ID or Barcode
            product = Product.objects.filter(bc_item_no=bc_id).first()
            if not product and item.get("barcode"):
                product = Product.objects.filter(barcode=item.get("barcode")).first()

            # Parse UOM Data
            uom_def = item.get('uomDefinition', [])
            pcs_data = next((u for u in uom_def if u['code'] == 'PCS'), None)
            ctn_data = next((u for u in uom_def if u['code'] == 'CTN' or u['code'] == 'CARTON'), None)
            
            pcs_buy = float(pcs_data['unitCost'] if pcs_data else item.get("unitCost", 0))
            pcs_sell = float(pcs_data['unitPrice'] if pcs_data else item.get("unitPrice", 0))
            
            ctn_buy = float(ctn_data['unitCost']) if ctn_data and ctn_data.get('unitCost') else None
            ctn_sell = float(ctn_data['unitPrice']) if ctn_data and ctn_data.get('unitPrice') else None
            pack_size = int(ctn_data['packSize']) if ctn_data and ctn_data.get('packSize') else 1

            if not product:
                # Create new product
                try:
                    sku = bc_id
                    if Product.objects.filter(sku=sku).exists():
                        sku = f"{bc_id}-BC"
                    
                    Product.objects.create(
                        name=item.get("displayName", "Unnamed BC Item"),
                        sku=sku,
                        bc_item_no=bc_id,
                        barcode=item.get("barcode"),
                        buy_price=pcs_buy,
                        sell_price=pcs_sell,
                        carton_buy_price=ctn_buy,
                        carton_sell_price=ctn_sell,
                        pieces_per_carton=pack_size,
                        uom_data=uom_def,
                        sync_hash=item_hash,
                        min_stock_level=0,
                        created_at=timezone.now(),
                        updated_at=timezone.now(),
                    )
                    created_count += 1
                except Exception as e:
                    logger.error(f"Error creating product {bc_id}: {str(e)}")
                    continue
            else:
                # Update existing product if hash changed and no manual override
                if product.is_manual_override:
                    skipped_count += 1
                elif product.sync_hash != item_hash:
                    try:
                        product.name = item.get("displayName", product.name)
                        product.buy_price = pcs_buy
                        product.sell_price = pcs_sell
                        product.carton_buy_price = ctn_buy
                        product.carton_sell_price = ctn_sell
                        product.pieces_per_carton = pack_size
                        product.uom_data = uom_def
                        product.barcode = item.get("barcode", product.barcode)
                        product.bc_item_no = bc_id
                        product.sync_hash = item_hash
                        product.updated_at = timezone.now()
                        product.save()
                        updated_count += 1
                    except Exception as e:
                        logger.error(f"Error updating product {bc_id}: {str(e)}")
                        continue
                else:
                    skipped_count += 1

            # Send progress update via WebSocket
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    "sync_progress",
                    {
                        "type": "sync_update",
                        "data": {
                            "current": index + 1,
                            "total": total_items,
                            "percentage": round((index + 1) / total_items * 100, 1),
                            "status": "syncing",
                            "last_product": item.get("displayName", "")
                        }
                    }
                )

        # Send completion signal
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "sync_progress",
                {
                    "type": "sync_update",
                    "data": {"status": "complete"}
                }
            )

        return {
            "total_items": total_items,
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count
        }

    @classmethod
    def sync_by_barcode(cls, barcode):
        """Fetch a single item from BC by barcode and sync to local database."""
        # Note: The BC API provided (http://4.246.219.109:5000/items/details) returns all items.
        # Ideally, we would have a filter by barcode, but since we don't, we search in the full list.
        # This is okay for single scans as long as the list size (3000) is manageable.
        headers = {"x-api-key": cls.API_KEY}
        try:
            response = requests.get(cls.API_URL, headers=headers, timeout=30)
            response.raise_for_status()
            items = response.json()
        except Exception as e:
            logger.error(f"Failed to fetch data from BC API: {str(e)}")
            return None

        item = next((i for i in items if i.get("barcode") == barcode), None)
        if not item:
            return None

        bc_id = item.get("number")
        item_hash = cls.calculate_hash(item)
        
        product = Product.objects.filter(bc_item_no=bc_id).first()
        if not product:
            product = Product.objects.filter(barcode=barcode).first()

        # Parse UOM Data
        uom_def = item.get('uomDefinition', [])
        pcs_data = next((u for u in uom_def if u['code'] == 'PCS'), None)
        ctn_data = next((u for u in uom_def if u['code'] == 'CTN' or u['code'] == 'CARTON'), None)
        
        pcs_buy = float(pcs_data['unitCost'] if pcs_data else item.get("unitCost", 0))
        pcs_sell = float(pcs_data['unitPrice'] if pcs_data else item.get("unitPrice", 0))
        
        ctn_buy = float(ctn_data['unitCost']) if ctn_data and ctn_data.get('unitCost') else None
        ctn_sell = float(ctn_data['unitPrice']) if ctn_data and ctn_data.get('unitPrice') else None
        pack_size = int(ctn_data['packSize']) if ctn_data and ctn_data.get('packSize') else 1

        if not product:
            try:
                sku = bc_id
                if Product.objects.filter(sku=sku).exists():
                    sku = f"{bc_id}-BC"
                
                product = Product.objects.create(
                    name=item.get("displayName", "Unnamed BC Item"),
                    sku=sku,
                    bc_item_no=bc_id,
                    barcode=barcode,
                    buy_price=pcs_buy,
                    sell_price=pcs_sell,
                    carton_buy_price=ctn_buy,
                    carton_sell_price=ctn_sell,
                    pieces_per_carton=pack_size,
                    uom_data=uom_def,
                    sync_hash=item_hash,
                    min_stock_level=0,
                    created_at=timezone.now(),
                    updated_at=timezone.now(),
                )
            except Exception as e:
                logger.error(f"Error creating product {bc_id}: {str(e)}")
                return None
        else:
            if not product.is_manual_override and product.sync_hash != item_hash:
                product.name = item.get("displayName", product.name)
                product.buy_price = pcs_buy
                product.sell_price = pcs_sell
                product.carton_buy_price = ctn_buy
                product.carton_sell_price = ctn_sell
                product.pieces_per_carton = pack_size
                product.uom_data = uom_def
                product.barcode = item.get("barcode", product.barcode)
                product.bc_item_no = bc_id
                product.sync_hash = item_hash
                product.updated_at = timezone.now()
                product.save()

        return product
