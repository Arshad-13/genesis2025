#!/usr/bin/env python3
"""
Quick status check for the Market Microstructure system
"""

import subprocess
import sys
import requests
from db import get_connection, return_connection

def check_docker():
    """Check if Docker and TimescaleDB container are running"""
    try:
        # Check if docker is available
        result = subprocess.run(['docker', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            return False, "Docker not installed"
        
        # Check if TimescaleDB container is running
        result = subprocess.run(['docker', 'ps', '--filter', 'name=timescaledb', '--format', 'table {{.Names}}\t{{.Status}}'], 
                              capture_output=True, text=True)
        
        if 'timescaledb' in result.stdout and 'Up' in result.stdout:
            return True, "TimescaleDB container running"
        else:
            return False, "TimescaleDB container not running"
            
    except Exception as e:
        return False, f"Docker check failed: {e}"

def check_database():
    """Check database connection and data"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM l2_orderbook")
        count = cur.fetchone()
        
        return_connection(conn)
        return True, f"Database connected, {count['count']} rows in l2_orderbook"
        
    except Exception as e:
        return False, f"Database connection failed: {e}"

def check_backend():
    """Check if backend server is running"""
    try:
        response = requests.get('http://localhost:8000/health', timeout=2)
        if response.status_code == 200:
            data = response.json()
            return True, f"Backend running ({data.get('status', 'unknown')} mode: {data.get('mode', 'unknown')})"
        else:
            return False, f"Backend responded with status {response.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "Backend not running (connection refused)"
    except Exception as e:
        return False, f"Backend check failed: {e}"

def main():
    print("🔍 Market Microstructure System Status")
    print("=" * 40)
    
    # Check Docker
    docker_ok, docker_msg = check_docker()
    print(f"🐳 Docker: {'✅' if docker_ok else '❌'} {docker_msg}")
    
    # Check Database
    db_ok, db_msg = check_database()
    print(f"🗄️  Database: {'✅' if db_ok else '❌'} {db_msg}")
    
    # Check Backend
    backend_ok, backend_msg = check_backend()
    print(f"🚀 Backend: {'✅' if backend_ok else '❌'} {backend_msg}")
    
    print("\n" + "=" * 40)
    
    if docker_ok and db_ok:
        print("✅ Core system is ready!")
        if not backend_ok:
            print("💡 To start backend: uvicorn main:app --host 0.0.0.0 --port 8000")
        print("💡 To start frontend: npm run dev (in market-microstructure folder)")
    else:
        print("❌ System not ready. Check the issues above.")
        if not docker_ok:
            print("💡 Start Docker: docker compose up -d")

if __name__ == "__main__":
    main()