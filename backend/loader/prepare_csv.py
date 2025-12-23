import pandas as pd

SRC = r"D:\Projects\Market-Microstructure\backend\dataset\1-09-1-20.csv"
OUT = r"D:\Projects\Market-Microstructure\backend\dataset\l2_clean.csv"

print("Reading raw CSV...")
df = pd.read_csv(SRC)

print("Renaming columns...")
df.columns = (
    ["index", "timestamp", "datetime"] +
    [f"bid_price_{i}" for i in range(1, 11)] +
    [f"bid_volume_{i}" for i in range(1, 11)] +
    [f"ask_price_{i}" for i in range(1, 11)] +
    [f"ask_volume_{i}" for i in range(1, 11)]
)

print("Converting timestamp...")
df["ts"] = pd.to_datetime(df["timestamp"], unit="us", utc=True)

print("Dropping unused columns...")
df = df.drop(columns=["index", "timestamp", "datetime"])

print("Saving clean CSV...")
df.to_csv(OUT, index=False)

print("DONE: l2_clean.csv created")
