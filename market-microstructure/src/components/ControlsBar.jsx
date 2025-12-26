import { useState } from "react";

export default function ControlsBar({ 
  onPlay, 
  onPause, 
  onResume, 
  onStop, 
  onSpeed,
  onGoBack,
  isPlaying = false,
  isPaused = false,
  currentSpeed = 1
}) {
  const [speed, setSpeed] = useState(currentSpeed);
  const [speedUpValue, setSpeedUpValue] = useState(2);
  const [goBackSeconds, setGoBackSeconds] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [tempSpeedUp, setTempSpeedUp] = useState(2);
  const [tempGoBack, setTempGoBack] = useState(1);

  const handlePlayPause = () => {
    if (isPlaying) {
      if (onPause) onPause();
    } else if (isPaused) {
      if (onResume) onResume();
    } else {
      if (onPlay) onPlay();
    }
  };

  const handleSpeedToggle = () => {
    const newSpeed = speed === 1 ? speedUpValue : 1;
    setSpeed(newSpeed);
    if (onSpeed) onSpeed(newSpeed);
  };

  const handleGoBack = () => {
    if (onGoBack) onGoBack(goBackSeconds);
  };

  const handleApplySettings = () => {
    setSpeedUpValue(tempSpeedUp);
    setGoBackSeconds(tempGoBack);
    setShowModal(false);
  };

  const buttonStyle = {
    padding: '8px',
    fontSize: '16px',
    backgroundColor: '#334155',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  };

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        justifyContent: 'center',
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        border: '1px solid #334155'
      }}>
        {/* Play/Pause Button */}
        <button 
          onClick={handlePlayPause}
          style={{
            ...buttonStyle,
            backgroundColor: isPlaying ? '#f59e0b' : '#3b82f6',
          }}
          title={isPlaying ? 'Pause' : (isPaused ? 'Resume' : 'Play')}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Speed Toggle Button */}
        <button 
          onClick={handleSpeedToggle}
          style={{
            ...buttonStyle,
            backgroundColor: speed > 1 ? '#10b981' : '#334155',
          }}
          title={`Speed: ${speed}x (Toggle to ${speed === 1 ? speedUpValue : 1}x)`}
        >
          ⚡
        </button>

        {/* Go Back Button */}
        <button 
          onClick={handleGoBack}
          style={buttonStyle}
          title={`Go back ${goBackSeconds}s`}
        >
          ⏪
        </button>

        {/* Settings Button */}
        <button 
          onClick={() => setShowModal(true)}
          style={buttonStyle}
          title="Settings"
        >
          ⋯
        </button>
      </div>

      {/* Settings Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{
            backgroundColor: '#1e293b',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #334155',
            minWidth: '280px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', color: '#ffffff', fontSize: '16px' }}>Settings</h3>
            
            {/* Speed Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>
                Speed Up Value
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[0.5, 1, 2, 3, 5, 10].map(val => (
                  <button
                    key={val}
                    onClick={() => setTempSpeedUp(val)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: tempSpeedUp === val ? '#3b82f6' : '#334155',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {val}x
                  </button>
                ))}
              </div>
            </div>

            {/* Go Back Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>
                Go Back (seconds)
              </label>
              <input
                type="number"
                min="0.25"
                max="100"
                step="0.25"
                value={tempGoBack}
                onChange={(e) => setTempGoBack(Math.min(100, Math.max(0.25, parseFloat(e.target.value) || 0.25)))}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplySettings}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '13px',
                fontWeight: '600',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </>
  );
}