"""
Data utilities for sanitization and validation
"""
from datetime import datetime
from decimal import Decimal


def sanitize(obj):
    """
    Recursively sanitize data for JSON serialization.
    Converts datetime, Decimal, and other non-serializable types.
    """
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    return obj
