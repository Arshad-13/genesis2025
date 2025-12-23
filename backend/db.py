import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
import threading

# Connection pool for better performance
_connection_pool = None
_pool_lock = threading.Lock()

def get_connection_pool():
    """Get or create a connection pool."""
    global _connection_pool
    
    if _connection_pool is None:
        with _pool_lock:
            if _connection_pool is None:  # Double-check locking
                _connection_pool = psycopg2.pool.SimpleConnectionPool(
                    minconn=1,
                    maxconn=5,
                    host="127.0.0.1",
                    port=5433,
                    database="orderbook",
                    user="postgres",
                    password="postgres",
                    cursor_factory=RealDictCursor
                )
    
    return _connection_pool

def get_connection():
    """Get a connection from the pool."""
    pool = get_connection_pool()
    return pool.getconn()

def return_connection(conn):
    """Return a connection to the pool."""
    pool = get_connection_pool()
    pool.putconn(conn)

def close_all_connections():
    """Close all connections in the pool."""
    global _connection_pool
    if _connection_pool is not None:
        _connection_pool.closeall()
        _connection_pool = None
