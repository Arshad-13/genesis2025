#!/usr/bin/env python3
"""
Simple data loader for l2_orderbook table
"""

import pandas as pd
import asyncpg
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def load_data():
    # Get config from environment
    config = {
        'host': os.getenv('DB_HOST', '127.0.0.1'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'trading_hub'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', '123')
    }
    
    print(f"Connecting to database: {config}")
    
    try:
        conn = await asyncpg.connect(
            host=config['host'],
            port=config['port'],
            database=config['database'],
            user=config['user'],
            password=config['password']
        )
        
        print("✅ Connected to database")
        
        # Drop table if exists (for clean start)
        await conn.execute("DROP TABLE IF EXISTS l2_orderbook")
        print("🗑️ Dropped existing table (if any)")
        
        # Create table with simpler structure
        create_table_sql = """
        CREATE TABLE l2_orderbook (
            ts TIMESTAMP WITH TIME ZONE NOT NULL,
            bid_price_1 DECIMAL,
            bid_volume_1 DECIMAL,
            bid_price_2 DECIMAL,
            bid_volume_2 DECIMAL,
            bid_price_3 DECIMAL,
            bid_volume_3 DECIMAL,
            bid_price_4 DECIMAL,
            bid_volume_4 DECIMAL,
            bid_price_5 DECIMAL,
            bid_volume_5 DECIMAL,
            bid_price_6 DECIMAL,
            bid_volume_6 DECIMAL,
            bid_price_7 DECIMAL,
            bid_volume_7 DECIMAL,
            bid_price_8 DECIMAL,
            bid_volume_8 DECIMAL,
            bid_price_9 DECIMAL,
            bid_volume_9 DECIMAL,
            bid_price_10 DECIMAL,
            bid_volume_10 DECIMAL,
            ask_price_1 DECIMAL,
            ask_volume_1 DECIMAL,
            ask_price_2 DECIMAL,
            ask_volume_2 DECIMAL,
            ask_price_3 DECIMAL,
            ask_volume_3 DECIMAL,
            ask_price_4 DECIMAL,
            ask_volume_4 DECIMAL,
            ask_price_5 DECIMAL,
            ask_volume_5 DECIMAL,
            ask_price_6 DECIMAL,
            ask_volume_6 DECIMAL,
            ask_price_7 DECIMAL,
            ask_volume_7 DECIMAL,
            ask_price_8 DECIMAL,
            ask_volume_8 DECIMAL,
            ask_price_9 DECIMAL,
            ask_volume_9 DECIMAL,
            ask_price_10 DECIMAL,
            ask_volume_10 DECIMAL
        );
        """
        
        await conn.execute(create_table_sql)
        print("✅ Created l2_orderbook table")
        
        # Create index on timestamp
        await conn.execute("CREATE INDEX idx_l2_orderbook_ts ON l2_orderbook (ts DESC)")
        print("✅ Created timestamp index")
        
        # Load CSV data (just first 1000 rows for testing)
        csv_path = os.path.join(os.path.dirname(__file__), "dataset", "l2_clean.csv")
        print(f"📖 Reading CSV from {csv_path}...")
        
        df = pd.read_csv(csv_path, nrows=1000)
        print(f"📊 Loaded {len(df)} rows from CSV")
        
        # Convert timestamp to proper format
        df['ts'] = pd.to_datetime(df['ts'])
        
        # Insert data row by row (simpler approach)
        inserted = 0
        for _, row in df.iterrows():
            try:
                await conn.execute("""
                    INSERT INTO l2_orderbook (
                        ts, 
                        bid_price_1, bid_volume_1, bid_price_2, bid_volume_2, bid_price_3, bid_volume_3,
                        bid_price_4, bid_volume_4, bid_price_5, bid_volume_5, bid_price_6, bid_volume_6,
                        bid_price_7, bid_volume_7, bid_price_8, bid_volume_8, bid_price_9, bid_volume_9,
                        bid_price_10, bid_volume_10,
                        ask_price_1, ask_volume_1, ask_price_2, ask_volume_2, ask_price_3, ask_volume_3,
                        ask_price_4, ask_volume_4, ask_price_5, ask_volume_5, ask_price_6, ask_volume_6,
                        ask_price_7, ask_volume_7, ask_price_8, ask_volume_8, ask_price_9, ask_volume_9,
                        ask_price_10, ask_volume_10
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
                        $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41
                    )
                """, 
                row['ts'], 
                row['bid_price_1'], row['bid_volume_1'], row['bid_price_2'], row['bid_volume_2'],
                row['bid_price_3'], row['bid_volume_3'], row['bid_price_4'], row['bid_volume_4'],
                row['bid_price_5'], row['bid_volume_5'], row['bid_price_6'], row['bid_volume_6'],
                row['bid_price_7'], row['bid_volume_7'], row['bid_price_8'], row['bid_volume_8'],
                row['bid_price_9'], row['bid_volume_9'], row['bid_price_10'], row['bid_volume_10'],
                row['ask_price_1'], row['ask_volume_1'], row['ask_price_2'], row['ask_volume_2'],
                row['ask_price_3'], row['ask_volume_3'], row['ask_price_4'], row['ask_volume_4'],
                row['ask_price_5'], row['ask_volume_5'], row['ask_price_6'], row['ask_volume_6'],
                row['ask_price_7'], row['ask_volume_7'], row['ask_price_8'], row['ask_volume_8'],
                row['ask_price_9'], row['ask_volume_9'], row['ask_price_10'], row['ask_volume_10']
                )
                inserted += 1
                
                if inserted % 100 == 0:
                    print(f"📊 Inserted {inserted} rows...")
                    
            except Exception as e:
                print(f"⚠️ Error inserting row {inserted}: {e}")
                continue
        
        # Verify data
        count = await conn.fetchval("SELECT COUNT(*) FROM l2_orderbook")
        print(f"📊 Final row count: {count}")
        
        # Get sample data
        sample = await conn.fetchrow("SELECT ts, bid_price_1, ask_price_1 FROM l2_orderbook ORDER BY ts LIMIT 1")
        if sample:
            print(f"📝 Sample row: ts={sample['ts']}, bid={sample['bid_price_1']}, ask={sample['ask_price_1']}")
        
        await conn.close()
        print("✅ Database connection closed")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(load_data())
    exit(0 if success else 1)