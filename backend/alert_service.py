import logging
from datetime import datetime
from typing import List, Dict
import threading
from models.alert import CustomAlertRule, CustomAlertHistory
from utils.database import SessionLocal

logger = logging.getLogger(__name__)

class AlertSystem:
    def __init__(self):
        # Memory cache of active rules: session_id -> list of rule dicts
        self.rules_cache: Dict[str, List[dict]] = {}
        self._lock = threading.Lock()

    def load_rules_for_session(self, session_id: str):
        """Load rules from database into cache."""
        if SessionLocal is None:
            return
        
        db = SessionLocal()
        try:
            rules = db.query(CustomAlertRule).filter(
                CustomAlertRule.session_id == session_id,
                CustomAlertRule.is_active == True
            ).all()
            
            with self._lock:
                self.rules_cache[session_id] = [
                    {
                        "id": r.id,
                        "metric_name": r.metric_name,
                        "operator": r.operator,
                        "threshold_value": r.threshold_value
                    }
                    for r in rules
                ]
            logger.info(f"Loaded {len(rules)} alert rules for session {session_id}")
        except Exception as e:
            logger.error(f"Error loading rules for session {session_id}: {e}")
        finally:
            db.close()

    def add_rule(self, session_id: str, metric_name: str, operator: str, threshold_value: float) -> dict:
        """Add a new alert rule."""
        rule_data = {
            "session_id": session_id,
            "metric_name": metric_name,
            "operator": operator,
            "threshold_value": threshold_value,
            "is_active": True
        }
        
        if SessionLocal is not None:
            db = SessionLocal()
            try:
                rule = CustomAlertRule(**rule_data)
                db.add(rule)
                db.commit()
                db.refresh(rule)
                rule_data["id"] = rule.id
            except Exception as e:
                logger.error(f"Failed to persist alert rule: {e}")
                rule_data["id"] = 999  # Fallback ID
            finally:
                db.close()
        else:
            rule_data["id"] = 999
            
        # Update cache
        with self._lock:
            if session_id not in self.rules_cache:
                self.rules_cache[session_id] = []
            self.rules_cache[session_id].append({
                "id": rule_data["id"],
                "metric_name": metric_name,
                "operator": operator,
                "threshold_value": threshold_value
            })
            
        return rule_data

    def get_rules(self, session_id: str) -> List[dict]:
        with self._lock:
            return self.rules_cache.get(session_id, [])

    def clear_rules(self, session_id: str):
        with self._lock:
            if session_id in self.rules_cache:
                self.rules_cache[session_id] = []
                
        if SessionLocal is not None:
            db = SessionLocal()
            try:
                db.query(CustomAlertRule).filter(CustomAlertRule.session_id == session_id).delete()
                db.commit()
            except Exception as e:
                logger.error(f"Failed to clear database alert rules: {e}")
            finally:
                db.close()

    def evaluate(self, session_id: str, snapshot: dict) -> List[dict]:
        """Evaluate snapshot features against active rules. Returns triggered alerts."""
        triggered = []
        
        with self._lock:
            rules = self.rules_cache.get(session_id, [])
            
        if not rules:
            return triggered

        for rule in rules:
            metric = rule["metric_name"]
            if metric not in snapshot:
                continue
                
            val = float(snapshot[metric])
            threshold = float(rule["threshold_value"])
            op = rule["operator"]
            
            is_triggered = False
            if op == ">":
                is_triggered = val > threshold
            elif op == "<":
                is_triggered = val < threshold
            elif op == "==":
                is_triggered = abs(val - threshold) < 1e-6
                
            if is_triggered:
                msg = f"Alert: {metric} {op} {threshold} (Actual: {val:.4f})"
                alert_event = {
                    "rule_id": rule["id"],
                    "metric_name": metric,
                    "actual_value": val,
                    "threshold_value": threshold,
                    "message": msg,
                    "timestamp": datetime.utcnow().isoformat()
                }
                triggered.append(alert_event)
                
                # Persist to database in a separate task/thread to avoid blocking loop
                if SessionLocal is not None:
                    threading.Thread(
                        target=self._persist_history,
                        args=(session_id, rule["id"], metric, val, threshold, msg),
                        daemon=True
                    ).start()
                    
        return triggered

    def _persist_history(self, session_id: str, rule_id: int, metric_name: str, 
                         actual_val: float, threshold_val: float, message: str):
        db = SessionLocal()
        try:
            hist = CustomAlertHistory(
                session_id=session_id,
                rule_id=rule_id,
                metric_name=metric_name,
                actual_value=actual_val,
                threshold_value=threshold_val,
                message=message,
                timestamp=datetime.utcnow()
            )
            db.add(hist)
            db.commit()
        except Exception as e:
            logger.error(f"Error saving alert history to database: {e}")
        finally:
            db.close()

    def get_history(self, session_id: str, limit: int = 50) -> List[dict]:
        if SessionLocal is None:
            return []
            
        db = SessionLocal()
        try:
            hists = db.query(CustomAlertHistory).filter(
                CustomAlertHistory.session_id == session_id
            ).order_by(CustomAlertHistory.timestamp.desc()).limit(limit).all()
            
            return [
                {
                    "id": h.id,
                    "metric_name": h.metric_name,
                    "actual_value": h.actual_value,
                    "threshold_value": h.threshold_value,
                    "message": h.message,
                    "timestamp": h.timestamp.isoformat()
                }
                for h in hists
            ]
        except Exception as e:
            logger.error(f"Error getting alert history: {e}")
            return []
        finally:
            db.close()
