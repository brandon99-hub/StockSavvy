import psycopg2

# Database connection parameters
db_params = {
    'dbname': 'postgres',
    'user': 'postgres.tmfdwxfdtwjbulrwqmus',
    'password': 'Exlifes_6969',
    'host': 'aws-0-eu-west-2.pooler.supabase.com',
    'port': '6543'
}

# Connect to the database
conn = psycopg2.connect(**db_params)
cur = conn.cursor()

# SQL commands to create tables
sql_commands = [
    """
    CREATE TABLE IF NOT EXISTS product_batches (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        batch_number VARCHAR(50) NOT NULL,
        purchase_price DECIMAL(10,2) NOT NULL,
        quantity INTEGER NOT NULL,
        remaining_quantity INTEGER NOT NULL,
        purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS batch_sale_items (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER NOT NULL REFERENCES product_batches(id) ON DELETE CASCADE,
        sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_product_batches_product_id ON product_batches(product_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_batch_sale_items_batch_id ON batch_sale_items(batch_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_batch_sale_items_sale_item_id ON batch_sale_items(sale_item_id)
    """
]

# Execute each SQL command
for command in sql_commands:
    try:
        cur.execute(command)
        print(f"Successfully executed: {command[:50]}...")
    except Exception as e:
        print(f"Error executing command: {str(e)}")

# Commit the changes
conn.commit()

# Close the cursor and connection
cur.close()
conn.close()

print("Batch tables creation completed.") 