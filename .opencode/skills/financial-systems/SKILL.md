# Financial Market Microstructure Skill — HFT / Order Book / Trading

You are working with a **cryptocurrency market microstructure** platform. This skill provides domain knowledge for understanding the data, features, and trading logic.

## Market Data Fundamentals

### Order Book (Level 2)
A sorted list of buy (bid) and sell (ask) orders at different price levels:
```
Asks (Sell): [[42351.00, 1.5], [42351.50, 2.1], ...]  ← ascending prices
Bids (Buy):  [[42350.00, 1.2], [42349.50, 1.8], ...]  ← descending prices
```
Each level is `[price, volume]`. **Best bid** = highest buy price. **Best ask** = lowest sell price.

### Key Metrics

| Metric | Formula | Range | Meaning |
|---|---|---|---|
| **Mid-price** | (BestBid + BestAsk) / 2 | — | Fair price midpoint |
| **Spread** | BestAsk - BestBid | > 0 | Cost of immediate execution |
| **OFI** (Order Flow Imbalance) | Δ(BidVol) - Δ(AskVol) | [-1, 1] | Aggressive buying/selling pressure |
| **OBI** (Order Book Imbalance) | (BidVol - AskVol) / TotalVol | [-1, 1] | Volume-weighted directional bias |
| **Microprice** | (BidQ × AskPx + AskQ × BidPx) / TotalQ | — | Volume-weighted fair price |
| **Divergence** | Microprice - MidPrice | — | Sign predicts short-term price direction |
| **VPIN** | Avg(\|BuyVol - SellVol\| / TotalVol) over buckets | [0, 1] | Probability of informed trading |

### Market Regimes
| Regime | Index | Characteristics | Spread | Volatility | OFI |
|---|---|---|---|---|---|
| Calm | 0 | Normal, tight spreads, balanced | Normal | Low | ≈0 |
| Stressed | 1 | Wide spreads, moderate volatility | >2σ from avg | Moderate | Moderate |
| Execution Hot | 2 | Large orders, high activity | Normal/wide | High | Strong |
| Manipulation Suspected | 3 | Multiple anomalies detected | Wide | High | Extreme |

## Anomaly Detection (Market Manipulation)

### 1. Spoofing
Placing large non-bona fide orders to create a false impression of supply/demand, then canceling before execution.
- **Detection**: Volume volatility + order size relative to EWMA average
- **Risk score**: 0-100% based on volatility, frequency, and size

### 2. Layering
Stacking multiple large orders at different price levels to fake market depth.
- **Detection**: Count levels with volume > 2× EWMA average
- **Trigger**: 3+ large orders on one side, significantly more than the other

### 3. Quote Stuffing
Flooding the market with rapid order submissions/cancellations to slow competitors.
- **Detection**: Order update rate per second (z-score vs historical average)
- **Trigger**: >20 updates/sec AND >3× average rate

### 4. Momentum Ignition
Executing aggressive trades to trigger algorithmic momentum strategies.
- **Detection**: Price momentum (3 consecutive moves in same direction) + elevated volume
- **Trigger**: >0.2% price move + >2.5× EWMA volume

### 5. Wash Trading
Self-trading to create artificial volume (buying and selling to oneself).
- **Detection**: Symmetrical bid/ask volumes at same price levels
- **Trigger**: Volumes match within 5% AND above average

### 6. Iceberg Orders
Hidden large orders that only display a small visible portion.
- **Detection**: Repeated fills at the same price level without the displayed volume decreasing
- **Tracking**: Per-price-level fill count and cumulative volume

### 7. Liquidity Gaps
Price levels with dangerously thin volume where a moderate order could cause significant slippage.
- **Detection**: Scan top 10 levels for volume < 50
- **Severity**: Weighted by level proximity to top of book

## Trade Classification (Lee-Ready Algorithm)

Classifies each trade as buyer-initiated (aggressive buy) or seller-initiated (aggressive sell):

1. **Tick Test**: If trade_price > mid_price → BUY. If trade_price < mid_price → SELL.
2. **Quote Rule** (at mid-price): Compare distance to best bid vs best ask.
3. Returns: `'buy'`, `'sell'`, or `'unknown'`

### Derived Metrics
- **Effective Spread**: `2 × |trade_price - mid_price|` — actual cost of the trade
- **Realized Spread**: `2 × (trade_price - mid_price_after)` for buy — permanent price impact

## V-PIN (Volume-Synchronized Probability of Informed Trading)

1. Aggregate trades into volume buckets (default: 1000 volume units)
2. Per bucket: classify buys vs sells (Lee-Ready)
3. Calculate OI = |BuyVol - SellVol| / TotalVol per bucket
4. VPIN = rolling average of last 50 bucket OIs
5. High VPIN (>0.3) = likely informed trading, predicts adverse price moves

## Paper Trading Strategy Logic

- **Data Source**: Binance BTC/USDT perpetual futures, @depth20@100ms
- **Model**: DeepLOB CNN, 3-class prediction (UP/NEUTRAL/DOWN), 63.4% accuracy
- **Entry**: Position = 0 AND confidence > 15% (UP → LONG at BestAsk, DOWN → SHORT at BestBid)
- **Exit**: Hold position AND (neutral > 15% OR opposite signal > 15%)
- **Position**: Fixed 1.0 BTC, no leverage, spot paper trading
- **PnL**: Realized = sum of closed trade PnLs. Unrealized = mark-to-market at current best bid/ask
- **Results**: 94 trades, 59.6% win rate, +$287.40, Sharpe 1.82

## Key Terminology
- **Bona fide**: Genuine, legitimate (vs non-bona fide = fake/spoof)
- **Slippage**: Difference between expected and actual execution price
- **Market impact**: Price change caused by a trade
- **L1 data**: Top of book only (best bid/ask)
- **L2 data**: Multiple price levels of depth
- **Tick size**: Minimum price increment (0.01 for BTC)
- **Perpetual futures**: Futures contracts with no expiry date (Binance's main product)
