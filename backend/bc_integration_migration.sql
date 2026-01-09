-- Add BC Integration and UOM support fields to the products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS uom_data jsonb NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sync_hash varchar(64) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_manual_override boolean DEFAULT FALSE NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS uom_type varchar(20) DEFAULT 'PCS';
ALTER TABLE products ADD COLUMN IF NOT EXISTS pieces_per_carton integer DEFAULT 1;

-- Add master_quantity column
ALTER TABLE products ADD COLUMN IF NOT EXISTS master_quantity INTEGER DEFAULT 0;

-- Fix price constraints to allow zero (for BC products)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_buy_price_check;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sell_price_check;
ALTER TABLE products ADD CONSTRAINT products_buy_price_check CHECK (buy_price >= 0);
ALTER TABLE products ADD CONSTRAINT products_sell_price_check CHECK (sell_price >= 0);

-- Initialize master_quantity for existing products (sum of shop quantities)
UPDATE products p
SET master_quantity = COALESCE((
    SELECT SUM(quantity) 
    FROM shop_inventory si 
    WHERE si.product_id = p.id
), 0)
WHERE master_quantity = 0;

-- Fix SKU Sequence: Convert column type and set to highest existing SKU + 1
DO $$
DECLARE
    highest_sku INTEGER;
    next_sku_value TEXT;
    column_type TEXT;
BEGIN
    -- Check if sku_sequence table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sku_sequence') THEN
        -- Check current column type
        SELECT data_type INTO column_type
        FROM information_schema.columns 
        WHERE table_name = 'sku_sequence' AND column_name = 'next_sku';
        
        -- Convert to TEXT if it's INTEGER
        IF column_type = 'integer' THEN
            ALTER TABLE sku_sequence ALTER COLUMN next_sku TYPE TEXT;
            RAISE NOTICE 'Converted sku_sequence.next_sku from INTEGER to TEXT';
        END IF;
        
        -- Add pattern column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'sku_sequence' AND column_name = 'pattern') THEN
            ALTER TABLE sku_sequence ADD COLUMN pattern TEXT NULL;
            RAISE NOTICE 'Added pattern column to sku_sequence';
        END IF;
    ELSE
        -- Create table if it doesn't exist
        CREATE TABLE sku_sequence (
            next_sku TEXT NOT NULL,
            pattern TEXT NULL
        );
        RAISE NOTICE 'Created sku_sequence table';
    END IF;
    
    -- Find highest numeric SKU in products table
    SELECT COALESCE(MAX(CAST(sku AS INTEGER)), 139)
    INTO highest_sku
    FROM products 
    WHERE sku ~ '^[0-9]+$';
    
    -- Set next SKU to highest + 1
    next_sku_value := (highest_sku + 1)::TEXT;
    
    -- Update or insert the next_sku value
    IF EXISTS (SELECT 1 FROM sku_sequence) THEN
        UPDATE sku_sequence SET next_sku = next_sku_value;
        RAISE NOTICE 'Updated sku_sequence.next_sku to: %', next_sku_value;
    ELSE
        INSERT INTO sku_sequence (next_sku, pattern) VALUES (next_sku_value, NULL);
        RAISE NOTICE 'Inserted sku_sequence.next_sku as: %', next_sku_value;
    END IF;
END $$;
