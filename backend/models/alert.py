from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey
from datetime import datetime
from utils.database import Base

class CustomAlertRule(Base):
    __tablename__ = "custom_alert_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    metric_name = Column(String, nullable=False)
    operator = Column(String, nullable=False)  # ">", "<", "=="
    threshold_value = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CustomAlertHistory(Base):
    __tablename__ = "custom_alert_history"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    rule_id = Column(Integer, nullable=True)
    metric_name = Column(String, nullable=False)
    actual_value = Column(Float, nullable=False)
    threshold_value = Column(Float, nullable=False)
    message = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
