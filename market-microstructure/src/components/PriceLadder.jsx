import React from 'react';

export default function PriceLadder({ snapshot }) {
  if (!snapshot || !snapshot.bids || !snapshot.asks) {
    return (
      <div>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price Ladder</h4>
        <div className="loading">Waiting for data...</div>
      </div>
    );
  }

  // Combine bids and asks into a single sorted list for the ladder
  // We'll take top 10 levels of each
  const bids = snapshot.bids.slice(0, 10).map(([price, vol]) => ({ price, vol, type: 'bid' }));
  const asks = snapshot.asks.slice(0, 10).map(([price, vol]) => ({ price, vol, type: 'ask' }));
  
  // Sort asks descending (highest price on top)
  asks.sort((a, b) => b.price - a.price);
  
  // Bids are already descending usually, but let's ensure
  bids.sort((a, b) => b.price - a.price);

  const maxVol = Math.max(
    ...bids.map(b => b.vol),
    ...asks.map(a => a.vol),
    1 // avoid div by zero
  );

  return (
    <div>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price Ladder</h4>
      <div className="ladder-container">
        {/* Asks (Red) */}
        {asks.map((level, i) => (
          <div key={`ask-${i}`} className="ladder-row">
            <div className="price-cell">{level.price.toFixed(2)}</div>
            <div className="vol-cell">
              <div 
                className="vol-bar ask" 
                style={{ width: `${(level.vol / maxVol) * 100}%` }}
              />
              <span className="vol-text">{level.vol}</span>
            </div>
          </div>
        ))}
        
        {/* Spread Indicator */}
        <div className="spread-row" style={{ textAlign: 'center', padding: '8px 0', fontSize: '0.8rem', color: '#9ca3af', borderTop: '1px solid #374151', borderBottom: '1px solid #374151', margin: '4px 0' }}>
            Spread: {(asks[asks.length-1].price - bids[0].price).toFixed(2)}
        </div>

        {/* Bids (Green) */}
        {bids.map((level, i) => (
          <div key={`bid-${i}`} className="ladder-row">
            <div className="price-cell">{level.price.toFixed(2)}</div>
            <div className="vol-cell">
              <div 
                className="vol-bar bid" 
                style={{ width: `${(level.vol / maxVol) * 100}%` }}
              />
              <span className="vol-text">{level.vol}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}