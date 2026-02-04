import React from "react";

export default function PriceLadder({ snapshot }) {
  if (!snapshot || !snapshot.bids || !snapshot.asks) {
    return (
      <div>
        <h4
          style={{
            margin: "0 0 16px 0",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#e5e7eb",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Price Ladder
        </h4>
        <div className="loading">Waiting for data...</div>
      </div>
    );
  }

  // Get liquidity gap information
  const liquidityGaps =
    snapshot.anomalies?.filter((a) => a.type === "LIQUIDITY_GAP") || [];
  const hasLiquidityGaps = liquidityGaps.length > 0;
  const gapLevels = hasLiquidityGaps
    ? liquidityGaps[0].affected_levels || []
    : [];

  // Combine bids and asks into a single sorted list for the ladder
  // We'll take top 10 levels of each
  const bids = snapshot.bids.slice(0, 10).map(([price, vol], index) => ({
    price,
    vol,
    type: "bid",
    level: index + 1,
    isGap: gapLevels.includes(index + 1) && vol < 50,
  }));
  const asks = snapshot.asks.slice(0, 10).map(([price, vol], index) => ({
    price,
    vol,
    type: "ask",
    level: index + 1,
    isGap: gapLevels.includes(index + 1) && vol < 50,
  }));

  // Sort asks descending (highest price on top)
  asks.sort((a, b) => b.price - a.price);

  // Bids are already descending usually, but let's ensure
  bids.sort((a, b) => b.price - a.price);

  const maxVol = Math.max(
    ...bids.map((b) => b.vol),
    ...asks.map((a) => a.vol),
    1, // avoid div by zero
  );

  const getLevelStyle = (level) => {
    if (level.isGap) {
      return {
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        animation: "gapPulse 2s infinite",
      };
    }
    return {};
  };

  return (
    <div
      style={{
        transform: "scale(0.8)",
        transformOrigin: "top left",
        width: "124%",
        height: "125%",
      }}
    >
      <div>
        {/* <h4
          style={{
            margin: "0 0 6px 0",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#e5e7eb",
            textTransform: "uppercase",
            letterSpacing: "0.2px",
          }}
        >
          Price Ladder{" "}
          {hasLiquidityGaps && (
            <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>
              ⚠️ GAPS
            </span>
          )}
        </h4> */}
        <div className="ladder-container">
          {/* Asks (Red) */}
          {asks.map((level, i) => (
            <div
              key={`ask-${i}`}
              className="ladder-row"
              style={getLevelStyle(level)}
            >
              <div className="price-cell">
                {level.price.toFixed(2)}
                {level.isGap && (
                  <span
                    style={{
                      color: "#ef4444",
                      marginLeft: "4px",
                      fontSize: "0.7rem",
                    }}
                  >
                    💧
                  </span>
                )}
              </div>
              <div className="vol-cell">
                <div
                  className={`vol-bar ask ${level.isGap ? "gap" : ""}`}
                  style={{ width: `${(level.vol / maxVol) * 100}%` }}
                />
                <span className={`vol-text ${level.isGap ? "gap-text" : ""}`}>
                  {level.vol}
                </span>
              </div>
            </div>
          ))}

          {/* Spread Indicator */}
          <div
            className="spread-row"
            style={{
              textAlign: "center",
              padding: "8px 0",
              fontSize: "0.8rem",
              color: "#9ca3af",
              borderTop: "1px solid #374151",
              borderBottom: "1px solid #374151",
              margin: "4px 0",
            }}
          >
            Spread: {(asks[asks.length - 1].price - bids[0].price).toFixed(2)}
          </div>

          {/* Bids (Green) */}
          {bids.map((level, i) => (
            <div
              key={`bid-${i}`}
              className="ladder-row"
              style={getLevelStyle(level)}
            >
              <div className="price-cell">
                {level.price.toFixed(2)}
                {level.isGap && (
                  <span
                    style={{
                      color: "#ef4444",
                      marginLeft: "4px",
                      fontSize: "0.7rem",
                    }}
                  >
                    💧
                  </span>
                )}
              </div>
              <div className="vol-cell">
                <div
                  className={`vol-bar bid ${level.isGap ? "gap" : ""}`}
                  style={{ width: `${(level.vol / maxVol) * 100}%` }}
                />
                <span className={`vol-text ${level.isGap ? "gap-text" : ""}`}>
                  {level.vol}
                </span>
              </div>
            </div>
          ))}
        </div>

        <style jsx>{`
          @keyframes gapPulse {
            0%,
            100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
          .vol-bar.gap {
            background-color: rgba(239, 68, 68, 0.6) !important;
          }
          .vol-text.gap-text {
            color: #ef4444 !important;
            font-weight: bold;
          }
        `}</style>
      </div>
    </div>
  );
}
