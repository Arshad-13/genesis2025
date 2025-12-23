import psycopg2
from psycopg2.extras import RealDictCursor

def get_connection():
    return psycopg2.connect(
        host="127.0.0.1",
        port=5433,
        database="orderbook",
        user="postgres",
        password="postgres",
        cursor_factory=RealDictCursor
    )
