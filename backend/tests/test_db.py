#!/usr/bin/env python3
"""
Test database connection directly
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def test_db_connection():
    # Get config from environment
    config = {
        'host': os.getenv('DB_HOST', '127.0.0.1'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'trading_hub'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', '123')
    }
    
    print(f"Testing connection to: {config}")
    
    try:
        # Test connection
        conn = await asyncpg.connect(
            host=config['host'],
            port=config['port'],
            database=config['database'],
            user=config['user'],
            password=config['password']
        )
        
        print("✅ Database connection successful!")
        
        # Check if l2_orderbook table exists
        result = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'l2_orderbook'
        """)
        
        if result:
            print("✅ l2_orderbook table exists")
            
            # Check row count
            count = await conn.fetchval("SELECT COUNT(*) FROM l2_orderbook")
            print(f"📊 l2_orderbook has {count} rows")
            
            if count > 0:
                # Get sample row
                sample = await conn.fetchrow("SELECT * FROM l2_orderbook LIMIT 1")
                print(f"📝 Sample row columns: {list(sample.keys())}")
            
        else:
            print("❌ l2_orderbook table does not exist")
            
            # List all tables
            tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            print(f"📋 Available tables: {[t['table_name'] for t in tables]}")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_db_connection())
    exit(0 if success else 1)