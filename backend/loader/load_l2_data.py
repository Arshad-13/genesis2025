import pandas as pd
from sqlalchemy import create_engine
import os

# Use relative path or absolute path based on workspace
CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "l2_clean.csv")
DB_URL = "postgresql://postgres:postgres@127.0.0.1:5433/orderbook"

print(f"Reading CSV from {CSV_PATH}...")
# Read without header first to verify structure, or assume header exists but is misleading
df = pd.read_csv(CSV_PATH)

print("Transforming data structure...")

# The CSV data is interleaved: Px, Vol, Px, Vol...
# We need to separate them into Price columns and Volume columns

# Create new DataFrame
new_df = pd.DataFrame()
new_df["ts"] = pd.to_datetime(df.iloc[:, 40], format='mixed')

# Bids (Cols 0-19)
for i in range(1, 11):
    col_idx = (i - 1) * 2
    new_df[f"bid_price_{i}"] = df.iloc[:, col_idx]
    new_df[f"bid_volume_{i}"] = df.iloc[:, col_idx + 1]

# Asks (Cols 20-39)
for i in range(1, 11):
    col_idx = 20 + (i - 1) * 2
    new_df[f"ask_price_{i}"] = df.iloc[:, col_idx]
    new_df[f"ask_volume_{i}"] = df.iloc[:, col_idx + 1]

print("Connecting to DB...")
engine = create_engine(DB_URL)

print("Inserting data (this may take time)...")
new_df.to_sql(
    "l2_orderbook",
    engine,
    if_exists="append",
    index=False,
    chunksize=5000,
    method="multi"
)

print("DONE.")
