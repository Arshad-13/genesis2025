# CSV Reports System Documentation

## Overview

The CSV Reports System automatically captures and stores trading execution logs when users run the prediction engine. When the engine is stopped, all trades are exported to CSV files with detailed statistics and uploaded to cloud storage.

## 🎯 Key Features

- **Automatic CSV Generation**: Creates CSV files when prediction engine stops
- **Real-time Execution Logs**: Captures all trades shown in MarketPredict interface
- **Cloud Storage Integration**: Uploads to AWS S3 (with local fallback)
- **Statistical Analysis**: Calculates P&L, win rates, trade counts automatically
- **User-friendly Interface**: Browse and download reports via Reports page
- **Session-based Tracking**: Each trading session gets its own report

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MarketPredict │    │  Strategy Engine │    │  CSV Service    │
│      Page       │───▶│   (Backend)      │───▶│   Generator     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        ▼
         │                        │              ┌─────────────────┐
         │                        │              │   Local Storage │
         │                        │              │  /backend/reports/│
         │                        │              └─────────────────┘
         │                        │                        │
         │                        │                        ▼
         │                        │              ┌─────────────────┐
         │                        │              │   AWS S3 Bucket │
         │                        │              │ (if configured) │
         │                        │              └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────┐
│  Reports Page   │◀───│  Reports API     │
│   (Frontend)    │    │   (Backend)      │
└─────────────────┘    └──────────────────┘
```

## 📋 Workflow

### 1. Start Trading Session
```
User clicks "START ENGINE" → Strategy engine activates → Trades begin executing
```

### 2. Execution Logs Capture
- All trades are stored in `strategy.trades[]` array
- Each trade contains: `id`, `timestamp`, `side`, `price`, `size`, `type`, `pnl`, `confidence`
- Trades appear in real-time in MarketPredict execution logs table

### 3. Stop Trading Session
```
User clicks "STOP ENGINE" → CSV generation triggered → File saved & uploaded
```

### 4. View Reports
```
User visits Reports page → API fetches all CSV files → Statistics displayed
```

## 📁 File Structure

```
backend/
├── csv_service.py          # CSV generation and S3 upload logic
├── strategy_service.py     # Trade execution and tracking
├── main.py                 # API endpoints for reports
├── models/report.py        # Database model (future enhancement)
└── reports/                # Local CSV storage directory
    ├── trades_session1_20240115_143000.csv
    ├── trades_session2_20240115_150000.csv
    └── ...

market-microstructure/src/
├── pages/Reports.jsx       # Reports interface
└── pages/MarketPredict.jsx # Trading interface with execution logs
```

## 📊 CSV File Format

Each CSV file contains the complete execution log with the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| `id` | Trade sequence number | `1`, `2`, `3` |
| `timestamp` | ISO timestamp of trade | `2024-01-15T14:30:00` |
| `side` | Trade direction | `BUY`, `SELL` |
| `price` | Execution price | `45250.00` |
| `size` | Trade size | `1.0` |
| `type` | Trade type | `ENTRY`, `EXIT` |
| `pnl` | Profit/Loss for this trade | `100.0`, `-50.0`, `0.0` |
| `confidence` | Model confidence (0-1) | `0.85` |

### Sample CSV Content:
```csv
id,timestamp,side,price,size,type,pnl,confidence
1,2024-01-15T14:30:00,BUY,45250.00,1.0,ENTRY,0.0,0.85
2,2024-01-15T14:35:00,SELL,45350.00,1.0,EXIT,100.0,0
3,2024-01-15T14:40:00,SELL,45200.00,1.0,ENTRY,0.0,0.78
4,2024-01-15T14:45:00,BUY,45150.00,1.0,EXIT,50.0,0
```

## 🔧 Configuration

### AWS S3 Setup (Optional)

Add these environment variables to `backend/.env`:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-trading-reports-bucket
```

### Local Storage (Default)

If S3 is not configured, files are stored locally in:
```
backend/reports/trades_sessionid_timestamp.csv
```

## 🚀 API Endpoints

### GET /reports
Returns list of all generated CSV reports with statistics.

**Response:**
```json
{
  "reports": [
    {
      "filename": "trades_session1_20240115_143000.csv",
      "session_id": "session1",
      "timestamp": "143000",
      "created_at": "2024-01-15T14:30:00.000Z",
      "file_size": 1024,
      "download_url": "/reports/download/trades_session1_20240115_143000.csv",
      "stats": {
        "total_trades": 25,
        "total_pnl": 150.50,
        "winning_trades": 15,
        "losing_trades": 10,
        "win_rate": 60.0,
        "first_trade": "2024-01-15T14:30:00",
        "last_trade": "2024-01-15T15:00:00"
      },
      "duration": "30m"
    }
  ]
}
```

### GET /reports/download/{filename}
Downloads a specific CSV file.

**Parameters:**
- `filename`: CSV filename (must start with `trades_` and end with `.csv`)

**Response:** CSV file download

### POST /strategy/{session_id}/stop
Stops the trading engine and generates CSV report.

**Response:**
```json
{
  "status": "stopped",
  "session_id": "session1",
  "is_active": false,
  "report": {
    "filename": "trades_session1_20240115_143000.csv",
    "local_path": "reports/trades_session1_20240115_143000.csv",
    "s3_url": "https://bucket.s3.amazonaws.com/trading-reports/trades_session1_20240115_143000.csv",
    "stats": {
      "total_trades": 25,
      "total_pnl": 150.50,
      "winning_trades": 15,
      "losing_trades": 10,
      "win_rate": 60.0
    }
  }
}
```

## 🎨 Frontend Interface

### Reports Page Features

1. **Summary Dashboard**
   - Total Sessions
   - Overall P&L
   - Total Trades
   - Average Win Rate
   - Average Session Duration

2. **Reports Table**
   - Timestamp
   - Total P&L (color-coded: green for profit, red for loss)
   - Trade Count
   - Win Rate
   - Session Duration
   - Download Button

3. **Real-time Updates**
   - Automatically refreshes when new reports are generated
   - Shows file sizes and creation timestamps

### Navigation
- Access via sidebar: **Reports** menu item
- Requires authentication (protected route)
- Cyber-finance theme consistent with rest of application

## 🔍 Statistics Calculation

### Automatic Metrics
- **Total P&L**: Sum of all trade PnL values
- **Win Rate**: (Winning trades / Total trades) × 100
- **Session Duration**: Time between first and last trade
- **Trade Classification**: 
  - Winning: PnL > 0
  - Losing: PnL < 0
  - Neutral: PnL = 0

### Aggregated Statistics
The Reports page shows both individual session stats and aggregated metrics across all sessions.

## 🛠️ Technical Implementation

### Backend Components

1. **CSVReportService** (`csv_service.py`)
   - Generates CSV files from trade data
   - Handles S3 uploads with local fallback
   - Parses existing CSV files for statistics

2. **StrategyEngine** (`strategy_service.py`)
   - Tracks all trades in `trades[]` array
   - Provides trade data to CSV service when stopped

3. **Reports API** (`main.py`)
   - Lists all generated reports
   - Provides download functionality
   - Integrates with strategy stop endpoint

### Frontend Components

1. **Reports.jsx**
   - Main reports interface
   - Fetches data from backend API
   - Handles CSV downloads

2. **MarketPredict.jsx**
   - Shows real-time execution logs
   - Triggers CSV generation on engine stop

## 🚨 Error Handling

### Common Issues & Solutions

1. **Empty Reports List**
   - Check if backend server is running
   - Verify `backend/reports/` directory exists
   - Ensure CSV files have correct naming pattern: `trades_*_*.csv`

2. **S3 Upload Failures**
   - Verify AWS credentials in `.env` file
   - Check S3 bucket permissions
   - System falls back to local storage automatically

3. **CSV Parsing Errors**
   - Ensure CSV files have correct headers
   - Check for corrupted or incomplete files
   - System skips problematic files and logs errors

### Debug Endpoints

For troubleshooting, temporary debug endpoints can be added:
```
GET /test-reports-debug  # Check file system status
GET /test-csv-parsing    # Test CSV parsing functionality
```

## 📈 Future Enhancements

### Planned Features
1. **Database Integration**
   - Store report metadata in database
   - User-specific report filtering
   - Advanced search and filtering

2. **Enhanced Analytics**
   - Sharpe ratio calculation
   - Maximum drawdown analysis
   - Performance benchmarking

3. **Export Options**
   - PDF report generation
   - Excel format export
   - Email report delivery

4. **Real-time Notifications**
   - WebSocket updates when reports are generated
   - Email notifications for significant P&L events

## 🔐 Security Considerations

1. **File Access Control**
   - Only authenticated users can access reports
   - Filename validation prevents directory traversal
   - Session-based access control (future enhancement)

2. **S3 Security**
   - Use IAM roles with minimal required permissions
   - Enable S3 bucket encryption
   - Configure proper CORS settings

3. **Data Privacy**
   - CSV files contain trading data only
   - No personal information stored in reports
   - Secure file transmission over HTTPS

## 📞 Support

For issues or questions regarding the CSV Reports System:

1. Check the execution logs in MarketPredict page
2. Verify backend server logs for errors
3. Ensure proper AWS configuration if using S3
4. Review this documentation for troubleshooting steps

---

**Last Updated:** January 2026  
**Version:** 1.0  
**Status:** Production Ready ✅