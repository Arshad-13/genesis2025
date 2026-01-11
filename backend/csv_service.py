import csv
import os
import boto3
from datetime import datetime
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class CSVReportService:
    def __init__(self):
        self.s3_client = None
        self.bucket_name = os.getenv('S3_BUCKET_NAME')
        self.reports_dir = "reports"
        
        # Initialize S3 client if credentials are available
        try:
            if all([os.getenv('AWS_ACCESS_KEY_ID'), os.getenv('AWS_SECRET_ACCESS_KEY'), self.bucket_name]):
                self.s3_client = boto3.client(
                    's3',
                    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                    region_name=os.getenv('AWS_REGION', 'us-east-1')
                )
                logger.info("S3 client initialized successfully")
            else:
                logger.warning("S3 credentials not configured, using local storage only")
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {e}")
            self.s3_client = None
    
    def generate_trades_csv(self, session_id: str, trades: List[Dict], strategy_stats: Dict, user_id: Optional[int] = None) -> Dict:
        """Generate CSV report from trades data"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"trades_{session_id}_{timestamp}.csv"
        local_path = os.path.join(self.reports_dir, filename)
        
        # Ensure reports directory exists
        os.makedirs(self.reports_dir, exist_ok=True)
        
        # Calculate summary stats
        total_trades = len(trades)
        total_pnl = strategy_stats.get('realized', 0.0)
        winning_trades = len([t for t in trades if t.get('pnl', 0) > 0])
        losing_trades = len([t for t in trades if t.get('pnl', 0) < 0])
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        # Write CSV file
        try:
            with open(local_path, 'w', newline='') as csvfile:
                fieldnames = ['id', 'timestamp', 'side', 'price', 'size', 'type', 'pnl', 'confidence']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                writer.writeheader()
                for trade in trades:
                    writer.writerow({
                        'id': trade.get('id', ''),
                        'timestamp': trade.get('timestamp', ''),
                        'side': trade.get('side', ''),
                        'price': trade.get('price', 0),
                        'size': trade.get('size', 0),
                        'type': trade.get('type', ''),
                        'pnl': trade.get('pnl', 0),
                        'confidence': trade.get('confidence', 0)
                    })
            
            logger.info(f"CSV report generated: {local_path}")
            
            # Upload to S3 if available
            s3_url = None
            if self.s3_client and self.bucket_name:
                try:
                    s3_key = f"trading-reports/{filename}"
                    self.s3_client.upload_file(local_path, self.bucket_name, s3_key)
                    s3_url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
                    logger.info(f"CSV uploaded to S3: {s3_url}")
                except Exception as e:
                    logger.error(f"Failed to upload to S3: {e}")
            
            return {
                "filename": filename,
                "local_path": local_path,
                "s3_url": s3_url,
                "timestamp": timestamp,
                "session_id": session_id,
                "user_id": user_id,
                "stats": {
                    "total_trades": total_trades,
                    "total_pnl": round(total_pnl, 2),
                    "winning_trades": winning_trades,
                    "losing_trades": losing_trades,
                    "win_rate": round(win_rate, 1)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate CSV report: {e}")
            raise
    
    def parse_csv_stats(self, filepath: str) -> Dict:
        """Parse CSV file to extract trading statistics"""
        try:
            stats = {
                "total_trades": 0,
                "total_pnl": 0.0,
                "winning_trades": 0,
                "losing_trades": 0,
                "win_rate": 0.0,
                "first_trade": None,
                "last_trade": None
            }
            
            with open(filepath, 'r') as csvfile:
                reader = csv.DictReader(csvfile)
                trades = list(reader)
                
                if not trades:
                    return stats
                
                stats["total_trades"] = len(trades)
                
                # Calculate P&L and win/loss stats
                total_pnl = 0.0
                winning_trades = 0
                losing_trades = 0
                
                for trade in trades:
                    pnl = float(trade.get('pnl', 0))
                    total_pnl += pnl
                    
                    if pnl > 0:
                        winning_trades += 1
                    elif pnl < 0:
                        losing_trades += 1
                
                stats["total_pnl"] = round(total_pnl, 2)
                stats["winning_trades"] = winning_trades
                stats["losing_trades"] = losing_trades
                stats["win_rate"] = round((winning_trades / len(trades) * 100), 1) if trades else 0
                
                # Get first and last trade timestamps
                if trades:
                    stats["first_trade"] = trades[0].get('timestamp')
                    stats["last_trade"] = trades[-1].get('timestamp')
                
            return stats
            
        except Exception as e:
            logger.error(f"Failed to parse CSV stats from {filepath}: {e}")
            return {
                "total_trades": 0,
                "total_pnl": 0.0,
                "winning_trades": 0,
                "losing_trades": 0,
                "win_rate": 0.0,
                "first_trade": None,
                "last_trade": None
            }

# Global instance
csv_service = CSVReportService()