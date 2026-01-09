from channels.generic.websocket import AsyncJsonWebsocketConsumer
import logging

logger = logging.getLogger(__name__)

class SyncProgressConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("sync_progress", self.channel_name)
        await self.accept()
        logger.info("SyncProgressConsumer connected")
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("sync_progress", self.channel_name)
        logger.info(f"SyncProgressConsumer disconnected with code {close_code}")
    
    async def sync_update(self, event):
        """Receive message from group and send to WebSocket."""
        await self.send_json(event['data'])
