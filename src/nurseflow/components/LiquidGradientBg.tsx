import { useEffect, useRef, useState } from 'react';

/**
 * Premium liquid gradient background with smooth, fluid motion.
 * Renders a fixed full-screen interactive gradient that follows the cursor
 * with buttery-smooth interpolation and multiple layered orbs.
 */
export function LiquidGradientBg() {
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const target = useRef({ x: 50, y: 50 });
  const current = useRef({ x: 50, y: 50 });
  const raf = useRef<number | null>(null);
  const lastMoveTime = useRef(Date.now());

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      };
      lastMoveTime.current = Date.now();
    };

    // Smoother easing function (ease-out-cubic)
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = () => {
      const now = Date.now();
      const timeSinceMove = now - lastMoveTime.current;
      
      // Dynamic lerp factor: faster when moving, slower when idle for liquid feel
      const baseLerp = 0.025;
      const activeLerp = 0.08;
      const lerpFactor = timeSinceMove < 100 ? activeLerp : baseLerp;

      // Apply easing
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;
      
      current.current.x += dx * lerpFactor;
      current.current.y += dy * lerpFactor;

      // Add subtle idle drift for "liquid" feel when not moving
      if (timeSinceMove > 500) {
        const drift = Math.sin(now * 0.0005) * 0.3;
        current.current.x += drift * 0.01;
        current.current.y += Math.cos(now * 0.0007) * 0.01;
      }

      setMouse({ x: current.current.x, y: current.current.y });
      raf.current = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    raf.current = requestAnimationFrame(tick);
    
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  // Calculate multiple orb positions for layered depth
  const orb1 = { x: mouse.x, y: mouse.y };
  const orb2 = { x: 100 - mouse.x * 0.4, y: 100 - mouse.y * 0.35 };
  const orb3 = { x: 50 + (mouse.x - 50) * 0.2, y: 30 + (mouse.y - 50) * 0.15 };
  const orb4 = { x: 20 + mouse.x * 0.15, y: 80 - mouse.y * 0.2 };

  return (
    <>
      {/* Deep base layer */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 120% 100% at 50% 100%,
              rgba(8, 20, 50, 0.9) 0%,
              rgba(5, 12, 35, 1) 50%,
              rgba(3, 8, 25, 1) 100%
            )
          `,
        }}
      />
      
      {/* Large ambient orb - slow follow */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 80% 60% at ${orb3.x}% ${orb3.y}%,
              rgba(20, 60, 140, 0.25) 0%,
              transparent 60%
            )
          `,
          filter: 'blur(60px)',
          transition: 'background 0.3s ease-out',
        }}
      />

      {/* Secondary ambient orb */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 50% 70% at ${orb4.x}% ${orb4.y}%,
              rgba(15, 45, 110, 0.2) 0%,
              transparent 55%
            )
          `,
          filter: 'blur(40px)',
          transition: 'background 0.3s ease-out',
        }}
      />

      {/* Main cursor-following orb - primary interactive element */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 50% 45% at ${orb1.x}% ${orb1.y}%,
              rgba(25, 100, 200, 0.35) 0%,
              rgba(15, 70, 160, 0.15) 40%,
              transparent 70%
            )
          `,
          filter: 'blur(30px)',
          transition: 'background 0.15s ease-out',
        }}
      />

      {/* Secondary cursor-following orb - complementary color */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 40% 50% at ${orb2.x}% ${orb2.y}%,
              rgba(0, 160, 220, 0.22) 0%,
              rgba(0, 120, 180, 0.1) 45%,
              transparent 65%
            )
          `,
          filter: 'blur(25px)',
          transition: 'background 0.2s ease-out',
        }}
      />

      {/* Highlight accent - follows cursor closely */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 25% 20% at ${orb1.x}% ${orb1.y}%,
              rgba(100, 200, 255, 0.15) 0%,
              transparent 50%
            )
          `,
          filter: 'blur(15px)',
          transition: 'background 0.1s ease-out',
        }}
      />

      {/* Bottom glow - fixed anchor */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 100% 50% at 50% 120%,
              rgba(10, 40, 90, 0.4) 0%,
              transparent 50%
            )
          `,
          filter: 'blur(40px)',
        }}
      />

      {/* Premium noise grain overlay */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Vignette overlay for depth */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 80% 80% at 50% 50%,
              transparent 0%,
              transparent 50%,
              rgba(0, 0, 0, 0.3) 100%
            )
          `,
        }}
      />
    </>
  );
}