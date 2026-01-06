
import sys
import os
import torch
import numpy as np
import json
from collections import deque
import logging

# Add model_building/src to path to import model.py
sys.path.append(os.path.join(os.path.dirname(__file__), "../model_building/src"))

try:
    from model import DeepLOB
except ImportError:
    print("Warning: Could not import DeepLOB from model_building/src")

logger = logging.getLogger(__name__)

class ModelInference:
    def __init__(self, model_path="../model_building/checkpoints/best_deeplob_fold5.pth", scaler_path="../model_building/checkpoints/scaler_params.json"):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Inference Service using device: {self.device}")
        
        self.model = None
        self.mean = None
        self.std = None
        
        # Buffer storage: session_id -> deque (max 100)
        self.session_buffers = {}
        
        # Rate limiting for inference
        self.last_inference_time = {}
        self.min_inference_interval = 0.1  # 100ms between predictions (10 predictions/sec max)
        
        self.load_resources(model_path, scaler_path)

    def load_resources(self, model_path, scaler_path):
        try:
            # Load Scaler
            with open(scaler_path, 'r') as f:
                stats = json.load(f)
                self.mean = np.array(stats['mean'])
                self.std = np.array(stats['std'])
            logger.info("✅ Scaler statistics loaded.")
            
            # Load Model
            self.model = DeepLOB(y_len=3).to(self.device)
            self.model.load_state_dict(torch.load(model_path, map_location=self.device, weights_only=True))
            self.model.eval()
            logger.info(f"✅ Model loaded from {model_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to load model resources: {e}")
            self.model = None

    def _extract_features(self, snapshot):
        """
        Extract 40 features (10 levels * 4 stats) from snapshot dict.
        Matches DataHandler logic.
        """
        features = []
        bids = snapshot.get('bids', [])
        asks = snapshot.get('asks', [])
        
        # Ensure we have 10 levels
        for i in range(10):
            # Bid Price, Bid Vol
            if i < len(bids):
                features.extend([float(bids[i][0]), float(bids[i][1])])
            else:
                features.extend([0.0, 0.0])
                
            # Ask Price, Ask Vol
            if i < len(asks):
                features.extend([float(asks[i][0]), float(asks[i][1])])
            else:
                features.extend([0.0, 0.0])
                
        return np.array(features)

    def predict(self, session_id, snapshot):
        """
        Add snapshot to buffer and predict if buffer full.
        Returns: {up: float, neutral: float, down: float} or None
        """
        if self.model is None:
            return None
        
        # Rate limiting check
        import time
        current_time = time.time()
        last_time = self.last_inference_time.get(session_id, 0)
        
        if current_time - last_time < self.min_inference_interval:
            # Too soon, skip this prediction
            return None
            
        if session_id not in self.session_buffers:
            self.session_buffers[session_id] = deque(maxlen=100)
        
        # Extract features
        features = self._extract_features(snapshot)
        
        # Normalize
        # Avoid division by zero
        std_safe = self.std.copy()
        std_safe[std_safe == 0] = 1.0
        features_norm = (features - self.mean) / std_safe
        
        self.session_buffers[session_id].append(features_norm)
        
        # Need exactly 100 samples
        if len(self.session_buffers[session_id]) < 100:
            return None
            
        # Prepare Tensor (1, 1, 100, 40)
        input_np = np.array(list(self.session_buffers[session_id]))
        input_tensor = torch.FloatTensor(input_np).unsqueeze(0).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            output = self.model(input_tensor)
            probs = torch.softmax(output, dim=1).cpu().numpy()[0]
        
        # Update last inference time
        self.last_inference_time[session_id] = current_time
            
        # Output is [Down, Neutral, Up]
        return {
            "down": float(probs[0]),
            "neutral": float(probs[1]),
            "up": float(probs[2])
        }
    
    def predict_batch(self, session_snapshots: dict):
        """
        Batch inference for multiple sessions at once (GPU efficiency).
        Args:
            session_snapshots: {session_id: snapshot}
        Returns:
            {session_id: {up, neutral, down}} for ready sessions
        """
        if self.model is None:
            return {}
        
        import time
        current_time = time.time()
        
        # Filter sessions that are ready for inference
        ready_sessions = {}
        batch_inputs = []
        session_ids_order = []
        
        for session_id, snapshot in session_snapshots.items():
            # Rate limiting check
            last_time = self.last_inference_time.get(session_id, 0)
            if current_time - last_time < self.min_inference_interval:
                continue
            
            # Initialize buffer if needed
            if session_id not in self.session_buffers:
                self.session_buffers[session_id] = deque(maxlen=100)
            
            # Extract and normalize features
            features = self._extract_features(snapshot)
            std_safe = self.std.copy()
            std_safe[std_safe == 0] = 1.0
            features_norm = (features - self.mean) / std_safe
            
            self.session_buffers[session_id].append(features_norm)
            
            # Check if buffer is full
            if len(self.session_buffers[session_id]) == 100:
                input_np = np.array(list(self.session_buffers[session_id]))
                batch_inputs.append(input_np)
                session_ids_order.append(session_id)
        
        # No sessions ready for inference
        if not batch_inputs:
            return {}
        
        # Batch inference (N, 1, 100, 40)
        try:
            batch_tensor = torch.FloatTensor(np.array(batch_inputs)).unsqueeze(1).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(batch_tensor)
                probs_batch = torch.softmax(outputs, dim=1).cpu().numpy()
            
            # Update results and timestamps
            for idx, session_id in enumerate(session_ids_order):
                probs = probs_batch[idx]
                ready_sessions[session_id] = {
                    "down": float(probs[0]),
                    "neutral": float(probs[1]),
                    "up": float(probs[2])
                }
                self.last_inference_time[session_id] = current_time
            
            logger.info(f"Batch inference completed for {len(ready_sessions)} sessions")
            
        except Exception as e:
            logger.error(f"Batch inference error: {e}")
            return {}
        
        return ready_sessions
    
    def cleanup_session(self, session_id: str):
        """Clean up session buffer when session ends."""
        if session_id in self.session_buffers:
            del self.session_buffers[session_id]
            logger.info(f"Cleaned up model buffer for session {session_id}")
        
        if session_id in self.last_inference_time:
            del self.last_inference_time[session_id]
    
    def get_stats(self) -> dict:
        """Get inference service statistics."""
        return {
            "active_sessions": len(self.session_buffers),
            "device": str(self.device),
            "model_loaded": self.model is not None,
            "buffer_sizes": {sid: len(buf) for sid, buf in self.session_buffers.items()}
        }
