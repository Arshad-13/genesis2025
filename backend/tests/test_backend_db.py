#!/usr/bin/env python3
"""
Test if the backend can connect to the database with current config
"""

import os
import sys
sys.path.append(os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

# Import the database module
from db import get_connection_pool, get_connection, return_connection
import asyncio

async def test_backend_db():
    print("Testing backend database connection...")
    
    # Print current environment variables
    print(f"DB_HOST: {os.getenv('DB_HOST')}")
    print(f"DB_PORT: {os.getenv('DB_PORT')}")
    print(f"DB_NAME: {os.getenv('DB_NAME')}")
    print(f"DB_USER: {os.getenv('DB_USER')}")
    print(f"DB_PASSWORD: {os.getenv('DB_PASSWORD')}")
    
    try:
        # Test pool creation
        pool = await get_connection_pool()
        print("✅ Database pool created successfully")
        
        # Test connection acquisition
        conn = await get_connection()
        print("✅ Database connection acquired")
        
        # Test query
        count = await conn.fetchval("SELECT COUNT(*) FROM l2_orderbook")
        print(f"✅ Query successful: {count} rows in l2_orderbook")
        
        # Return connection
        await return_connection(conn)
        print("✅ Connection returned to pool")
        
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_backend_db())
    exit(0 if success else 1)