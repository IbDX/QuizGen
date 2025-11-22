
import React, { useEffect, useRef } from 'react';

interface BackgroundEffectProps {
  isDarkMode: boolean;
}

export const BackgroundEffect: React.FC<BackgroundEffectProps> = ({ isDarkMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Configuration
    const fontSize = 14;
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const charArray = chars.split('');
    
    let columns = 0;
    let drops: number[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      columns = Math.ceil(canvas.width / fontSize);
      // Initialize drops with random starting y positions to reduce "curtain" effect at start
      drops = Array(columns).fill(0).map(() => Math.random() * -100);
    };

    const draw = () => {
      // Trail effect: Paint over with low opacity background
      // Dark Mode: Black with very slight opacity (long trails)
      // Light Mode: Gray/White with higher opacity (cleaner look)
      ctx.fillStyle = isDarkMode 
        ? 'rgba(12, 12, 12, 0.05)' 
        : 'rgba(243, 244, 246, 0.1)'; 
      
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = isDarkMode ? '#0F0' : '#000'; // Bright Green in Dark, Black in Light
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        // Randomize character
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        
        // Specific color tweaking for "matrix" feel
        if (isDarkMode) {
           // Randomly make some characters brighter/white for "glint" effect
           if (Math.random() > 0.98) {
               ctx.fillStyle = '#FFF';
           } else {
               ctx.fillStyle = '#00ff41'; // Terminal Green
           }
        } else {
            ctx.fillStyle = '#888'; // Subtle gray in light mode
        }

        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(text, x, y);

        // Reset drop to top randomly after it has crossed screen
        // Adding randomness to the reset threshold makes the rain look more organic
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        drops[i]++;
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    // Init
    resize();
    draw();

    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDarkMode]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full -z-0 pointer-events-none transition-opacity duration-1000 opacity-40 dark:opacity-30"
    />
  );
};
