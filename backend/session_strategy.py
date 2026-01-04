
import logging
from typing import Dict
from strategy_service import StrategyEngine

logger = logging.getLogger(__name__)

class SessionStrategyManager:
    """Manages individual strategy instances per session."""
    
    def __init__(self):
        self.strategies: Dict[str, StrategyEngine] = {}
    
    def get_or_create(self, session_id: str) -> StrategyEngine:
        """Get existing strategy or create new one for session."""
        if session_id not in self.strategies:
            self.strategies[session_id] = StrategyEngine()
            logger.info(f"Created strategy engine for session {session_id}")
        return self.strategies[session_id]
    
    def cleanup_session(self, session_id: str):
        """Clean up strategy when session ends."""
        if session_id in self.strategies:
            del self.strategies[session_id]
            logger.info(f"Cleaned up strategy for session {session_id}")
    
    def get_stats(self) -> dict:
        """Get statistics for all strategies."""
        return {
            "active_strategies": len(self.strategies),
            "sessions": {
                sid: {
                    "pnl": strategy.pnl,
                    "position": strategy.position,
                    "is_active": strategy.is_active,
                    "trades": len(strategy.trades)
                }
                for sid, strategy in self.strategies.items()
            }
        }
