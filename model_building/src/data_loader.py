
import pandas as pd
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader

class DynamicLabeler:
    """
    Implements dynamic thresholding (Triple Barrier Method) to balance classes.
    """
    def __init__(self, horizon=10, vol_window=100):
        self.horizon = horizon
        self.vol_window = vol_window
    
    def get_labels(self, mid_prices):
        """
        Generate labels:
        2 (Up), 0 (Down), 1 (Neutral)
        """
        mid_prices = pd.Series(mid_prices).copy()
        
        # Calculate future returns
        future_returns = mid_prices.shift(-self.horizon) / mid_prices - 1
        
        # Calculate rolling return volatility
        returns = mid_prices.pct_change()
        volatility = returns.rolling(window=self.vol_window).std()
        
        # Dynamic threshold (1 std dev)
        thresholds = volatility
        
        labels = np.ones(len(mid_prices), dtype=int)  # Default to 1 (Neutral)
        
        # Up
        labels[future_returns > thresholds] = 2
        
        # Down
        labels[future_returns < -thresholds] = 0
        
        # Handle validity
        # Mask requires valid volatility AND valid future return
        valid_indices = ~np.isnan(volatility) & ~np.isnan(future_returns)
        # Shift mask to align with inputs (we predict FUTURE from CURRENT)
        # However, labels/future_returns are already aligned to current index i
        
        return labels, valid_indices

class LOBDataset(Dataset):
    def __init__(self, X, y):
        if torch.is_tensor(X):
            self.X = X
        else:
            self.X = torch.FloatTensor(X)
            
        if torch.is_tensor(y):
            self.y = y
        else:
            self.y = torch.LongTensor(y)
        
    def __len__(self):
        return len(self.X)
    
    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

class DataHandler:
    def __init__(self, file_path, sequence_length=100, horizon=10):
        self.file_path = file_path
        self.sequence_length = sequence_length
        self.horizon = horizon
        self.labeler = DynamicLabeler(horizon=horizon)
        
    def load_data(self, nrows=None):
        print(f"Loading data from {self.file_path}...")
        df = pd.read_csv(self.file_path, nrows=nrows)
        
        feature_cols = []
        for i in range(1, 11):
            feature_cols.extend([f'bid_price_{i}', f'bid_volume_{i}', f'ask_price_{i}', f'ask_volume_{i}'])
            
        features = df[feature_cols].values
        mid_prices = (df['bid_price_1'] + df['ask_price_1']) / 2
        
        # Standardization
        mean = np.mean(features, axis=0)
        std = np.std(features, axis=0)
        std[std == 0] = 1.0
        features_scaled = (features - mean) / std
        
        return features_scaled, mid_prices.values, mean, std

    def prepare_windows(self, features, labels, valid_mask, stride=1):
        """
        Create sliding windows for PyTorch (N, 1, 100, 40)
        Using 1 channel for CNN
        """
        X_windows = []
        y_windows = []
        
        print(f"Creating sliding windows (stride={stride})...")
        
        # Indices where we can look back 'sequence_length' and have a valid label
        # Label i matches input [i-seq : i]
        
        # Start index: needs to be at least seq_len AND have valid volatility/label
        # Valid mask is usually False for first vol_window items
        
        start_idx = max(self.sequence_length, self.labeler.vol_window)
        end_idx = len(features) - self.horizon # Ensure label exists
        
        for i in range(start_idx, end_idx, stride):
            if valid_mask[i]:
                X_windows.append(features[i-self.sequence_length : i])
                y_windows.append(labels[i])
                
        X_windows = np.array(X_windows)
        y_windows = np.array(y_windows)
        
        # Reshape for PyTorch (Batch, Channel, Height, Width) -> (N, 1, 100, 40)
        X_windows = X_windows.reshape(X_windows.shape[0], 1, 100, 40)
        
        return X_windows, y_windows

if __name__ == "__main__":
    handler = DataHandler("../../l2_clean.csv")
    features, mid_prices, _, _ = handler.load_data(nrows=50000)
    labels, valid = handler.labeler.get_labels(mid_prices)
    
    X, y = handler.prepare_windows(features, labels, valid)
    print(f"X shape: {X.shape}")
    print(f"y shape: {y.shape}")
    
    dataset = LOBDataset(X, y)
    loader = DataLoader(dataset, batch_size=32, shuffle=True)
    
    for batch_X, batch_y in loader:
        print(f"Batch X: {batch_X.shape}")
        print(f"Batch y: {batch_y.shape}")
        break
