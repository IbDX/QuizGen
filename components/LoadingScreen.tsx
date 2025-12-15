
import React, { useState, useEffect, useCallback } from 'react';
import { generateLoadingTips } from '../services/gemini';
import { processInlineMarkdown } from './MarkdownRenderer';
import { UILanguage } from '../types';

// --- D-PAD COMPONENT ---
const DPad = ({ onDir }: { onDir: (dir: string) => void }) => {
    return (
        <div className="relative w-32 h-32 flex items-center justify-center select-none touch-none mt-2 scale-90">
             <div className="absolute inset-0 bg-[#222] rounded-full shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] border border-[#333]"></div>
             
             {/* Cross Base */}
             <div className="relative w-24 h-24">
                 <div className="absolute top-0 left-1/3 w-1/3 h-full bg-[#111] rounded-md shadow-[0_0_2px_#000]"></div>
                 <div className="absolute top-1/3 left-0 w-full h-1/3 bg-[#111] rounded-md shadow-[0_0_2px_#000]"></div>
                 
                 {/* Center Pivot */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#0a0a0a] rounded-full z-20 opacity-50"></div>

                 {/* Buttons */}
                 <button className="absolute top-0 left-1/3 w-1/3 h-1/3 hover:bg-white/5 active:bg-terminal-green/20 rounded-t-md z-30 transition-colors" onPointerDown={(e) => { e.preventDefault(); onDir('UP'); }}></button>
                 <button className="absolute bottom-0 left-1/3 w-1/3 h-1/3 hover:bg-white/5 active:bg-terminal-green/20 rounded-b-md z-30 transition-colors" onPointerDown={(e) => { e.preventDefault(); onDir('DOWN'); }}></button>
                 <button className="absolute left-0 top-1/3 w-1/3 h-1/3 hover:bg-white/5 active:bg-terminal-green/20 rounded-l-md z-30 transition-colors" onPointerDown={(e) => { e.preventDefault(); onDir('LEFT'); }}></button>
                 <button className="absolute right-0 top-1/3 w-1/3 h-1/3 hover:bg-white/5 active:bg-terminal-green/20 rounded-r-md z-30 transition-colors" onPointerDown={(e) => { e.preventDefault(); onDir('RIGHT'); }}></button>
                 
                 {/* Arrows */}
                 <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[#444] text-[8px] pointer-events-none z-10">▲</div>
                 <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[#444] text-[8px] pointer-events-none z-10">▼</div>
                 <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[#444] text-[8px] pointer-events-none z-10">◀</div>
                 <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[#444] text-[8px] pointer-events-none z-10">▶</div>
             </div>
        </div>
    );
};

// --- MINI GAMES ---

interface GameProps {
    externalDir?: string;
    externalAction?: string;
    isActive: boolean;
    onGameOver?: () => void;
}

// 1. SNAKE
const SnakeGame: React.FC<GameProps> = ({ externalDir, externalAction, isActive }) => {
    const GRID_SIZE = 20;
    const [snake, setSnake] = useState([{x: 10, y: 10}]);
    const [food, setFood] = useState({x: 15, y: 5});
    const [dir, setDir] = useState({x: 1, y: 0}); // Current movement
    const [nextDir, setNextDir] = useState({x: 1, y: 0}); // Buffered input
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);

    const resetGame = () => {
        setSnake([{x: 10, y: 10}]);
        setFood({x: 15, y: 5});
        setDir({x: 1, y: 0});
        setNextDir({x: 1, y: 0});
        setGameOver(false);
        setScore(0);
    };

    useEffect(() => {
        if (externalAction === 'ACTION' && gameOver && isActive) resetGame();
    }, [externalAction, gameOver, isActive]);

    useEffect(() => {
        if (!isActive || gameOver) return;
        if(externalDir) {
            switch(externalDir) {
                case 'UP': if(dir.y === 0) setNextDir({x: 0, y: -1}); break;
                case 'DOWN': if(dir.y === 0) setNextDir({x: 0, y: 1}); break;
                case 'LEFT': if(dir.x === 0) setNextDir({x: -1, y: 0}); break;
                case 'RIGHT': if(dir.x === 0) setNextDir({x: 1, y: 0}); break;
            }
        }
    }, [externalDir, isActive, gameOver, dir]);

    useEffect(() => {
        if (gameOver || !isActive) return;
        const move = setInterval(() => {
            setDir(nextDir); // Apply buffered direction
            setSnake((prev) => {
                const head = { x: prev[0].x + nextDir.x, y: prev[0].y + nextDir.y };

                if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE || prev.some(s => s.x === head.x && s.y === head.y)) {
                    setGameOver(true);
                    return prev;
                }

                const newSnake = [head, ...prev];
                if (head.x === food.x && head.y === food.y) {
                    setScore(s => s + 1);
                    // Ensure food doesn't spawn on snake
                    let newFood;
                    do {
                        newFood = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
                    } while (newSnake.some(s => s.x === newFood.x && s.y === newFood.y));
                    setFood(newFood);
                } else {
                    newSnake.pop();
                }
                return newSnake;
            });
        }, 120);
        return () => clearInterval(move);
    }, [nextDir, food, gameOver, isActive]);

    return (
        <div className="flex flex-col items-center h-full w-full bg-[#050505] p-1">
            <div className="w-full flex justify-between text-[10px] text-terminal-green font-mono mb-1 px-1 border-b border-terminal-green/30">
                <span>SNAKE_V2.exe</span>
                <span>SCR: {score.toString().padStart(3, '0')}</span>
            </div>
            {gameOver && <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 flex-col">
                <span className="text-red-500 font-bold animate-pulse text-xs">SYSTEM FAILURE</span>
                <span className="text-terminal-green text-[9px] mt-1">PRESS [A] TO REBOOT</span>
            </div>}
            <div className="relative w-full aspect-square border border-terminal-green/50 bg-[#0a0a0a]" style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, 
                gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)` 
            }}>
                {Array.from({length: GRID_SIZE*GRID_SIZE}).map((_, i) => {
                    const x = i % GRID_SIZE;
                    const y = Math.floor(i / GRID_SIZE);
                    const isSnake = snake.some(s => s.x === x && s.y === y);
                    const isFood = food.x === x && food.y === y;
                    return (
                        <div key={i} className={`w-full h-full ${isSnake ? 'bg-terminal-green shadow-[0_0_5px_rgba(0,255,65,0.5)]' : isFood ? 'bg-red-500 rounded-sm animate-pulse' : 'opacity-0'}`}></div>
                    )
                })}
            </div>
        </div>
    );
};

// 2. CYBER RUN (NEW)
const CyberRun: React.FC<GameProps> = ({ externalAction, isActive }) => {
    const [dinoY, setDinoY] = useState(0); // 0 is ground
    const [isJumping, setIsJumping] = useState(false);
    const [obstacles, setObstacles] = useState<number[]>([]); // X positions of obstacles
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [tick, setTick] = useState(0);

    const GROUND_Y = 0;
    const MAX_JUMP = 3;
    const GRID_W = 20;
    const GRID_H = 10;

    const reset = () => {
        setDinoY(0); setIsJumping(false); setObstacles([15]); setScore(0); setGameOver(false); setTick(0);
    };

    // Jump Logic
    useEffect(() => {
        if (externalAction === 'ACTION' && isActive) {
            if (gameOver) reset();
            else if (dinoY === 0) setIsJumping(true);
        }
    }, [externalAction, isActive, gameOver, dinoY]);

    // Game Loop
    useEffect(() => {
        if (!isActive || gameOver) return;
        const loop = setInterval(() => {
            setTick(t => t + 1);
            
            // Physics
            setDinoY(y => {
                if (isJumping) {
                    if (y < MAX_JUMP) return y + 1;
                    setIsJumping(false); return y;
                }
                return y > 0 ? y - 1 : 0;
            });

            // Obstacles & Collision
            setObstacles(prev => {
                const moved = prev.map(x => x - 1).filter(x => x >= 0);
                if (moved.some(x => x === 2 && dinoY === 0)) { // Dino is at x=2
                    setGameOver(true);
                    return prev; 
                }
                // Spawn new
                if (prev.length === 0 || (GRID_W - prev[prev.length - 1] > 6 && Math.random() > 0.7)) {
                    moved.push(GRID_W - 1);
                }
                return moved;
            });
            if (!gameOver) setScore(s => s + 1);

        }, 100);
        return () => clearInterval(loop);
    }, [isActive, gameOver, isJumping, dinoY]);

    return (
        <div className="flex flex-col items-center h-full w-full bg-[#050505] p-1">
            <div className="w-full flex justify-between text-[10px] text-terminal-green font-mono mb-1 px-1 border-b border-terminal-green/30">
                <span>CYBER_RUN.exe</span>
                <span>DST: {Math.floor(score/10)}m</span>
            </div>
            {gameOver && <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 flex-col">
                <span className="text-red-500 font-bold animate-pulse text-xs">COLLISION DETECTED</span>
                <span className="text-terminal-green text-[9px] mt-1">PRESS [A] TO RETRY</span>
            </div>}
            <div className="relative w-full h-32 border border-terminal-green/50 bg-[#0a0a0a] overflow-hidden">
                {/* Ground */}
                <div className="absolute bottom-0 w-full h-1 bg-terminal-green/50"></div>
                
                {/* Player */}
                <div 
                    className="absolute bottom-1 left-[10%] w-4 h-6 bg-terminal-green transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(0,255,65,0.8)]"
                    style={{ bottom: `${(dinoY * 10) + 4}px` }}
                ></div>

                {/* Obstacles */}
                {obstacles.map((x, i) => (
                    <div 
                        key={i} 
                        className="absolute bottom-1 w-4 h-4 bg-red-600 border border-red-400"
                        style={{ left: `${x * 5}%` }}
                    ></div>
                ))}
                
                {/* Stars/Background particles */}
                <div className="absolute top-2 left-4 w-1 h-1 bg-white/20"></div>
                <div className="absolute top-5 left-20 w-1 h-1 bg-white/20"></div>
                <div className="absolute top-8 left-60 w-1 h-1 bg-white/20"></div>
            </div>
            <div className="mt-2 text-[9px] text-gray-500 font-mono w-full text-center">
                JUMP: [A] / SPACE
            </div>
        </div>
    );
}

// 3. MEMORY GRID
const MemoryGame: React.FC<GameProps> = ({ externalDir, externalAction, isActive }) => {
    const ICONS = ['⚡', '💾', '☢', '⚙', '⌘', '⌥', '⎋', '⏎'];
    const [cards, setCards] = useState(() => [...ICONS, ...ICONS].sort(() => Math.random() - 0.5));
    const [flipped, setFlipped] = useState<number[]>([]);
    const [matched, setMatched] = useState<number[]>([]);
    const [cursor, setCursor] = useState(0);
    const [gameOver, setGameOver] = useState(false);

    useEffect(() => {
        if (externalDir && isActive) {
            let next = cursor;
            switch(externalDir) {
                case 'UP': next = cursor - 4; break; case 'DOWN': next = cursor + 4; break;
                case 'LEFT': next = cursor - 1; break; case 'RIGHT': next = cursor + 1; break;
            }
            if (next >= 0 && next < 16) setCursor(next);
        }
    }, [externalDir, isActive]);

    useEffect(() => {
        if (externalAction === 'ACTION' && isActive) {
            if (gameOver) {
                setCards([...ICONS, ...ICONS].sort(() => Math.random() - 0.5));
                setFlipped([]); setMatched([]); setGameOver(false);
            } else {
                if (matched.includes(cursor) || flipped.includes(cursor) || flipped.length >= 2) return;
                const newFlipped = [...flipped, cursor];
                setFlipped(newFlipped);
                if (newFlipped.length === 2) {
                    const c1 = cards[newFlipped[0]], c2 = cards[newFlipped[1]];
                    if (c1 === c2) {
                        setMatched(prev => {
                            const m = [...prev, ...newFlipped];
                            if (m.length === 16) setGameOver(true);
                            return m;
                        });
                        setFlipped([]);
                    } else {
                        setTimeout(() => setFlipped([]), 800);
                    }
                }
            }
        }
    }, [externalAction, isActive]);

    return (
        <div className="flex flex-col items-center h-full w-full bg-[#050505] p-1">
            <div className="w-full flex justify-between text-[10px] text-terminal-green font-mono mb-1 px-1 border-b border-terminal-green/30">
                <span>MEM_DUMP.bin</span>
                <span>{matched.length/2}/8</span>
            </div>
            {gameOver && <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 flex-col">
                <span className="text-terminal-green font-bold animate-pulse text-xs">DECRYPTED</span>
                <span className="text-gray-400 text-[9px] mt-1">PRESS [A] TO RESET</span>
            </div>}
            <div className="grid grid-cols-4 grid-rows-4 gap-1 w-full aspect-square p-1 bg-[#0a0a0a] border border-terminal-green/30">
                 {cards.map((icon, i) => {
                     const isFlipped = flipped.includes(i) || matched.includes(i);
                     const isCursor = cursor === i;
                     return (
                        <div key={i} className={`flex items-center justify-center text-sm border 
                            ${isCursor ? 'border-terminal-green bg-terminal-green/20' : 'border-terminal-green/10 bg-black'}
                            ${isFlipped ? 'text-terminal-green' : 'text-transparent'}
                            transition-colors duration-150 cursor-pointer
                        `}>
                            {isFlipped ? icon : <span className="text-terminal-green/20 text-[8px]">*</span>}
                        </div>
                     )
                 })}
            </div>
        </div>
    );
};

interface LoadingScreenProps {
  message: string;
  files: Array<{base64: string; mime: string; name: string; hash: string}>;
  lang?: UILanguage;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message, files = [], lang = 'en' }) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [gameIndex, setGameIndex] = useState(0);
  const [dPadInput, setDPadInput] = useState<string>('');
  const [actionInput, setActionInput] = useState<string>('');
  
  const [activeTips, setActiveTips] = useState<string[]>([]);
  const [isFetchingTips, setIsFetchingTips] = useState(true);

  // Game Metadata
  const GAMES = [
      { id: 'snake', name: 'SNAKE_V2', Component: SnakeGame },
      { id: 'cyber', name: 'CYBER_RUN', Component: CyberRun },
      { id: 'memory', name: 'MEM_DUMP', Component: MemoryGame },
  ];

  const handleDir = useCallback((dir: string) => {
      let effectiveDir = dir;
      // Handle RTL D-Pad Logic if needed, but standard games usually keep L/R constant
      setDPadInput(effectiveDir);
      setTimeout(() => setDPadInput(''), 100);
  }, []);

  const handleAction = useCallback((type: 'ACTION' | 'NEXT_GAME' | 'PREV_GAME') => {
      if (type === 'NEXT_GAME') setGameIndex(prev => (prev + 1) % GAMES.length);
      else if (type === 'PREV_GAME') setGameIndex(prev => (prev - 1 + GAMES.length) % GAMES.length);
      else { 
          setActionInput('ACTION'); 
          setTimeout(() => setActionInput(''), 100); 
      }
  }, [GAMES.length]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Prevent scrolling with arrows/space
          if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
              e.preventDefault();
          }

          switch(e.key) {
              case 'ArrowUp': case 'w': handleDir('UP'); break;
              case 'ArrowDown': case 's': handleDir('DOWN'); break;
              case 'ArrowLeft': case 'a': handleDir('LEFT'); break;
              case 'ArrowRight': case 'd': handleDir('RIGHT'); break;
              case 'Enter': case ' ': case 'z': handleAction('ACTION'); break;
              case 'x': handleAction('NEXT_GAME'); break;
              case 'z': handleAction('PREV_GAME'); break;
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDir, handleAction]);

  useEffect(() => {
      const fetchNewTips = async () => {
          if (files.length === 0) { setIsFetchingTips(false); return; }
          setIsFetchingTips(true);
          const filePayloads = files.slice(0, 3).map(f => ({ base64: f.base64, mimeType: f.mime }));
          const newAiTips = await generateLoadingTips(filePayloads, lang as UILanguage);
          if (newAiTips && newAiTips.length > 0) {
              setActiveTips(newAiTips);
              setTipIndex(0);
          }
          setIsFetchingTips(false);
      };
      fetchNewTips();
  }, [files, lang]);

  useEffect(() => {
      if (activeTips.length === 0) return;
      const interval = setInterval(() => {
          setTipIndex(prev => (prev + 1) % activeTips.length);
      }, 6000); 
      return () => clearInterval(interval);
  }, [activeTips]);

  const CurrentGame = GAMES[gameIndex].Component;

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4 animate-fade-in gap-8">
      
      {/* 1. STATUS HEADER */}
      <div className="text-center space-y-4 w-full max-w-2xl">
         <div className="flex items-center justify-center gap-4">
             <div className="w-2 h-2 bg-terminal-green rounded-full animate-ping"></div>
             <h2 className="font-mono text-lg md:text-xl font-bold text-terminal-green tracking-widest">{message}</h2>
             <div className="w-2 h-2 bg-terminal-green rounded-full animate-ping"></div>
         </div>
         
         {/* TIPS TERMINAL */}
         <div className="w-full bg-[#0c0c0c] border border-terminal-green/30 p-4 rounded-sm shadow-[0_0_10px_rgba(0,255,65,0.1)] min-h-[80px] flex items-center relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-1 h-full bg-terminal-green/50"></div>
             <div className="flex-1 font-mono text-xs md:text-sm text-gray-300 relative z-10">
                 <span className="text-terminal-green font-bold mr-2">root@ZPLUS:~$</span>
                 {activeTips.length > 0 ? (
                     <span className="typing-effect" dangerouslySetInnerHTML={{ __html: processInlineMarkdown(activeTips[tipIndex]) }} />
                 ) : (
                     <span className="animate-pulse">{isFetchingTips ? 'ESTABLISHING NEURAL LINK...' : 'STANDBY...'}</span>
                 )}
             </div>
             {/* Scanline overlay for tips */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>
         </div>
      </div>

      {/* 2. RETRO HANDHELD CONSOLE */}
      <div className="relative w-full max-w-sm md:max-w-md aspect-[4/5] md:aspect-[3/4] bg-[#1a1a1a] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_2px_5px_rgba(255,255,255,0.1)] p-6 flex flex-col items-center border-b-8 border-r-8 border-[#111]">
          
          {/* SCREEN BEZEL */}
          <div className="w-full aspect-square bg-[#050505] rounded-t-xl rounded-b-md border-[12px] border-[#2a2a2a] relative shadow-inner mb-6 overflow-hidden">
                {/* POWER LED */}
                <div className="absolute top-1 left-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_red] z-20"></div>
                <div className="absolute top-1.5 right-3 text-[8px] font-bold text-[#444] tracking-widest z-20">BATTERY LOW</div>

                {/* CRT SCREEN EFFECT CONTAINER */}
                <div className="relative w-full h-full bg-[#050505] overflow-hidden">
                    <CurrentGame externalDir={dPadInput} externalAction={actionInput} isActive={true} />
                    
                    {/* CRT OVERLAY (Scanlines + Vignette) */}
                    <div className="absolute inset-0 pointer-events-none z-30"
                        style={{
                            background: `
                                linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
                                linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))
                            `,
                            backgroundSize: "100% 2px, 3px 100%",
                            boxShadow: "inset 0 0 20px rgba(0,0,0,0.7)"
                        }}
                    ></div>
                </div>
          </div>

          {/* CONTROLS AREA */}
          <div className="w-full flex-grow flex flex-col justify-end pb-4">
              
              {/* GAME SELECTOR */}
              <div className="flex justify-between items-center px-4 mb-4">
                  <button onClick={() => handleAction('PREV_GAME')} className="text-[#444] hover:text-terminal-green transition-colors text-xs font-bold font-mono">◀ SELECT</button>
                  <div className="bg-[#111] px-3 py-1 rounded text-[10px] text-terminal-green font-mono border border-[#333] shadow-inner">
                      {GAMES[gameIndex].name}
                  </div>
                  <button onClick={() => handleAction('NEXT_GAME')} className="text-[#444] hover:text-terminal-green transition-colors text-xs font-bold font-mono">START ▶</button>
              </div>

              {/* BUTTONS LAYOUT */}
              <div className="flex justify-between items-end px-2">
                  <DPad onDir={handleDir} />
                  
                  <div className="flex flex-col gap-3 items-center mb-4">
                      <div className="flex gap-4 rotate-12 transform translate-y-2">
                          <div className="flex flex-col items-center gap-1">
                              <button 
                                className="w-12 h-12 bg-[#8b0000] rounded-full shadow-[0_4px_0_#500000,0_5px_5px_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1 active:bg-[#a00000] transition-all"
                                onPointerDown={(e) => { e.preventDefault(); handleAction('ACTION'); }}
                              ></button>
                              <span className="text-[#444] font-bold text-[10px]">B</span>
                          </div>
                          <div className="flex flex-col items-center gap-1 mt-4">
                              <button 
                                className="w-12 h-12 bg-[#8b0000] rounded-full shadow-[0_4px_0_#500000,0_5px_5px_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1 active:bg-[#a00000] transition-all"
                                onPointerDown={(e) => { e.preventDefault(); handleAction('ACTION'); }}
                              ></button>
                              <span className="text-[#444] font-bold text-[10px]">A</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* SPEAKERS */}
              <div className="absolute bottom-6 right-6 flex gap-1">
                  <div className="w-1 h-8 bg-[#111] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"></div>
                  <div className="w-1 h-8 bg-[#111] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"></div>
                  <div className="w-1 h-8 bg-[#111] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"></div>
              </div>
          </div>
      </div>
    </div>
  );
};
