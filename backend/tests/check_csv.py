#!/usr/bin/env python3
"""
Check the structure of the CSV file
"""

import pandas as pd
import os

csv_path = os.path.join(os.path.dirname(__file__), "dataset", "l2_clean.csv")
print(f"Reading CSV from {csv_path}...")

# Read first few rows
df = pd.read_csv(csv_path, nrows=5)
print(f"Shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print("\nFirst few rows:")
print(df.head())

print(f"\nLast column (timestamp candidate): {df.columns[-1]}")
print("Sample values from last column:")
print(df.iloc[:, -1].head())

print(f"\nData types:")
print(df.dtypes)