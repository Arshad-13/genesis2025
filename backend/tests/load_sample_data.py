#!/usr/bin/env python3
"""
Load a small sample of data for testing
"""

import pandas as pd
from sqlalchemy import create_engine
import os

# Path to the CSV file
CSV_PATH = os.path.join(os.path.dirname(__file__), "dataset", "l2_clean.csv")
DB_URL = "postgresql://postgres:postgres@127.0.0.1:5433/orderbook"

print(f"Reading sample from {CSV_PATH}...")

# Read only first 1000 rows for testing
df = pd.read_csv(CSV_PATH, nrows=1000)

print(f"Loaded {len(df)} rows")
print("Sample columns:", df.columns.tolist()[:10])

print("Connecting to DB...")
engine = create_engine(DB_URL)

print("Inserting sample data...")
df.to_sql(
    "l2_orderbook",
    engine,
    if_exists="append",
    index=False,
    chunksize=100,
    method="multi"
)

print(f"✅ Successfully loaded {len(df)} sample rows!")

# Verify the data
print("Verifying data...")
result = engine.execute("SELECT COUNT(*) FROM l2_orderbook")
count = result.fetchone()[0]
print(f"Total rows in database: {count}")

print("Sample data loaded successfully! The backend should now have data to replay.")