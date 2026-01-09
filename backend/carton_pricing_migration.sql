-- Add carton pricing fields to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS carton_buy_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS carton_sell_price DECIMAL(10, 2);

-- Add comments
COMMENT ON COLUMN products.carton_buy_price IS 'Unit cost per carton (from BC uomDefinition)';
COMMENT ON COLUMN products.carton_sell_price IS 'Unit price per carton (from BC uomDefinition)';
