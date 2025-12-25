#!/usr/bin/env python3
"""
Simple test script to verify database and backend connections
"""

import sys
import time
from db import get_connection, return_connection

def test_database_connection():
    """Test the database connection"""
    print("🔍 Testing database connection...")
    
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Test basic connection
        cur.execute("SELECT version()")
        version = cur.fetchone()
        print(f"✅ PostgreSQL connected: {version['version'][:50]}...")
        
        # Test TimescaleDB extension
        cur.execute("SELECT extname FROM pg_extension WHERE extname = 'timescaledb'")
        ext = cur.fetchone()
        if ext:
            print("✅ TimescaleDB extension is enabled")
        else:
            print("❌ TimescaleDB extension not found")
            return False
        
        # Test hypertable
        cur.execute("SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_name = 'l2_orderbook'")
        hypertable = cur.fetchone()
        if hypertable:
            print("✅ l2_orderbook hypertable exists")
        else:
            print("❌ l2_orderbook hypertable not found")
            return False
        
        # Test table structure
        cur.execute("SELECT COUNT(*) FROM l2_orderbook")
        count = cur.fetchone()
        print(f"✅ l2_orderbook table has {count['count']} rows")
        
        # Test table columns
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'l2_orderbook' 
            ORDER BY ordinal_position
        """)
        columns = cur.fetchall()
        expected_columns = ['ts', 'bid_price_1', 'bid_volume_1', 'ask_price_1', 'ask_volume_1']
        found_columns = [col['column_name'] for col in columns[:5]]
        
        if all(col in [c['column_name'] for c in columns] for col in expected_columns):
            print(f"✅ Table structure correct ({len(columns)} columns)")
        else:
            print(f"❌ Table structure issue. Found: {found_columns}")
            return False
        
        return_connection(conn)
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_backend_imports():
    """Test that backend modules can be imported"""
    print("\n🔍 Testing backend module imports...")
    
    try:
        from analytics import AnalyticsEngine
        print("✅ Analytics module imported")
        
        from replay import ReplayController
        print("✅ Replay module imported")
        
        engine = AnalyticsEngine()
        print("✅ AnalyticsEngine instantiated")
        
        controller = ReplayController()
        print("✅ ReplayController instantiated")
        
        return True
        
    except Exception as e:
        print(f"❌ Backend import failed: {e}")
        return False

def main():
    print("🚀 Market Microstructure Backend Connection Test")
    print("=" * 50)
    
    # Test database
    db_ok = test_database_connection()
    
    # Test backend
    backend_ok = test_backend_imports()
    
    print("\n" + "=" * 50)
    if db_ok and backend_ok:
        print("🎉 All tests passed! System is ready.")
        print("\nNext steps:")
        print("1. Start backend: uvicorn main:app --host 0.0.0.0 --port 8000")
        print("2. Start frontend: npm run dev (in market-microstructure folder)")
        print("3. Load data (optional): python loader/load_l2_data.py")
        return 0
    else:
        print("❌ Some tests failed. Check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())