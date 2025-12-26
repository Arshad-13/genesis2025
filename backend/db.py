import asyncpg
import asyncio
from typing import Optional

# Async connection pool for better performance in async context
_connection_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()

async def get_connection_pool() -> asyncpg.Pool:
    """Get or create an async connection pool."""
    global _connection_pool
    
    if _connection_pool is None:
        async with _pool_lock:
            if _connection_pool is None:  # Double-check locking
                _connection_pool = await asyncpg.create_pool(
                    host="127.0.0.1",
                    port=5433,
                    database="orderbook",
                    user="postgres",
                    password="postgres",
                    min_size=1,
                    max_size=5,
                    command_timeout=60,
                    timeout=10  # Connection acquisition timeout
                )
    
    return _connection_pool

async def get_connection():
    """Get a connection from the pool."""
    pool = await get_connection_pool()
    return await pool.acquire()

async def return_connection(conn):
    """Return a connection to the pool."""
    pool = await get_connection_pool()
    await pool.release(conn)

async def close_all_connections():
    """Close all connections in the pool with timeout."""
    global _connection_pool
    if _connection_pool is not None:
        try:
            # Force close with shorter timeout to prevent hanging
            await asyncio.wait_for(_connection_pool.close(), timeout=2.0)
        except asyncio.TimeoutError:
            # Terminate connections forcefully if close times out
            _connection_pool.terminate()
        except Exception as e:
            # Force terminate on any error
            _connection_pool.terminate()
        finally:
            _connection_pool = None
