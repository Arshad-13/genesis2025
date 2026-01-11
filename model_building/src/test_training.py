#!/usr/bin/env python3

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from data_loader import DataHandler, LOBDataset
from model import DeepLOB

def test_training():
    """Quick test to verify training pipeline works"""
    print("Testing training pipeline...")
    
    device = torch.device('cpu')  # Use CPU for quick test
    
    # Load small dataset
    handler = DataHandler("../../l2_clean.csv")
    features, mid_prices, mean, std = handler.load_data(nrows=5000)
    
    # Generate labels
    labels, valid_mask = handler.labeler.get_labels(mid_prices)
    
    # Prepare windows
    X, y = handler.prepare_windows(features, labels, valid_mask, stride=50)  # Large stride for speed
    
    print(f"Dataset shape: {X.shape}")
    print(f"Labels shape: {y.shape}")
    
    # Check class distribution
    import numpy as np
    unique, counts = np.unique(y, return_counts=True)
    print(f"Class distribution: {dict(zip(unique, counts))}")
    
    # Create dataset and loader
    dataset = LOBDataset(X, y)
    loader = DataLoader(dataset, batch_size=16, shuffle=True)
    
    # Initialize model
    model = DeepLOB(y_len=3).to(device)
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    criterion = nn.CrossEntropyLoss()
    
    # Test one epoch
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    print("Running test epoch...")
    for batch_idx, (inputs, targets) in enumerate(loader):
        inputs, targets = inputs.to(device), targets.to(device)
        
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        _, predicted = outputs.max(1)
        total += targets.size(0)
        correct += predicted.eq(targets).sum().item()
        
        if batch_idx >= 5:  # Only test a few batches
            break
    
    avg_loss = total_loss / (batch_idx + 1)
    accuracy = 100. * correct / total
    
    print(f"Test Results:")
    print(f"  Average Loss: {avg_loss:.4f}")
    print(f"  Accuracy: {accuracy:.2f}%")
    print("Training pipeline test completed successfully!")

if __name__ == "__main__":
    test_training()