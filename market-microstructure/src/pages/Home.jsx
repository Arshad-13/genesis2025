import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Menu, Zap, Target, TrendingUp, BarChart3, Play, ArrowRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import "../styles/home.css";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Mouse tracking for parallax effects
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Cinematic trading engine visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Trading engine data streams
    let time = 0;
    const basePrice = 47500;
    const priceHistory = [];
    const volumeStreams = [];
    const liquidityWaves = [];
    const orderFlows = [];
    const heatFlows = [];

    // Realistic market state
    let marketPhase = 'filling'; // 'filling', 'scrolling'
    let currentPrice = basePrice;
    let priceDirection = 1;
    let volatilityBurst = 0;
    let trendStrength = 0;
    let lastPrice = basePrice;

    // Market microstructure variables
    let orderPressure = 0;
    let liquidityShock = 0;
    let newsImpact = 0;

    // Initialize empty - will fill gradually
    // No pre-filled data - starts blank like real trading

    // Initialize liquidity waves
    for (let i = 0; i < 8; i++) {
      liquidityWaves.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 100 + 50,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
        intensity: Math.random() * 0.5 + 0.3
      });
    }

    // Initialize order flows
    for (let i = 0; i < 20; i++) { // Reduced from 40 to 20 for fewer particles
      orderFlows.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 4 + 2,
        life: Math.random() * 100,
        maxLife: 100,
        type: Math.random() > 0.5 ? 'buy' : 'sell'
      });
    }

    // Initialize heat flows
    for (let i = 0; i < 15; i++) {
      heatFlows.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 1 + 0.5,
        intensity: Math.random() * 0.8 + 0.2,
        width: Math.random() * 200 + 100,
        height: Math.random() * 50 + 20
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cyber-finance gradient background
      const bgGradient = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.3, 0,
        canvas.width * 0.5, canvas.height * 0.3, canvas.width * 0.8
      );
      bgGradient.addColorStop(0, '#0a0f0a');
      bgGradient.addColorStop(0.3, '#0d1b0d');
      bgGradient.addColorStop(0.7, '#0a2a0a');
      bgGradient.addColorStop(1, '#051005');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 0.016;

      // Realistic market price generation
      if (marketPhase === 'filling') {
        // Gradually fill the chart from left to right
        if (priceHistory.length < 400) {
          // Generate realistic price movements
          const randomWalk = (Math.random() - 0.5) * 40;
          const meanReversion = (basePrice - currentPrice) * 0.001;
          const momentum = priceDirection * Math.random() * 20;

          // Add market microstructure effects
          orderPressure += (Math.random() - 0.5) * 0.1;
          orderPressure *= 0.95; // Decay

          // Occasional volatility bursts
          if (Math.random() < 0.02) {
            volatilityBurst = (Math.random() - 0.5) * 200;
            liquidityShock = Math.random() * 0.5;
          }
          volatilityBurst *= 0.9;
          liquidityShock *= 0.95;

          // Trend changes
          if (Math.random() < 0.005) {
            trendStrength = (Math.random() - 0.5) * 2;
          }
          trendStrength *= 0.99;

          // News impact simulation
          if (Math.random() < 0.001) {
            newsImpact = (Math.random() - 0.5) * 300;
          }
          newsImpact *= 0.98;

          // Combine all factors
          const priceChange = randomWalk + meanReversion + momentum +
            orderPressure * 50 + volatilityBurst +
            trendStrength * 30 + newsImpact;

          currentPrice += priceChange;

          // Update direction based on recent movement
          if (Math.abs(currentPrice - lastPrice) > 10) {
            priceDirection = currentPrice > lastPrice ? 1 : -1;
            lastPrice = currentPrice;
          }

          // Keep price in reasonable bounds
          currentPrice = Math.max(basePrice - 3000, Math.min(basePrice + 3000, currentPrice));

          priceHistory.push(currentPrice);

          // Generate corresponding volume
          const volumeIntensity = Math.abs(priceChange) / 50 + Math.random() * 0.5;
          const volume = volumeIntensity * 1500 + 300 + liquidityShock * 1000;
          volumeStreams.push({
            volume: volume,
            intensity: Math.min(1, volumeIntensity)
          });
        } else {
          marketPhase = 'scrolling';
        }
      } else {
        // Scrolling phase - realistic continuous updates
        const randomWalk = (Math.random() - 0.5) * 35;
        const meanReversion = (basePrice - currentPrice) * 0.002;
        const momentum = priceDirection * Math.random() * 15;

        // Market microstructure effects
        orderPressure += (Math.random() - 0.5) * 0.08;
        orderPressure *= 0.96;

        // Volatility clustering
        if (Math.random() < 0.015) {
          volatilityBurst = (Math.random() - 0.5) * 150;
        }
        volatilityBurst *= 0.92;

        // Trend persistence
        if (Math.random() < 0.008) {
          trendStrength = (Math.random() - 0.5) * 1.5;
        }
        trendStrength *= 0.995;

        const priceChange = randomWalk + meanReversion + momentum +
          orderPressure * 40 + volatilityBurst + trendStrength * 25;

        currentPrice += priceChange;

        // Update direction
        if (Math.abs(currentPrice - lastPrice) > 8) {
          priceDirection = currentPrice > lastPrice ? 1 : -1;
          lastPrice = currentPrice;
        }

        currentPrice = Math.max(basePrice - 3000, Math.min(basePrice + 3000, currentPrice));

        priceHistory.push(currentPrice);
        if (priceHistory.length > 400) priceHistory.shift();

        const volumeIntensity = Math.abs(priceChange) / 40 + Math.random() * 0.4;
        const volume = volumeIntensity * 1200 + 400;
        volumeStreams.push({
          volume: volume,
          intensity: Math.min(1, volumeIntensity)
        });
        if (volumeStreams.length > 400) volumeStreams.shift();
      }

      // Draw heat flows (background layer)
      ctx.globalAlpha = 0.25; // Increased from 0.15
      heatFlows.forEach((flow) => {
        flow.x += Math.cos(flow.angle) * flow.speed;
        flow.y += Math.sin(flow.angle) * flow.speed;

        // Wrap around screen
        if (flow.x < -flow.width) flow.x = canvas.width + flow.width;
        if (flow.x > canvas.width + flow.width) flow.x = -flow.width;
        if (flow.y < -flow.height) flow.y = canvas.height + flow.height;
        if (flow.y > canvas.height + flow.height) flow.y = -flow.height;

        const heatGradient = ctx.createLinearGradient(
          flow.x, flow.y, flow.x + flow.width, flow.y + flow.height
        );
        heatGradient.addColorStop(0, `rgba(0, 255, 127, ${flow.intensity * 0.5})`); // Increased from 0.3
        heatGradient.addColorStop(0.5, `rgba(0, 255, 100, ${flow.intensity * 0.8})`); // Increased from 0.6
        heatGradient.addColorStop(1, `rgba(0, 200, 80, ${flow.intensity * 0.4})`); // Increased from 0.2

        ctx.fillStyle = heatGradient;
        ctx.fillRect(flow.x, flow.y, flow.width, flow.height);
      });

      // Draw liquidity waves
      ctx.globalAlpha = 0.4; // Increased from 0.25
      liquidityWaves.forEach((wave) => {
        wave.phase += wave.speed;
        const pulseRadius = wave.radius + Math.sin(wave.phase) * 20;

        const waveGradient = ctx.createRadialGradient(
          wave.x, wave.y, 0,
          wave.x, wave.y, pulseRadius
        );
        waveGradient.addColorStop(0, `rgba(0, 255, 127, ${wave.intensity * 0.6})`); // Increased from 0.4
        waveGradient.addColorStop(0.7, `rgba(0, 255, 100, ${wave.intensity * 0.4})`); // Increased from 0.2
        waveGradient.addColorStop(1, 'rgba(0, 255, 80, 0)');

        ctx.fillStyle = waveGradient;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, pulseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Drift waves slowly
        wave.x += Math.sin(time * 0.3 + wave.phase) * 0.5;
        wave.y += Math.cos(time * 0.2 + wave.phase) * 0.3;

        // Keep waves on screen
        if (wave.x < -100) wave.x = canvas.width + 100;
        if (wave.x > canvas.width + 100) wave.x = -100;
        if (wave.y < -100) wave.y = canvas.height + 100;
        if (wave.y > canvas.height + 100) wave.y = -100;
      });

      // Draw main trading chart
      const chartWidth = canvas.width * 0.85;
      const chartHeight = canvas.height * 0.5;
      const startX = canvas.width * 0.075;
      const startY = canvas.height * 0.25;

      // Volume bars (background) with red/green coloring
      ctx.globalAlpha = 0.5; // Increased from 0.3
      volumeStreams.forEach((stream, i) => {
        if (i === 0) return; // Skip first bar

        const x = startX + (i / volumeStreams.length) * chartWidth;
        const barHeight = (stream.volume / 2500) * (chartHeight * 0.3);
        const intensity = stream.intensity;

        // Determine color based on price movement
        const currentPricePoint = priceHistory[i];
        const prevPricePoint = priceHistory[i - 1];
        const isUp = currentPricePoint > prevPricePoint;

        if (isUp) {
          ctx.fillStyle = `rgba(0, 255, 127, ${intensity * 0.8})`;
        } else {
          ctx.fillStyle = `rgba(255, 50, 50, ${intensity * 0.8})`; // Red for down
        }

        ctx.fillRect(x, startY + chartHeight - barHeight, 3, barHeight);
      });

      // Price line with dynamic red/green coloring and glow
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;

      // Draw segments with different colors based on direction
      for (let i = 1; i < priceHistory.length; i++) {
        const prevX = startX + ((i - 1) / priceHistory.length) * chartWidth;
        const currX = startX + (i / priceHistory.length) * chartWidth;

        const prevPrice = priceHistory[i - 1];
        const currPrice = priceHistory[i];

        const prevNormalizedPrice = (prevPrice - (basePrice - 1500)) / 3000;
        const currNormalizedPrice = (currPrice - (basePrice - 1500)) / 3000;

        const prevY = startY + chartHeight * 0.8 - (prevNormalizedPrice * chartHeight * 0.6);
        const currY = startY + chartHeight * 0.8 - (currNormalizedPrice * chartHeight * 0.6);

        // Determine segment color
        const isUp = currPrice > prevPrice;
        const color = isUp ? '#00ff7f' : '#ff3232';

        // Add glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = isUp ? 8 : 12; // Stronger glow for red (losses are more dramatic)
        ctx.strokeStyle = color;

        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(currX, currY);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Dynamic price area fill based on overall trend
      ctx.globalAlpha = 0.15;
      const recentPrices = priceHistory.slice(-20);
      const isOverallUp = recentPrices.length > 1 &&
        recentPrices[recentPrices.length - 1] > recentPrices[0];

      if (isOverallUp) {
        ctx.fillStyle = '#00ff7f';
      } else {
        ctx.fillStyle = '#ff3232'; // Red area for downtrend
      }

      // Create area fill path
      ctx.beginPath();
      priceHistory.forEach((price, i) => {
        const x = startX + (i / priceHistory.length) * chartWidth;
        const normalizedPrice = (price - (basePrice - 1500)) / 3000;
        const y = startY + chartHeight * 0.8 - (normalizedPrice * chartHeight * 0.6);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      const lastX = startX + chartWidth;
      const lastY = startY + chartHeight * 0.8;
      ctx.lineTo(lastX, lastY);
      ctx.lineTo(startX, lastY);
      ctx.closePath();
      ctx.fill();

      // Order book streams (right side)
      ctx.globalAlpha = 0.9; // Increased from 0.7 for much better visibility
      const bookX = canvas.width * 0.88;
      const bookY = canvas.height * 0.1;
      const bookHeight = canvas.height * 0.8;

      for (let i = 0; i < 30; i++) {
        const y = bookY + (i / 30) * bookHeight;
        const bidIntensity = Math.sin(time * 2 + i * 0.1) * 0.5 + 0.5;
        const askIntensity = Math.cos(time * 1.8 + i * 0.15) * 0.5 + 0.5;

        const bidWidth = bidIntensity * 80; // Increased from 60 for wider bars
        const askWidth = askIntensity * 80; // Increased from 60 for wider bars

        // Bids (green) - increased opacity and size
        ctx.fillStyle = `rgba(0, 255, 127, ${bidIntensity * 1.0})`; // Increased from 0.8
        ctx.fillRect(bookX - bidWidth, y, bidWidth, 3); // Increased height from 2 to 3

        // Asks (red) - increased opacity and size
        ctx.fillStyle = `rgba(255, 50, 50, ${askIntensity * 1.0})`; // Brighter red
        ctx.fillRect(bookX + 5, y, askWidth, 3); // Increased height from 2 to 3
      }

      // Order flow particles
      ctx.globalAlpha = 1.0; // Increased from 0.8 for full visibility
      orderFlows.forEach((flow) => {
        flow.x += flow.vx;
        flow.y += flow.vy;
        flow.life--;

        // Generate new particle with more variety
        if (flow.life <= 0) {
          flow.x = Math.random() * canvas.width;
          flow.y = Math.random() * canvas.height;
          flow.vx = (Math.random() - 0.5) * 2;
          flow.vy = (Math.random() - 0.5) * 2;
          flow.life = flow.maxLife;
          // More balanced buy/sell ratio with occasional heavy selling
          const sellPressure = Math.random() < 0.4 ? 'sell' : 'buy';
          flow.type = sellPressure;
        }

        const alpha = flow.life / flow.maxLife;
        const color = flow.type === 'buy' ? '0, 255, 127' : '255, 50, 50'; // Brighter red

        // Increased particle visibility and size (reduced intensity)
        ctx.fillStyle = `rgba(${color}, ${alpha * 0.6})`; // Reduced from 0.9 to 0.6
        ctx.beginPath();
        ctx.arc(flow.x, flow.y, flow.size, 0, Math.PI * 2); // Reduced size back to normal
        ctx.fill();

        // Add subtle glow effect to particles
        ctx.shadowColor = flow.type === 'buy' ? '#00ff7f' : '#ff3232';
        ctx.shadowBlur = 4; // Reduced from 8 to 4
        ctx.beginPath();
        ctx.arc(flow.x, flow.y, flow.size * 0.6, 0, Math.PI * 2); // Reduced glow size
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow
      });

      // Enhanced grid overlay for better visibility
      ctx.globalAlpha = 0.12; // Increased from 0.05
      ctx.strokeStyle = '#00ff7f';
      ctx.lineWidth = 1;

      // Vertical grid
      for (let i = 0; i <= 20; i++) {
        const x = (i / 20) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Horizontal grid
      for (let i = 0; i <= 15; i++) {
        const y = (i / 15) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="cyber-landing">
        {/* Animated Trading Engine Canvas */}
        <canvas
          ref={canvasRef}
          className="cyber-background-canvas"
        />

        {/* Navigation */}
        <nav className="cyber-nav">
          <button
            onClick={() => setSidebarOpen(true)}
            className="cyber-menu-btn"
          >
            <Menu size={18} />
            <span>MENU</span>
          </button>
        </nav>

        {/* Hero Section */}
        <div className="cyber-hero">
          <div
            className="cyber-hero-content"
            style={{
              transform: `translate(${mousePos.x * 5}px, ${mousePos.y * 3}px)`
            }}
          >
            {/* <div className="cyber-hero-badge">
              <Zap size={14} />
              <span>NEXT-GEN HFT</span>
            </div> */}

            <h1 className="cyber-hero-title">
              TRADING
              <br />
              <span className="cyber-hero-highlight">HUB</span>
            </h1>

            <p className="cyber-hero-subtitle">
              Real-time market microstructure engine.
              <br />
              Built for speed. Designed for precision.
            </p>

            <div className="cyber-hero-actions">
              <Link to="/dashboard" className="cyber-cta-primary">
                <Play size={18} />
                <span>ENTER LIVE</span>
                <ArrowRight size={16} />
              </Link>

              <Link to="/market-predict" className="cyber-cta-secondary">
                <BarChart3 size={18} />
                <span>PREDICT</span>
              </Link>
            </div>

            {/* Key Metrics */}
            <div className="cyber-metrics">
              <div className="cyber-metric">
                <Target size={16} />
                <span>SUB-MS LATENCY</span>
              </div>
              <div className="cyber-metric cyber-metric-risk">
                <TrendingUp size={16} />
                <span>RISK MONITOR</span>
              </div>
              <div className="cyber-metric">
                <Zap size={16} />
                <span>LIVE ENGINE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cinematic overlay */}
        <div className="cyber-overlay" />
      </div>
    </>
  );
}