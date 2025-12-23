import pandas as pd
from sqlalchemy import create_engine

CSV_PATH = r"D:\Projects\Market-Microstructure\backend\dataset\1-09-1-20.csv"
DB_URL = "postgresql://postgres:postgres@127.0.0.1:5433/orderbook"

print("Reading CSV...")
df = pd.read_csv(CSV_PATH)

print("Renaming columns...")

columns = (
    ["index", "timestamp", "datetime"] +
    [f"bid_price_{i}" for i in range(1, 11)] +
    [f"bid_volume_{i}" for i in range(1, 11)] +
    [f"ask_price_{i}" for i in range(1, 11)] +
    [f"ask_volume_{i}" for i in range(1, 11)]
)

df.columns = columns

print("Creating ts column...")
df["ts"] = pd.to_datetime(df["timestamp"], unit="us", utc=True)

df = df.drop(columns=["index", "timestamp", "datetime"])

print("Connecting to DB...")
engine = create_engine(DB_URL)

print("Inserting data (this may take time)...")
df.to_sql(
    "l2_orderbook",
    engine,
    if_exists="append",
    index=False,
    chunksize=5000,
    method="multi"
)

print("DONE.")
