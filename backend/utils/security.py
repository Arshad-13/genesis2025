from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from dotenv import load_dotenv
import os
import hashlib
import bcrypt

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

_PLACEHOLDER_PREFIXES = (
    "your-super-secret", "change-me", "changeme", "replace-me",
    "your-secret-key", "your_secret_key", "placeholder"
)

if not SECRET_KEY:
    raise ValueError(
        "SECRET_KEY environment variable is not set or is empty. "
        "Generate one with: python -c 'import secrets; print(secrets.token_hex(32))'"
    )

if len(SECRET_KEY) < 32:
    raise ValueError(
        f"SECRET_KEY must be at least 32 characters long (currently {len(SECRET_KEY)}). "
        "Generate one with: python -c 'import secrets; print(secrets.token_hex(32))'"
    )

if any(SECRET_KEY.lower().startswith(p) for p in _PLACEHOLDER_PREFIXES):
    raise ValueError(
        "SECRET_KEY appears to be a placeholder value. "
        "Generate a real key with: python -c 'import secrets; print(secrets.token_hex(32))'"
    )

def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.
    If password is longer than 72 bytes, hash it with SHA256 first.
    """
    # Bcrypt has a 72-byte limit, so we pre-hash long passwords
    if len(password.encode('utf-8')) > 72:
        password = hashlib.sha256(password.encode('utf-8')).hexdigest()
    
    # Hash the password with bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hashed password.
    Handles pre-hashed long passwords.
    """
    # If the plain password is longer than 72 bytes, pre-hash it
    if len(plain_password.encode('utf-8')) > 72:
        plain_password = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
    
    # Verify the password
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt

def decode_access_token(token: str):
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None