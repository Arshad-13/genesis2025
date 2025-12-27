import asyncpg
import asyncio
import logging
import os
from typing import Optional
from collections import deque
import time

logger = logging.getLogger(__name__)

# Async connection pool for better performance in async context
_connection_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()
_pool_stats = {
    "total_acquisitions": 0,
    "total_releases": 0,
    "failed_acquisitions": 0,
    "acquisition_times": deque(maxlen=100),
    "pool_created_at": None
}

# Configuration from environment variables with validation
def _get_db_config() -> dict:
    """Get and validate database configuration from environment variables."""
    config = {
        'host': os.getenv('DB_HOST', '127.0.0.1'),
        'port': int(os.getenv('DB_PORT', '5433')),
        'database': os.getenv('DB_NAME', 'orderbook'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', 'postgres')
    }
    
    # Validate critical fields
    if not config['database']:
        raise ValueError("Database name (DB_NAME) cannot be empty")
    if not config['user']:
        raise ValueError("Database user (DB_USER) cannot be empty")
    if not config['password']:
        logger.warning("⚠️ DB_PASSWORD not set or empty - using default credentials")
    
    return config

# Configuration from environment variables with production defaults
POOL_MIN_SIZE = int(os.getenv("DB_POOL_MIN_SIZE", "2"))
POOL_MAX_SIZE = int(os.getenv("DB_POOL_MAX_SIZE", "10"))
POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
COMMAND_TIMEOUT = int(os.getenv("DB_COMMAND_TIMEOUT", "60"))
MAX_RETRIES = int(os.getenv("DB_MAX_RETRIES", "3"))
RETRY_DELAY = float(os.getenv("DB_RETRY_DELAY", "1.0"))

# Validate pool size limits (Issue #10)
if POOL_MIN_SIZE < 1:
    raise ValueError(f"DB_POOL_MIN_SIZE must be >= 1, got {POOL_MIN_SIZE}")
if POOL_MAX_SIZE < POOL_MIN_SIZE:
    raise ValueError(f"DB_POOL_MAX_SIZE ({POOL_MAX_SIZE}) must be >= DB_POOL_MIN_SIZE ({POOL_MIN_SIZE})")
if POOL_MAX_SIZE > 50:
    logger.warning(f"⚠️ DB_POOL_MAX_SIZE ({POOL_MAX_SIZE}) is very high. Consider lowering to avoid resource exhaustion.")

async def get_connection_pool() -> asyncpg.Pool:
    """Get or create an async connection pool with retry logic."""
    global _connection_pool
    
    if _connection_pool is None:
        async with _pool_lock:
            if _connection_pool is None:  # Double-check locking
                retry_count = 0
                last_error = None
                
                while retry_count < MAX_RETRIES:
                    try:
                        db_config = _get_db_config()
                        _connection_pool = await asyncpg.create_pool(
                            host=db_config['host'],
                            port=db_config['port'],
                            database=db_config['database'],
                            user=db_config['user'],
                            password=db_config['password'],
                            min_size=POOL_MIN_SIZE,
                            max_size=POOL_MAX_SIZE,
                            command_timeout=COMMAND_TIMEOUT,
                            timeout=POOL_TIMEOUT,
                            max_queries=50000,  # Maximum number of queries before connection refresh
                            max_cached_statement_lifetime=300,  # Cache prepared statements for 5 min
                            max_cacheable_statement_size=1024 * 15  # Cache statements up to 15KB
                        )
                        _pool_stats["pool_created_at"] = time.time()
                        logger.info(f"✅ Database pool created: min={POOL_MIN_SIZE}, max={POOL_MAX_SIZE}, timeout={POOL_TIMEOUT}s")
                        break
                    except Exception as e:
                        last_error = e
                        retry_count += 1
                        if retry_count < MAX_RETRIES:
                            delay = RETRY_DELAY * (2 ** (retry_count - 1))  # Exponential backoff
                            logger.warning(f"DB pool creation failed (attempt {retry_count}/{MAX_RETRIES}), retrying in {delay}s: {e}")
                            await asyncio.sleep(delay)
                        else:
                            logger.error(f"Failed to create DB pool after {MAX_RETRIES} attempts: {last_error}")
                            raise
    
    return _connection_pool

async def get_connection():
    """Get a connection from the pool with metrics tracking."""
    start_time = time.time()
    try:
        pool = await get_connection_pool()
        conn = await pool.acquire()
        acquisition_time = (time.time() - start_time) * 1000
        
        _pool_stats["total_acquisitions"] += 1
        _pool_stats["acquisition_times"].append(acquisition_time)
        
        if acquisition_time > 100:  # Log slow acquisitions
            logger.warning(f"Slow connection acquisition: {acquisition_time:.2f}ms")
        
        return conn
    except Exception as e:
        _pool_stats["failed_acquisitions"] += 1
        logger.error(f"Failed to acquire connection: {e}")
        raise

async def return_connection(conn):
    """Return a connection to the pool with metrics tracking."""
    if conn is None:
        return
    
    try:
        # Check if connection is still valid and not already released
        if hasattr(conn, '_con') and conn._con is None:
            # Connection already released
            return
            
        pool = await get_connection_pool()
        if pool is None:
            # Pool already closed
            return
            
        await pool.release(conn)
        _pool_stats["total_releases"] += 1
    except Exception as e:
        # Silently ignore errors during shutdown to prevent cascading failures
        logger.debug(f"Connection release cleanup (non-critical): {e}")

def get_pool_stats() -> dict:
    """Get connection pool statistics."""
    pool = _connection_pool
    
    if pool is None:
        return {
            "status": "not_initialized",
            "size": 0,
            "free": 0,
            "total_acquisitions": _pool_stats["total_acquisitions"],
            "total_releases": _pool_stats["total_releases"],
            "failed_acquisitions": _pool_stats["failed_acquisitions"]
        }
    
    acquisition_times = list(_pool_stats["acquisition_times"])
    avg_acquisition_time = sum(acquisition_times) / len(acquisition_times) if acquisition_times else 0
    
    uptime = time.time() - _pool_stats["pool_created_at"] if _pool_stats["pool_created_at"] else 0
    
    return {
        "status": "active",
        "size": pool.get_size(),
        "free": pool.get_idle_size(),
        "min_size": pool.get_min_size(),
        "max_size": pool.get_max_size(),
        "total_acquisitions": _pool_stats["total_acquisitions"],
        "total_releases": _pool_stats["total_releases"],
        "failed_acquisitions": _pool_stats["failed_acquisitions"],
        "avg_acquisition_time_ms": round(avg_acquisition_time, 3),
        "uptime_seconds": round(uptime, 1),
        "utilization_percent": round((pool.get_size() - pool.get_idle_size()) / pool.get_max_size() * 100, 1) if pool.get_max_size() > 0 else 0
    }

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
