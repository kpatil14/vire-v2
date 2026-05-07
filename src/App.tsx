import React, { useEffect, useRef, useState } from 'react';

// Configure: change this to your name as you'd like it shown
const SIGNATURE = 'Nachiket';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealProgress, setRevealProgress] = useState(0);
  const [showHint, setShowHint] = useState(true);

  // Animation state refs
  const stateRef = useRef({
    mouseX: 0,
    mouseY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    isPointerActive: false,
    time: 0,
    revealAmount: 0,
    fullyRevealedAt: 0,
    surpriseTriggered: false,
    birds: [] as { x: number; y: number; vx: number; vy: number; phase: number; size: number }[],
    mistOffset: 0,
    starPhases: [] as number[],
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const maskCanvas = maskCanvasRef.current!;
    const maskCtx = maskCanvas.getContext('2d')!;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.scale(dpr, dpr);

      maskCanvas.width = w;
      maskCanvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    // initialize stars
    stateRef.current.starPhases = Array.from({ length: 80 }, () => Math.random() * Math.PI * 2);

    // Pointer / touch handlers
    const onMove = (clientX: number, clientY: number) => {
      const s = stateRef.current;
      s.mouseX = clientX;
      s.mouseY = clientY;
      s.isPointerActive = true;
      if (showHint) setShowHint(false);
    };
    const handlePointerMove = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });

    // Draw the underlying scene to maskCanvas (then we composite)
    const drawScene = (w: number, h: number, t: number) => {
      const s = stateRef.current;

      // Sky gradient — based on reveal progress, transitions from deep night to dawn
      const dawnProgress = s.revealAmount; // 0..1
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.85);

      // Interpolate between night and dawn colors
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const lerpColor = (c1: number[], c2: number[], t: number) =>
        `rgb(${lerp(c1[0], c2[0], t) | 0}, ${lerp(c1[1], c2[1], t) | 0}, ${lerp(c1[2], c2[2], t) | 0})`;

      // night: deep blue/black; dawn: warm purple/orange/pink
      const nightTop = [8, 10, 24];
      const dawnTop = [40, 30, 70];
      const nightMid = [20, 25, 50];
      const dawnMid = [180, 100, 130];
      const nightBot = [40, 50, 90];
      const dawnBot = [255, 170, 130];

      skyGrad.addColorStop(0, lerpColor(nightTop, dawnTop, dawnProgress));
      skyGrad.addColorStop(0.5, lerpColor(nightMid, dawnMid, dawnProgress));
      skyGrad.addColorStop(1, lerpColor(nightBot, dawnBot, dawnProgress));
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Stars (fade out as dawn breaks)
      const starOpacity = 1 - dawnProgress * 0.95;
      if (starOpacity > 0.05) {
        ctx.save();
        for (let i = 0; i < s.starPhases.length; i++) {
          const seedX = (i * 137.5) % w;
          const seedY = ((i * 89.3) % (h * 0.6));
          const twinkle = (Math.sin(t * 0.001 + s.starPhases[i]) + 1) / 2;
          const size = 0.5 + twinkle * 1.2;
          ctx.fillStyle = `rgba(255, 255, 255, ${starOpacity * (0.4 + twinkle * 0.6)})`;
          ctx.beginPath();
          ctx.arc(seedX, seedY, size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Sun — slowly rises as reveal progresses, then continues rising in surprise
      const sunRiseProgress = s.surpriseTriggered
        ? Math.min(1, dawnProgress + (t - s.fullyRevealedAt) / 4000)
        : dawnProgress;

      const sunY = h * (0.78 - sunRiseProgress * 0.45);
      const sunX = w * 0.62;
      const sunSize = 50 + sunRiseProgress * 30;

      // Sun glow halo
      const haloGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunSize * 5);
      haloGrad.addColorStop(0, `rgba(255, 220, 180, ${0.6 * dawnProgress})`);
      haloGrad.addColorStop(0.3, `rgba(255, 180, 140, ${0.3 * dawnProgress})`);
      haloGrad.addColorStop(1, 'rgba(255, 150, 100, 0)');
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, w, h);

      // Sun disc
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunSize);
      sunGrad.addColorStop(0, `rgba(255, 245, 220, ${0.95 * dawnProgress})`);
      sunGrad.addColorStop(0.5, `rgba(255, 200, 150, ${0.85 * dawnProgress})`);
      sunGrad.addColorStop(1, `rgba(255, 150, 100, 0)`);
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunSize, 0, Math.PI * 2);
      ctx.fill();

      // Mountain layers — each a different shade, with parallax depth
      const mountainLayers = [
        { baseY: 0.55, amplitude: 0.10, frequency: 0.003, color: [50, 55, 90], opacity: 0.7, mistTop: 0.2 },
        { baseY: 0.62, amplitude: 0.13, frequency: 0.0025, color: [38, 42, 70], opacity: 0.8, mistTop: 0.3 },
        { baseY: 0.70, amplitude: 0.10, frequency: 0.004, color: [25, 28, 50], opacity: 0.9, mistTop: 0.4 },
        { baseY: 0.78, amplitude: 0.08, frequency: 0.005, color: [12, 14, 28], opacity: 1.0, mistTop: 0.6 },
      ];

      mountainLayers.forEach((layer, idx) => {
        const layerColor = layer.color.map((c, i) => {
          // tint mountains warm as dawn breaks
          const warm = [c + 20 * dawnProgress, c + 5 * dawnProgress, c - 5 * dawnProgress][i];
          return Math.min(255, Math.max(0, warm)) | 0;
        });
        ctx.fillStyle = `rgba(${layerColor[0]}, ${layerColor[1]}, ${layerColor[2]}, ${layer.opacity})`;
        ctx.beginPath();
        ctx.moveTo(0, h);
        const baseY = h * layer.baseY;
        for (let x = 0; x <= w; x += 4) {
          const noise =
            Math.sin(x * layer.frequency + idx * 100) * 0.6 +
            Math.sin(x * layer.frequency * 2.3 + idx * 50) * 0.3 +
            Math.sin(x * layer.frequency * 5 + idx * 25) * 0.1;
          const y = baseY - noise * h * layer.amplitude;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Subtle mist on top of each layer
        const mistGrad = ctx.createLinearGradient(0, baseY - h * layer.amplitude, 0, baseY + h * 0.05);
        mistGrad.addColorStop(0, `rgba(255, 220, 200, 0)`);
        mistGrad.addColorStop(1, `rgba(255, 220, 200, ${0.18 * dawnProgress * layer.mistTop})`);
        ctx.fillStyle = mistGrad;
        ctx.fillRect(0, baseY - h * 0.1, w, h * 0.3);
      });

      // Drifting mist layer (animated)
      s.mistOffset += 0.15;
      const mistGrad2 = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.85);
      mistGrad2.addColorStop(0, `rgba(255, 230, 210, 0)`);
      mistGrad2.addColorStop(0.5, `rgba(255, 220, 200, ${0.12 * dawnProgress})`);
      mistGrad2.addColorStop(1, `rgba(255, 220, 200, 0)`);
      ctx.fillStyle = mistGrad2;
      for (let i = 0; i < 3; i++) {
        const offset = (s.mistOffset * (1 + i * 0.5)) % (w * 1.5);
        ctx.save();
        ctx.translate(-offset + i * w * 0.4, 0);
        ctx.fillRect(0, h * 0.55, w * 1.5, h * 0.3);
        ctx.restore();
      }

      // Birds — appear during surprise reveal
      if (s.surpriseTriggered) {
        const elapsed = t - s.fullyRevealedAt;
        if (elapsed > 800 && s.birds.length === 0) {
          // spawn a flock
          for (let i = 0; i < 7; i++) {
            s.birds.push({
              x: -50 - Math.random() * 200,
              y: h * 0.25 + Math.random() * h * 0.2,
              vx: 1.2 + Math.random() * 0.8,
              vy: -0.1 + Math.random() * 0.2,
              phase: Math.random() * Math.PI * 2,
              size: 8 + Math.random() * 6,
            });
          }
        }
        s.birds.forEach((bird) => {
          bird.x += bird.vx;
          bird.y += bird.vy + Math.sin(t * 0.003 + bird.phase) * 0.3;
          ctx.strokeStyle = `rgba(20, 25, 40, 0.7)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const flap = Math.sin(t * 0.015 + bird.phase) * bird.size * 0.5;
          ctx.moveTo(bird.x - bird.size, bird.y + flap);
          ctx.quadraticCurveTo(bird.x, bird.y, bird.x + bird.size, bird.y + flap);
          ctx.stroke();
        });
        s.birds = s.birds.filter((b) => b.x < w + 100);
      }
    };

    let rafId = 0;
    const tick = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const s = stateRef.current;
      s.time = t;

      // Smooth follow for trail
      const dx = s.mouseX - s.lastMouseX;
      const dy = s.mouseY - s.lastMouseY;
      s.lastMouseX += dx * 0.18;
      s.lastMouseY += dy * 0.18;

      if (!s.surpriseTriggered) {
        // ── REVEAL PHASE ──
        // Add to mask wherever cursor is
        if (s.isPointerActive) {
          maskCtx.globalCompositeOperation = 'source-over';
          // Multiple radii for soft reveal
          const radii = [180, 130, 80];
          const opacities = [0.06, 0.10, 0.18];
          radii.forEach((r, i) => {
            const grad = maskCtx.createRadialGradient(s.lastMouseX, s.lastMouseY, 0, s.lastMouseX, s.lastMouseY, r);
            grad.addColorStop(0, `rgba(255, 255, 255, ${opacities[i]})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            maskCtx.fillStyle = grad;
            maskCtx.beginPath();
            maskCtx.arc(s.lastMouseX, s.lastMouseY, r, 0, Math.PI * 2);
            maskCtx.fill();
          });
        }

        // Sample mask to estimate reveal
        if (Math.random() < 0.05) {
          // Sample at random points
          let total = 0;
          let revealed = 0;
          const samples = 100;
          for (let i = 0; i < samples; i++) {
            const sx = Math.random() * w;
            const sy = Math.random() * h;
            const px = maskCtx.getImageData(sx | 0, sy | 0, 1, 1).data;
            total++;
            if (px[3] > 30) revealed++;
          }
          const newReveal = revealed / total;
          s.revealAmount = Math.max(s.revealAmount, newReveal);
          setRevealProgress(s.revealAmount);

          if (s.revealAmount > 0.55 && !s.surpriseTriggered) {
            s.surpriseTriggered = true;
            s.fullyRevealedAt = t;
            setRevealed(true);
          }
        }

        // Draw scene to a buffer
        drawScene(w, h, t);

        // Apply mask: keep only revealed parts visible
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';

        // Draw black backdrop wherever NOT revealed (pre-reveal feel)
        // (Already handled — canvas is otherwise transparent and CSS bg is black)
      } else {
        // ── SURPRISE PHASE ── full scene reveal with smooth fade-in of remaining areas
        const elapsed = t - s.fullyRevealedAt;
        const fadeIn = Math.min(1, elapsed / 1800); // 1.8s smooth full reveal

        // Continue painting mask to full coverage smoothly
        maskCtx.fillStyle = `rgba(255, 255, 255, ${fadeIn * 0.05})`;
        maskCtx.fillRect(0, 0, w, h);

        // Draw scene
        drawScene(w, h, t);

        // After full fade-in, ramp reveal amount to 1 for sky transition
        s.revealAmount = Math.min(1, s.revealAmount + 0.005);

        // No more masking after full reveal
        if (fadeIn < 1) {
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(maskCanvas, 0, 0, w, h);
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [showHint]);

  // Time-of-day greeting that appears after surprise
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'still, the night.';
    if (h < 11) return 'good morning.';
    if (h < 17) return 'good afternoon.';
    if (h < 20) return 'good evening.';
    return 'good night.';
  })();

  return (
    <div className="vire-stage">
      <canvas ref={canvasRef} className="vire-canvas" />
      <canvas ref={maskCanvasRef} style={{ display: 'none' }} />

      {/* Hint - fades after first interaction */}
      <div className={`vire-hint ${showHint ? '' : 'vire-hide'}`}>
        <span className="vire-hint-line" />
        <span className="vire-hint-text">move to reveal</span>
        <span className="vire-hint-line" />
      </div>

      {/* Greeting and signature appear after the surprise */}
      <div className={`vire-reveal-text ${revealed ? 'vire-show' : ''}`}>
        <p className="vire-greeting">{greeting}</p>
      </div>

      <div className={`vire-corner ${revealed ? 'vire-show' : ''}`}>
        <span className="vire-mark">vire</span>
        <span className="vire-divider" />
        <span className="vire-by">by {SIGNATURE}</span>
      </div>

      {/* Subtle progress indicator on bottom edge */}
      <div className="vire-progress" style={{ width: `${Math.min(100, revealProgress * 180)}%` }} />
    </div>
  );
};

export default App;
