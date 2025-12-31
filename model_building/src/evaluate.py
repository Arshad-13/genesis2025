
import torch
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import TimeSeriesSplit
import matplotlib.pyplot as plt
import seaborn as sns

from data_loader import DataHandler, LOBDataset
from model import DeepLOB

def evaluate_model(fold_num=5):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    # 1. Load Data
    handler = DataHandler("../../l2_clean.csv")
    features, mid_prices, mean, std = handler.load_data(nrows=None)
    
    # Generate labels
    print("Generating labels...")
    labels, valid_mask = handler.labeler.get_labels(mid_prices)
    
    # Prepare windows
    X, y = handler.prepare_windows(features, labels, valid_mask, stride=10)
    
    # Reconstruct the split for the specific fold
    tscv = TimeSeriesSplit(n_splits=5)
    current_fold = 0
    
    X_val = None
    y_val = None
    
    # Walk forward to find the validation indices for the requested fold
    indices = np.arange(len(X))
    for train_index, val_index in tscv.split(indices):
        current_fold += 1
        if current_fold == fold_num:
            X_val = X[val_index]
            y_val = y[val_index]
            break
            
    if X_val is None:
        print(f"Error: Fold {fold_num} not found.")
        return

    # Convert to Tensor
    X_val_tensor = torch.FloatTensor(X_val)
    y_val_tensor = torch.LongTensor(y_val)
    
    # Load Model
    model = DeepLOB(y_len=3).to(device)
    model_path = f"../checkpoints/best_deeplob_fold{fold_num}.pth"
    print(f"Loading model from {model_path}...")
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()
    
    # Predict
    BATCH_SIZE = 128
    dataset = LOBDataset(X_val_tensor, y_val_tensor)
    loader = torch.utils.data.DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    all_preds = []
    all_targets = []
    
    print("Running inference...")
    with torch.no_grad():
        for inputs, targets in loader:
            inputs = inputs.to(device)
            outputs = model(inputs)
            _, predicted = outputs.max(1)
            
            all_preds.extend(predicted.cpu().numpy())
            all_targets.extend(targets.cpu().numpy())
            
    # Metrics
    print("\n" + "="*60)
    print(f"EVALUATION REPORT (Fold {fold_num})")
    print("="*60)
    
    print(classification_report(all_targets, all_preds, target_names=['Down', 'Neutral', 'Up']))
    
    # Confusion Matrix
    cm = confusion_matrix(all_targets, all_preds)
    print("\nConfusion Matrix:")
    print(cm)
    
    # Calculate Per-Class Accuracy
    class_acc = cm.diagonal() / cm.sum(axis=1)
    print("\nPer-Class Accuracy:")
    print(f"Down:    {class_acc[0]*100:.2f}%")
    print(f"Neutral: {class_acc[1]*100:.2f}%")
    print(f"Up:      {class_acc[2]*100:.2f}%")

if __name__ == "__main__":
    evaluate_model(fold_num=5)
