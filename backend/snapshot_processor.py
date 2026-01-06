"""
Snapshot Processing Service
Centralizes business logic for processing market snapshots
"""
import logging
from typing import Tuple, Optional, Dict, Any
from utils.data import sanitize

logger = logging.getLogger(__name__)


class SnapshotProcessor:
    """Service class for processing market snapshots with fallback logic"""
    
    def __init__(self, cpp_client=None, analytics_engine=None, max_failures: int = 5):
        self.cpp_client = cpp_client
        self.analytics_engine = analytics_engine
        self.max_failures = max_failures
        self.engine_mode = "cpp" if cpp_client else "python"
    
    def process(
        self, 
        snapshot: Dict[str, Any], 
        consecutive_failures: int
    ) -> Tuple[Dict[str, Any], float, str, int]:
        """
        Process a market snapshot using C++ engine with Python fallback.
        
        Args:
            snapshot: Raw market snapshot data
            consecutive_failures: Current count of consecutive C++ failures
            
        Returns:
            Tuple of (processed_data, processing_time, engine_used, updated_failure_count)
        """
        import time
        
        # Try C++ engine first if available
        if self.engine_mode == "cpp" and self.cpp_client and consecutive_failures < self.max_failures:
            try:
                start = time.time()
                processed = self.cpp_client.process_snapshot(snapshot)
                processing_time = (time.time() - start) * 1000
                
                # Reset failure count on success
                consecutive_failures = 0
                return sanitize(processed), processing_time, "cpp", consecutive_failures
                
            except Exception as e:
                consecutive_failures += 1
                logger.warning(
                    f"C++ engine failed ({consecutive_failures}/{self.max_failures}): {e}"
                )
                
                # Switch to Python permanently after max failures
                if consecutive_failures >= self.max_failures:
                    logger.error(
                        f"C++ engine exceeded max failures. Switching to Python permanently."
                    )
                    self.engine_mode = "python"
                    return self._process_with_python(snapshot, consecutive_failures, fallback=True)
                
                # Fallback to Python for this request
                return self._process_with_python(snapshot, consecutive_failures, fallback=True)
        
        # Use Python engine
        return self._process_with_python(snapshot, consecutive_failures, fallback=False)
    
    def _process_with_python(
        self, 
        snapshot: Dict[str, Any], 
        consecutive_failures: int,
        fallback: bool = False
    ) -> Tuple[Dict[str, Any], float, str, int]:
        """Process snapshot using Python analytics engine"""
        import time
        
        if not self.analytics_engine:
            raise RuntimeError("Analytics engine not initialized")
        
        start = time.time()
        processed = self.analytics_engine.process_snapshot(snapshot)
        processing_time = (time.time() - start) * 1000
        
        engine_name = "python_fallback" if fallback else "python"
        return sanitize(processed), processing_time, engine_name, consecutive_failures
    
    def set_cpp_client(self, client):
        """Update C++ client and switch mode"""
        self.cpp_client = client
        if client:
            self.engine_mode = "cpp"
            logger.info("Snapshot processor switched to C++ engine mode")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get processor statistics"""
        return {
            "engine_mode": self.engine_mode,
            "cpp_available": self.cpp_client is not None,
            "max_failures": self.max_failures
        }
