#!/usr/bin/env python3
"""
Create l2_orderbook table and load data from CSV
"""

import pandas as pd
import asyncpg
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def create_and_load_data():
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
        
        # Create table
        create_table_sql = """
        CREATE TABLE l2_orderbook (
            ts TIMESTAMP NOT NULL,
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
        
        # Load CSV data
        csv_path = os.path.join(os.path.dirname(__file__), "dataset", "l2_clean.csv")
        print(f"📖 Reading CSV from {csv_path}...")
        
        if not os.path.exists(csv_path):
            print(f"❌ CSV file not found: {csv_path}")
            return False
        
        # Read CSV in chunks to avoid memory issues
        chunk_size = 1000
        total_rows = 0
        
        for chunk_num, df_chunk in enumerate(pd.read_csv(csv_path, chunksize=chunk_size)):
            print(f"📊 Processing chunk {chunk_num + 1} ({len(df_chunk)} rows)...")
            
            # Transform data structure
            new_df = pd.DataFrame()
            
            # Timestamp (assuming it's in the last column)
            new_df["ts"] = pd.to_datetime(df_chunk.iloc[:, -1], format='mixed', errors='coerce', utc=True)
            
            # Bids (Cols 0-19)
            for i in range(1, 11):
                col_idx = (i - 1) * 2
                if col_idx < len(df_chunk.columns) - 1:  # Exclude timestamp column
                    new_df[f"bid_price_{i}"] = pd.to_numeric(df_chunk.iloc[:, col_idx], errors='coerce')
                    new_df[f"bid_volume_{i}"] = pd.to_numeric(df_chunk.iloc[:, col_idx + 1], errors='coerce')
            
            # Asks (Cols 20-39)
            for i in range(1, 11):
                col_idx = 20 + (i - 1) * 2
                if col_idx < len(df_chunk.columns) - 1:  # Exclude timestamp column
                    new_df[f"ask_price_{i}"] = pd.to_numeric(df_chunk.iloc[:, col_idx], errors='coerce')
                    new_df[f"ask_volume_{i}"] = pd.to_numeric(df_chunk.iloc[:, col_idx + 1], errors='coerce')
            
            # Remove rows with invalid timestamps
            new_df = new_df.dropna(subset=['ts'])
            
            if len(new_df) == 0:
                print(f"⚠️ Chunk {chunk_num + 1} has no valid data, skipping...")
                continue
            
            # Insert data using asyncpg
            records = []
            for _, row in new_df.iterrows():
                record = [row['ts']] + [row[f'bid_price_{i}'] for i in range(1, 11)] + [row[f'bid_volume_{i}'] for i in range(1, 11)] + [row[f'ask_price_{i}'] for i in range(1, 11)] + [row[f'ask_volume_{i}'] for i in range(1, 11)]
                records.append(record)
            
            # Bulk insert
            await conn.executemany("""
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
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41)
            """, records)
            
            total_rows += len(records)
            print(f"✅ Inserted {len(records)} rows (total: {total_rows})")
            
            # Limit to first few chunks for testing
            if chunk_num >= 4:  # Load first 5 chunks (5000 rows)
                print("🛑 Stopping after 5 chunks for testing...")
                break
        
        # Verify data
        count = await conn.fetchval("SELECT COUNT(*) FROM l2_orderbook")
        print(f"📊 Final row count: {count}")
        
        # Get sample data
        sample = await conn.fetchrow("SELECT * FROM l2_orderbook ORDER BY ts LIMIT 1")
        if sample:
            print(f"📝 Sample row timestamp: {sample['ts']}")
        
        await conn.close()
        print("✅ Database connection closed")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(create_and_load_data())
    exit(0 if success else 1)