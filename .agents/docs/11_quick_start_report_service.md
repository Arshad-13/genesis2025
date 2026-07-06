# Quick Start: CSV Reports System

## 🚀 How to Generate and View Trading Reports

### Step 1: Start Trading
1. Go to **MarketPredict** page
2. Click **"START ENGINE"** button
3. Watch execution logs appear in real-time
4. Let the system trade for your desired duration

### Step 2: Stop Trading & Generate Report
1. Click **"STOP ENGINE"** button
2. System automatically generates CSV file
3. File is saved locally and uploaded to S3 (if configured)
4. You'll see confirmation in the API response

### Step 3: View Reports
1. Navigate to **Reports** page (sidebar menu)
2. See all your trading sessions with statistics:
   - Total P&L (profit/loss)
   - Number of trades
   - Win rate percentage
   - Session duration
3. Click **"Download"** to get the CSV file

## 📊 What's in the CSV File?

Each CSV contains your complete execution log:
```csv
id,timestamp,side,price,size,type,pnl,confidence
1,2024-01-15T14:30:00,BUY,45250.00,1.0,ENTRY,0.0,0.85
2,2024-01-15T14:35:00,SELL,45350.00,1.0,EXIT,100.0,0
```

## ⚙️ Optional: AWS S3 Setup

Add to `backend/.env` for cloud storage:
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=your-bucket
```

## 🎯 Key Benefits

- **Automatic**: No manual export needed
- **Complete**: Every trade captured
- **Analyzed**: Statistics calculated automatically  
- **Accessible**: Download anytime from Reports page
- **Secure**: Cloud backup with local fallback

## 🔍 Troubleshooting

**No reports showing?**
- Ensure backend server is running
- Check if you've stopped the engine (reports generate on stop)
- Verify `backend/reports/` folder exists

**Download not working?**
- Check file permissions
- Ensure CSV file exists in reports directory

---
*For detailed technical documentation, see [CSV_REPORTS_SYSTEM.md](CSV_REPORTS_SYSTEM.md)*