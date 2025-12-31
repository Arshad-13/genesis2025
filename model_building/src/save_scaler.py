
import numpy as np
import pandas as pd
import json
import os

# Use DataHandler to ensure consistent logic
from data_loader import DataHandler

def save_scaler():
    handler = DataHandler("../../l2_clean.csv")
    print("Loading data to compute scaler stats...")
    # Load all data to get accurate mean/std
    features, _, mean, std = handler.load_data(nrows=None)
    
    stats = {
        "mean": mean.tolist(),
        "std": std.tolist()
    }
    
    output_path = "../checkpoints/scaler_params.json"
    with open(output_path, "w") as f:
        json.dump(stats, f)
        
    print(f"✅ Scaler statistics saved to {output_path}")

if __name__ == "__main__":
    save_scaler()
