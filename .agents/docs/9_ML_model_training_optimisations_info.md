# Model Training and Prediction Engine Workflow

## Overview

The Genesis-2025 HFT platform: Trading Hub uses a **DeepLOB neural network** for real-time market prediction. The system has two main components:

1. **Model Training** (Offline): Train the DeepLOB model using historical data
2. **Model Inference** (Real-time): Load trained model for live predictions in the backend

## Current Architecture

### Model Training (Manual Process)
The model training is currently a **manual offline process** that must be run separately from the frontend. There is **no API endpoint** to trigger training from the frontend.

**Training Script Location:**
```
model_building/src/train.py
```

**Training Command:**
```bash
cd model_building/src
python train.py
```

### Model Inference (Automatic)
The trained model is automatically loaded by the backend when it starts:

**Backend Integration:**
- `backend/inference_service.py` - Loads trained model automatically
- `backend/main.py` - Integrates predictions into WebSocket data stream
- Model path: `model_building/checkpoints/best_deeplob_fold5.pth`

## How to Start Model Training

### Prerequisites
1. **Data File**: Ensure `l2_clean.csv` exists in the root directory
2. **Python Environment**: Activate virtual environment with required packages
3. **GPU (Optional)**: CUDA-enabled GPU for faster training

### Step-by-Step Training Process

#### 1. Navigate to Training Directory
```bash
cd model_building/src
```

#### 2. Run Training Script
```bash
python train.py
```

#### 3. Training Process
The script will:
- Load data from `../../l2_clean.csv` (3.7M rows)
- Generate labels using Dynamic Triple Barrier Method
- Run 5-fold cross-validation
- Train for 20 epochs per fold with early stopping
- Save best model to `../checkpoints/best_deeplob_fold5.pth`

#### 4. Expected Output
```
=== Training Fold 1 ===
Epoch 1/20 | Train Loss: 0.8234 | Acc: 65.2% | Val Loss: 0.7891 | Val Acc: 63.4%
...
Early stopping at epoch 15

=== Training Fold 2 ===
...

Full training complete.
```

### Training Configuration
- **Model**: DeepLOB with Inception modules
- **Dataset**: ~3.7M L2 orderbook snapshots
- **Features**: 40 features (20 bid levels + 20 ask levels)
- **Labels**: 3-class (UP/DOWN/NEUTRAL)
- **Validation**: 5-fold time-series cross-validation
- **Batch Size**: 128
- **Epochs**: 20 (with early stopping)
- **Loss Function**: Focal Loss (handles class imbalance)

## Model Prediction (Frontend Integration)

### How Predictions Work
1. **Frontend**: MarketPredict page connects via WebSocket
2. **Backend**: Automatically loads trained model on startup
3. **Real-time**: Model processes each market snapshot and returns predictions
4. **Display**: Predictions shown as probability bars (UP/NEUTRAL/DOWN)

### Frontend Access
Navigate to: `http://localhost:3000/predict`

The MarketPredict page will:
- Connect to backend via WebSocket with session ID `model-test-{random}`
- Receive real-time predictions with each market snapshot
- Display confidence levels and trading signals

## Missing Frontend Training Integration

### Current Limitation
**There is NO way to start model training from the frontend.** The training process is completely manual and offline.

### What Would Be Needed
To enable frontend-triggered training, you would need to add:

#### 1. Backend API Endpoint
```python
@app.post("/model/train")
async def start_model_training():
    """Start model training in background"""
    # This endpoint doesn't exist yet
    pass
```

#### 2. Background Training Process
```python
import subprocess
import asyncio

async def run_training_background():
    """Run training script in background"""
    process = await asyncio.create_subprocess_exec(
        "python", "model_building/src/train.py",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    # This functionality doesn't exist yet
```

#### 3. Frontend Training UI
```jsx
// This doesn't exist in MarketPredict.jsx
const startTraining = async () => {
    await fetch('/model/train', { method: 'POST' });
};
```

## Quick Test Training

For testing the training pipeline without full training:

```bash
cd model_building/src
python test_training.py
```

This runs a quick test with 5,000 rows to verify the training pipeline works.

## Model Files

### Generated Files After Training
```
model_building/checkpoints/
├── best_deeplob_fold1.pth    # Fold 1 model weights
├── best_deeplob_fold2.pth    # Fold 2 model weights  
├── best_deeplob_fold3.pth    # Fold 3 model weights
├── best_deeplob_fold4.pth    # Fold 4 model weights
├── best_deeplob_fold5.pth    # Fold 5 model weights (used by backend)
└── scaler_params.json        # Normalization parameters
```

### Backend Model Loading
The backend automatically loads:
- **Model**: `best_deeplob_fold5.pth` (best performing fold)
- **Scaler**: `scaler_params.json` (for feature normalization)

## Performance Expectations

### Training Time
- **CPU**: ~2-4 hours for full 5-fold training
- **GPU**: ~30-60 minutes for full training

### Model Performance
- **Training Accuracy**: ~68%
- **Validation Accuracy**: ~65%
- **Test Accuracy**: ~63%

## Summary

**To start the prediction model engine:**

1. **Training (Manual)**: `cd model_building/src && python train.py`
2. **Inference (Automatic)**: Backend loads model on startup
3. **Frontend Access**: Navigate to `/predict` page

**Key Limitation**: No frontend integration for training - it's a manual offline process that requires command-line execution.