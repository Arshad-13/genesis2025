
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import classification_report
import sys

from data_loader import DataHandler, LOBDataset
from model import DeepLOB

class FocalLoss(nn.Module):
    def __init__(self, alpha=1, gamma=2, reduction='mean'):
        super(FocalLoss, self).__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs, targets):
        ce_loss = nn.CrossEntropyLoss(reduction='none')(inputs, targets)
        pt = torch.exp(-ce_loss)
        loss = self.alpha * (1 - pt) ** self.gamma * ce_loss

        if self.reduction == 'mean':
            return loss.mean()
        return loss.sum()

def check_gpu():
    print("\n" + "="*50)
    print("GPU VERIFICATION")
    print("="*50)
    if torch.cuda.is_available():
        print(f"✅ GPU Detected: {torch.cuda.get_device_name(0)}")
        print(f"CUDA Version: {torch.version.cuda}")
        device = torch.device('cuda')
    else:
        print("❌ NO GPU DETECTED! Training will be slow on CPU.")
        device = torch.device('cpu')
    print("="*50 + "\n")
    return device

def train():
    device = check_gpu()
    
    # 1. Load Data
    # Using full dataset (approx 3.7M rows)
    BATCH_SIZE = 128
    handler = DataHandler("../../l2_clean.csv")
    
    # Load all data
    features, mid_prices, mean, std = handler.load_data(nrows=None)
    
    # Generate labels
    print("Generating labels with Dynamic Triple Barrier Method...")
    labels, valid_mask = handler.labeler.get_labels(mid_prices)
    
    # Prepare windows (heavy computation, done once)
    X, y = handler.prepare_windows(features, labels, valid_mask, stride=10)
    
    print(f"Dataset shape: {X.shape}")
    
    # Check class balance
    unique, counts = np.unique(y, return_counts=True)
    print(f"Class counts: {dict(zip(unique, counts))}")

    # === MEMORY OTPIZMITION START ===
    # Convert to Tensors ONCE to avoid multiple copies during fold splitting
    print("Converting data to PyTorch Tensors to save RAM...")
    X_tensor = torch.FloatTensor(X)
    y_tensor = torch.LongTensor(y)
    
    # Delete numpy arrays to free RAM immediately
    del X, y, features, mid_prices, labels, valid_mask
    import gc
    gc.collect()
    
    # Create single main dataset
    full_dataset = LOBDataset(X_tensor, y_tensor)
    # === MEMORY OPTIMIZATION END ===
    
    # 3. Walk-Forward Validation
    tscv = TimeSeriesSplit(n_splits=5)
    fold = 0
    
    # We must split indices, not the array
    # X_tensor is efficient, but tscv needs length or array
    # We can pass range(len(full_dataset))
    
    indices = np.arange(len(full_dataset))
    
    for train_index, val_index in tscv.split(indices):
        fold += 1
        print(f"\n=== Training Fold {fold} ===")
        
        # Use Subset for Zero-Copy views
        from torch.utils.data import Subset
        train_dataset = Subset(full_dataset, train_index)
        val_dataset = Subset(full_dataset, val_index)
        
        train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
        
        # Initialize Model
        model = DeepLOB(y_len=3).to(device)
        
        # Optimizer & Loss
        optimizer = optim.Adam(model.parameters(), lr=0.001)
        criterion = FocalLoss(gamma=2)
        
        # Training Loop
        EPOCHS = 20
        best_val_loss = float('inf')
        patience = 5
        trigger_times = 0
        
        for epoch in range(EPOCHS):
            model.train()
            train_loss = 0.0
            correct = 0
            total = 0
            
            for inputs, targets in train_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                
                optimizer.zero_grad()
                outputs = model(inputs)
                loss = criterion(outputs, targets)
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item()
                _, predicted = outputs.max(1)
                total += targets.size(0)
                correct += predicted.eq(targets).sum().item()
            
            avg_train_loss = train_loss / len(train_loader)
            train_acc = 100. * correct / total
            
            # Validation
            model.eval()
            val_loss = 0.0
            val_correct = 0
            val_total = 0
            
            all_preds = []
            all_targets = []
            
            with torch.no_grad():
                for inputs, targets in val_loader:
                    inputs, targets = inputs.to(device), targets.to(device)
                    outputs = model(inputs)
                    loss = criterion(outputs, targets)
                    
                    val_loss += loss.item()
                    _, predicted = outputs.max(1)
                    val_total += targets.size(0)
                    val_correct += predicted.eq(targets).sum().item()
                    
                    all_preds.extend(predicted.cpu().numpy())
                    all_targets.extend(targets.cpu().numpy())
            
            avg_val_loss = val_loss / len(val_loader)
            val_acc = 100. * val_correct / val_total
            
            print(f"Epoch {epoch+1}/{EPOCHS} | Train Loss: {avg_train_loss:.4f} | Acc: {train_acc:.2f}% | Val Loss: {avg_val_loss:.4f} | Val Acc: {val_acc:.2f}%")
            
            # Early Stopping & Checkpoint
            if avg_val_loss < best_val_loss:
                best_val_loss = avg_val_loss
                trigger_times = 0
                torch.save(model.state_dict(), f'../checkpoints/best_deeplob_fold{fold}.pth')
            else:
                trigger_times += 1
                if trigger_times >= patience:
                    print(f"Early stopping at epoch {epoch+1}")
                    break
        
        print("\nFold Evaluation:")
        print(classification_report(all_targets, all_preds, target_names=['Down', 'Neutral', 'Up']))

    print("Full training complete.")

if __name__ == '__main__':
    train()
