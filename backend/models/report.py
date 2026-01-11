from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class TradingReport(Base):
    __tablename__ = "trading_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    local_path = Column(String, nullable=False)
    s3_url = Column(String, nullable=True)
    
    # Trading statistics
    total_trades = Column(Integer, default=0)
    total_pnl = Column(Float, default=0.0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    win_rate = Column(Float, default=0.0)
    
    # Timestamps
    session_start = Column(DateTime, nullable=True)
    session_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to user
    # user = relationship("User", back_populates="trading_reports")