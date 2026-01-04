import asyncio
import logging
from typing import Dict, Optional
from datetime import datetime
from collections import deque
import queue

logger = logging.getLogger(__name__)


class UserSession:
    """Individual user's replay session."""
    
    def __init__(self, session_id: str, user_id: Optional[int] = None):
        self.session_id = session_id
        self.user_id = user_id
        self.state = "STOPPED"  # STOPPED, PLAYING, PAUSED
        self.speed = 1
        self.cursor_ts = None
        self.data_buffer = deque(maxlen=100)
        self.replay_buffer = deque()
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        
        # Session-specific queues
        self.raw_snapshot_queue = queue.Queue(maxsize=2000)
        self.processed_snapshot_queue = queue.Queue(maxsize=2000)
    
    def start(self):
        """Start replay."""
        self.state = "PLAYING"
        self.last_activity = datetime.now()
        logger.info(f"Session {self.session_id}: Started")
    
    def pause(self):
        """Pause replay."""
        if self.state == "PLAYING":
            self.state = "PAUSED"
            self.last_activity = datetime.now()
            logger.info(f"Session {self.session_id}: Paused")
    
    def resume(self):
        """Resume replay."""
        if self.state == "PAUSED":
            self.state = "PLAYING"
            self.last_activity = datetime.now()
            logger.info(f"Session {self.session_id}: Resumed")
    
    def stop(self):
        """Stop replay."""
        self.state = "STOPPED"
        self.cursor_ts = None
        self.data_buffer.clear()
        self.replay_buffer.clear()
        self.last_activity = datetime.now()
        logger.info(f"Session {self.session_id}: Stopped")
    
    def set_speed(self, speed: int):
        """Set replay speed."""
        self.speed = max(1, min(speed, 10))
        self.last_activity = datetime.now()
        logger.info(f"Session {self.session_id}: Speed set to {self.speed}x")
    
    def go_back(self, seconds: float) -> bool:
        """Rewind replay by specified seconds."""
        if self.cursor_ts:
            from datetime import timedelta
            self.cursor_ts = self.cursor_ts - timedelta(seconds=seconds)
            self.replay_buffer.clear()
            self.data_buffer.clear()
            self.last_activity = datetime.now()
            logger.info(f"Session {self.session_id}: Rewound by {seconds}s")
            return True
        return False
    
    def get_state(self) -> dict:
        """Get session state."""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "state": self.state,
            "speed": self.speed,
            "cursor_ts": self.cursor_ts.isoformat() if self.cursor_ts else None,
            "buffer_size": len(self.data_buffer),
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat()
        }
    
    def is_active(self) -> bool:
        """Check if session is still active (activity in last 30 minutes)."""
        from datetime import timedelta
        return (datetime.now() - self.last_activity) < timedelta(minutes=30)


class SessionManager:
    """Manages all user sessions."""
    
    def __init__(self):
        self.sessions: Dict[str, UserSession] = {}
        self._lock = asyncio.Lock()
    
    async def create_session(self, session_id: str, user_id: Optional[int] = None) -> UserSession:
        """Create a new session."""
        async with self._lock:
            if session_id in self.sessions:
                logger.warning(f"Session {session_id} already exists, returning existing")
                return self.sessions[session_id]
            
            session = UserSession(session_id, user_id)
            self.sessions[session_id] = session
            logger.info(f"Created session {session_id} for user {user_id}")
            return session
    
    async def get_session(self, session_id: str) -> Optional[UserSession]:
        """Get existing session."""
        return self.sessions.get(session_id)
    
    async def delete_session(self, session_id: str):
        """Delete a session."""
        async with self._lock:
            if session_id in self.sessions:
                session = self.sessions[session_id]
                session.stop()
                del self.sessions[session_id]
                logger.info(f"Deleted session {session_id}")
    
    async def cleanup_inactive_sessions(self):
        """Remove inactive sessions (called periodically)."""
        async with self._lock:
            inactive = [
                sid for sid, session in self.sessions.items()
                if not session.is_active()
            ]
            
            for sid in inactive:
                logger.info(f"Cleaning up inactive session {sid}")
                self.sessions[sid].stop()
                del self.sessions[sid]
            
            if inactive:
                logger.info(f"Cleaned up {len(inactive)} inactive sessions")
    
    def get_stats(self) -> dict:
        """Get session statistics."""
        return {
            "total_sessions": len(self.sessions),
            "active_sessions": sum(1 for s in self.sessions.values() if s.state == "PLAYING"),
            "paused_sessions": sum(1 for s in self.sessions.values() if s.state == "PAUSED"),
            "sessions": [s.get_state() for s in self.sessions.values()]
        }