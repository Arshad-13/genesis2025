export default function PriceLadder() {
  return (
    <div className="panel ladder">
      <h4>Price Ladder</h4>
      {[...Array(10)].map((_, i) => (
        <div key={i} className="ladder-row">
          <span>{(100 - i).toFixed(2)}</span>
          <span className="bid-bar" />
          <span className="ask-bar" />
        </div>
      ))}
    </div>
  );
}
