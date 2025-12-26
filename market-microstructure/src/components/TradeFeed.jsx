import React, { useMemo } from 'react';

export default function TradeFeed({ data }) {
  // Extract trades from snapshot history
  const trades = useMemo(() => {
    if (!data) return [];
    
    return data
      .filter(snap => snap.trade_classified && snap.trade_volume > 0)
      .map(snap => ({
        timestamp: snap.timestamp,
        price: snap.last_trade_price,
        volume: snap.trade_volume,
        side: snap.trade_side,
        effective_spread: snap.effective_spread,
        realized_spread: snap.realized_spread
      }))
      .reverse() // Newest first
      .slice(0, 50); // Keep last 50
  }, [data]);

  if (trades.length === 0) {
    return (
      <div className="panel-content empty-state">
        <div className="empty-text">No trades recorded yet</div>
      </div>
    );
  }

  return (
    <div className="trade-feed-container">
      <div className="trade-header">
        <div className="col time">Time</div>
        <div className="col price">Price</div>
        <div className="col vol">Vol</div>
        <div className="col side">Side</div>
        <div className="col spread">Eff. Spr</div>
      </div>
      
      <div className="trade-list">
        {trades.map((trade, i) => (
          <div key={`${trade.timestamp}-${i}`} className={`trade-row ${trade.side}`}>
            <div className="col time">
              {new Date(trade.timestamp).toLocaleTimeString([], { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}
            </div>
            <div className="col price">{trade.price.toFixed(2)}</div>
            <div className="col vol">{trade.volume}</div>
            <div className="col side">
              <span className={`badge ${trade.side}`}>
                {trade.side === 'buy' ? 'BUY' : 'SELL'}
              </span>
            </div>
            <div className="col spread">{trade.effective_spread?.toFixed(3) || '-'}</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .trade-feed-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          font-size: 0.8rem;
          overflow: hidden;
        }
        
        .trade-header {
          display: flex;
          padding: 8px 4px;
          border-bottom: 1px solid #374151;
          font-weight: 600;
          color: #9ca3af;
          font-size: 0.7rem;
          text-transform: uppercase;
        }
        
        .trade-list {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #4b5563 #1f2937;
        }
        
        .trade-row {
          display: flex;
          padding: 4px;
          border-bottom: 1px solid #1f2937;
          transition: background-color 0.2s;
        }
        
        .trade-row:hover {
          background-color: #1f2937;
        }
        
        .trade-row.buy .price { color: #4ade80; }
        .trade-row.sell .price { color: #f87171; }
        
        .col {
          flex: 1;
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 0 4px;
        }
        
        .col.time { flex: 1.2; text-align: left; color: #6b7280; }
        .col.side { flex: 0.8; text-align: center; }
        
        .badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 700;
        }
        
        .badge.buy { background-color: rgba(74, 222, 128, 0.2); color: #4ade80; }
        .badge.sell { background-color: rgba(248, 113, 113, 0.2); color: #f87171; }
        
        .panel-content.empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
