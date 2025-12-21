
import React, { useEffect, useRef } from 'react';
import { ThemeOption } from '../types';

interface BackgroundEffectProps {
  theme: ThemeOption;
}

const fontSize = 14;
const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const charArray = chars.split('');

export const BackgroundEffect: React.FC<BackgroundEffectProps> = React.memo(({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let columns = 0;
    let drops: number[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      columns = Math.ceil(canvas.width / fontSize);
      drops = Array(columns).fill(0).map(() => Math.random() * -100);
    };

    const draw = () => {
      const isLight = theme === 'light';
      const isPalestine = theme === 'palestine';

      if (isLight) {
          ctx.fillStyle = 'rgba(243, 244, 246, 0.1)';
      } else if (isPalestine) {
          ctx.fillStyle = 'rgba(11, 15, 12, 0.1)'; 
      } else {
          ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
      }
      
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        
        if (isLight) {
            ctx.fillStyle = '#888';
        } else if (isPalestine) {
            // Professional: Green and Off-White only. No Red.
            const rand = Math.random();
            if (rand > 0.7) {
                ctx.fillStyle = 'rgba(0, 122, 61, 0.6)'; // Palestine Green (Subtle)
            } else {
                ctx.fillStyle = 'rgba(229, 231, 235, 0.4)'; // Off White (Very Subtle)
            }
        } else {
           if (Math.random() > 0.98) {
               ctx.fillStyle = '#FFF';
           } else {
               ctx.fillStyle = '#00ff41'; 
           }
        }

        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(text, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        drops[i]++;
      }

      animationFrameId = requestAnimationFrame(draw);
    };

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
});
