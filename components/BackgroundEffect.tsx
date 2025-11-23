
import React, { useEffect, useRef } from 'react';
import { ThemeOption } from './Layout';

interface BackgroundEffectProps {
  theme: ThemeOption;
}

export const BackgroundEffect: React.FC<BackgroundEffectProps> = ({ theme }) => {
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
      const isDark = theme === 'dark';
      const isPalestine = theme === 'palestine';
      const isLight = theme === 'light';

      // Trail effect: Paint over with low opacity background
      // Dark Mode: Black with very slight opacity (long trails)
      // Light Mode: Gray/White with higher opacity (cleaner look)
      if (isLight) {
          ctx.fillStyle = 'rgba(243, 244, 246, 0.1)';
      } else {
          // Both Dark and Palestine use dark backgrounds
          ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
      }
      
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        // Randomize character
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        
        // Color Selection Logic
        if (isLight) {
            ctx.fillStyle = '#888'; // Subtle gray
        } else if (isPalestine) {
            // Mix of Flag Colors: Green, Red, White
            const rand = Math.random();
            if (rand > 0.66) {
                ctx.fillStyle = '#007A3D'; // Official Flag Green
            } else if (rand > 0.33) {
                ctx.fillStyle = '#CE1126'; // Official Flag Red
            } else {
                ctx.fillStyle = '#FFFFFF'; // White
            }
        } else {
            // Standard Terminal Dark Mode
           // Randomly make some characters brighter/white for "glint" effect
           if (Math.random() > 0.98) {
               ctx.fillStyle = '#FFF';
           } else {
               ctx.fillStyle = '#00ff41'; // Terminal Green
           }
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
  }, [theme]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full -z-0 pointer-events-none transition-opacity duration-1000 opacity-40 dark:opacity-30"
    />
  );
};
