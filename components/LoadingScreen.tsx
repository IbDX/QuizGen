import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateLoadingTips } from '../services/gemini';
import { UILanguage } from '../types';

const GENERAL_TIPS = [
  "Did you know? The first computer bug was an actual moth stuck in a relay.",
  "Fact: The first 1GB hard drive (1980) weighed over 500 pounds.",
  "Fact: 'WiFi' doesn't stand for anything. It's a marketing term.",
  "System: Neural Link bandwidth is optimized for text extraction.",
  "Tip: Use the Question Library to save tricky problems for later review.",
  "Fact: The QWERTY layout was designed to slow down typists to prevent jamming.",
  "Tip: Regular expressions are powerful, but use them wisely.",
  "Fact: The first domain name ever registered was Symbolics.com.",
  "Tip: Comments in code explain the 'why', not the 'how'.",
  "System: VirusTotal scanning ensures your documents remain secure."
];

const CONTEXT_TIPS: Record<string, string[]> = {
  'python': [
    "Python Tip: List comprehensions `[x for x in list]` are faster than for-loops.",
    "Python Tip: Use `enumerate()` instead of `range(len())` to get index and value.",
    "Python Fact: Python is named after Monty Python, not the snake.",
    "Python Tip: Use `set()` to quickly remove duplicates from a list."
  ],
  'java': [
    "Java Tip: `String` is immutable; use `StringBuilder` for heavy modifications.",
    "Java Tip: `==` compares object references, `.equals()` compares values.",
    "Java Fact: Java was originally called 'Oak'.",
    "Java Tip: Check for null before accessing object methods to avoid NPE."
  ],
  'js': [
    "JS Tip: Use `===` for strict equality checking (avoids type coercion).",
    "JS Tip: `const` prevents reassignment, but object properties can still change.",
    "JS Tip: Arrow functions `() => {}` preserve the `this` context.",
    "JS Tip: Use `Array.map()` to transform data without mutating the original array."
  ],
  'javascript': [
    "JS Tip: Use `===` for strict equality checking (avoids type coercion).",
    "JS Tip: `const` prevents reassignment, but object properties can still change.",
    "JS Tip: Arrow functions `() => {}` preserve the `this` context.",
    "JS Tip: Use `Array.map()` to transform data without mutating the original array."
  ],
  'cpp': [
    "C++ Tip: Pointers store memory addresses; References are aliases.",
    "C++ Tip: Always use `delete` after `new` to prevent memory leaks.",
    "C++ Tip: `std::vector` manages memory automatically unlike raw arrays.",
    "C++ Tip: Pass large objects by reference `const MyObj&` to avoid copying."
  ],
  'c++': [
    "C++ Tip: Pointers store memory addresses; References are aliases.",
    "C++ Tip: Always use `delete` after `new` to prevent memory leaks.",
    "C++ Tip: `std::vector` manages memory automatically unlike raw arrays.",
    "C++ Tip: Pass large objects by reference `const MyObj&` to avoid copying."
  ],
  'sql': [
    "SQL Tip: Use `JOIN` instead of subqueries for better performance.",
    "SQL Tip: Always sanitize inputs to prevent SQL Injection attacks.",
    "SQL Tip: Indexing columns significantly speeds up `SELECT` queries.",
    "SQL Tip: `ACID` properties ensure reliable database transactions."
  ],
  'html': [
    "HTML Tip: Always use `alt` tags on images for accessibility.",
    "HTML Tip: Semantic tags like `<article>` and `<nav>` improve SEO.",
    "HTML Tip: Ensure you close self-closing tags like `<br />` in strict XHTML."
  ],
  'css': [
    "CSS Tip: Flexbox is great for 1D layouts; Grid is for 2D layouts.",
    "CSS Tip: Use `rem` units for better accessibility scaling than `px`.",
    "CSS Tip: Specificity matters: ID > Class > Element."
  ],
  'react': [
    "React Tip: Never mutate state directly; use the setter function.",
    "React Tip: `useEffect` runs after render; watch your dependency arrays.",
    "React Tip: Use `key` props in lists to help React optimize rendering.",
    "React Tip: Custom hooks are a great way to share logic between components."
  ]
};

// --- D-PAD COMPONENT ---
// Emits events: UP, DOWN, LEFT, RIGHT
const DPad = ({ onDir }: { onDir: (dir: string) => void }) => {
    return (
        <div className="relative w-40 h-40 flex items-center justify-center select-none touch-none mt-4 scale-90 md:scale-100">
             {/* Base Casing */}
             <div className="absolute inset-0 bg-[#e0e0e0] dark:bg-[#202020] rounded-[2.5rem] shadow-xl border-b-8 border-gray-400 dark:border-[#111]"></div>
             
             {/* Inner Recess */}
             <div className="absolute inset-3 bg-[#ccc] dark:bg-[#151515] rounded-[2rem] shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]"></div>
             
             {/* The Cross Controller */}
             <div className="relative w-28 h-28 filter drop-shadow-md cursor-pointer">
                 {/* Vertical Bar */}
                 <div className="absolute top-0 left-[34%] w-[32%] h-full bg-[#333] dark:bg-[#080808] rounded-md shadow-md"></div>
                 {/* Horizontal Bar */}
                 <div className="absolute top-[34%] left-0 w-full h-[32%] bg-[#333] dark:bg-[#080808] rounded-md shadow-md"></div>
                 
                 {/* Center Pivot */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-gradient-to-br from-[#444] to-[#111] rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] z-20"></div>

                 {/* Directional Arrows (Visual) */}
                 <div className="absolute top-2 left-1/2 -translate-x-1/2 text-gray-500 text-[10px] pointer-events-none z-20">▲</div>
                 <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-gray-500 text-[10px] pointer-events-none z-20">▼</div>
                 <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-[10px] pointer-events-none z-20">◀</div>
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-[10px] pointer-events-none z-20">▶</div>

                 {/* Hit Areas (Invisible Buttons) */}
                 <button className="absolute top-0 left-[34%] w-[32%] h-1/2 z-30 active:bg-white/10 rounded-t-md" onPointerDown={(e) => { e.preventDefault(); onDir('UP'); }}></button>
                 <button className="absolute bottom-0 left-[34%] w-[32%] h-1/2 z-30 active:bg-white/10 rounded-b-md" onPointerDown={(e) => { e.preventDefault(); onDir('DOWN'); }}></button>
                 <button className="absolute left-0 top-[34%] w-1/2 h-[32%] z-30 active:bg-white/10 rounded-l-md" onPointerDown={(e) => { e.preventDefault(); onDir('LEFT'); }}></button>
                 <button className="absolute right-0 top-[34%] w-1/2 h-[32%] z-30 active:bg-white/10 rounded-r-md" onPointerDown={(e) => { e.preventDefault(); onDir('RIGHT'); }}></button>
             </div>
        </div>
    );
};

// --- MINI GAMES ---

const SnakeGame: React.FC<{ externalDir?: string }> = ({ externalDir }) => {
    const GRID_SIZE = 20;
    const [snake, setSnake] = useState([{x: 10, y: 10}]);
    const [food, setFood] = useState({x: 15, y: 5});
    const [dir, setDir] = useState({x: 1, y: 0});
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);

    const resetGame = () => {
        setSnake([{x: 10, y: 10}]);
        setFood({x: 15, y: 5});
        setDir({x: 1, y: 0});
        setGameOver(false);
        setScore(0);
    };

    useEffect(() => {
        if(externalDir) {
            switch(externalDir) {
                case 'UP': if(dir.y === 0) setDir({x: 0, y: -1}); break;
                case 'DOWN': if(dir.y === 0) setDir({x: 0, y: 1}); break;
                case 'LEFT': if(dir.x === 0) setDir({x: -1, y: 0}); break;
                case 'RIGHT': if(dir.x === 0) setDir({x: 1, y: 0}); break;
            }
        }
    }, [externalDir]);

    useEffect(() => {
        if (gameOver) return;
        const move = setInterval(() => {
            setSnake((prev) => {
                const head = { ...prev[0] };
                head.x += dir.x;
                head.y += dir.y;

                // Wall Collision
                if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
                    setGameOver(true);
                    return prev;
                }
                // Self Collision
                if (prev.some(seg => seg.x === head.x && seg.y === head.y)) {
                    setGameOver(true);
                    return prev;
                }

                const newSnake = [head, ...prev];
                
                if (head.x === food.x && head.y === food.y) {
                    setScore(s => s + 1);
                    setFood({
                        x: Math.floor(Math.random() * GRID_SIZE),
                        y: Math.floor(Math.random() * GRID_SIZE)
                    });
                } else {
                    newSnake.pop();
                }
                return newSnake;
            });
        }, 150);
        return () => clearInterval(move);
    }, [dir, food, gameOver]);

    return (
        <div className="flex flex-col items-center">
            <div className="mb-2 font-mono text-xs flex justify-between w-full px-4">
                <span>SCORE: {score}</span>
                {gameOver && <span className="text-red-500 font-bold cursor-pointer" onClick={resetGame}>GAME OVER - TAP TO RETRY</span>}
            </div>
            <div className="relative bg-black border-4 border-gray-600 w-48 h-48 sm:w-60 sm:h-60 grid" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)` }}>
                {Array.from({length: GRID_SIZE*GRID_SIZE}).map((_, i) => {
                    const x = i % GRID_SIZE;
                    const y = Math.floor(i / GRID_SIZE);
                    const isSnake = snake.some(s => s.x === x && s.y === y);
                    const isHead = snake[0].x === x && snake[0].y === y;
                    const isFood = food.x === x && food.y === y;
                    return (
                        <div key={i} className={`w-full h-full ${isHead ? 'bg-green-400' : isSnake ? 'bg-green-700' : isFood ? 'bg-red-500 rounded-full' : 'bg-[#111]'}`}></div>
                    )
                })}
            </div>
        </div>
    );
};

// Placeholder games for variety
const XO: React.FC = () => <div className="text-xs text-center text-gray-500 flex items-center justify-center h-48 border border-dashed w-48">XO GAME (Coming Soon)</div>;
const SokobanGame: React.FC = () => <div className="text-xs text-center text-gray-500 flex items-center justify-center h-48 border border-dashed w-48">SOKOBAN (Coming Soon)</div>;
const MemoryGame: React.FC = () => <div className="text-xs text-center text-gray-500 flex items-center justify-center h-48 border border-dashed w-48">MEMORY (Coming Soon)</div>;


interface LoadingScreenProps {
  message: string;
  fileNames?: string[];
  lang?: UILanguage;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message, fileNames = [], lang }) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [gameIndex, setGameIndex] = useState(0);
  const [dPadInput, setDPadInput] = useState<string>('');
  
  const [activeTips, setActiveTips] = useState<string[]>([]);
  const [isFetchingTips, setIsFetchingTips] = useState(false);

  const handleDir = (dir: string) => {
      setDPadInput(dir);
      // clear quickly to allow re-trigger
      setTimeout(() => setDPadInput(''), 100);
  };

  // Keyboard support for desktop
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          switch(e.key) {
              case 'ArrowUp': handleDir('UP'); break;
              case 'ArrowDown': handleDir('DOWN'); break;
              case 'ArrowLeft': handleDir('LEFT'); break;
              case 'ArrowRight': handleDir('RIGHT'); break;
              case 'w': handleDir('UP'); break;
              case 's': handleDir('DOWN'); break;
              case 'a': handleDir('LEFT'); break;
              case 'd': handleDir('RIGHT'); break;
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const GAMES = [
      <SnakeGame key="snake" externalDir={dPadInput} />, 
      <XO key="xo" />, 
      <SokobanGame key="sokoban" />,
      <MemoryGame key="memory" />
  ];

  useEffect(() => {
      const relevantTips: string[] = [];
      if (fileNames.length > 0) {
          fileNames.forEach(name => {
              const lowerName = name.toLowerCase();
              Object.keys(CONTEXT_TIPS).forEach(key => {
                  if (key === 'java' && lowerName.includes('javascript')) return;
                  if (lowerName.includes(key)) {
                      relevantTips.push(...CONTEXT_TIPS[key]);
                  }
              });
          });
      }
      const uniqueRelevant = Array.from(new Set(relevantTips));
      const initialSet = uniqueRelevant.length > 0 ? uniqueRelevant : GENERAL_TIPS;
      setActiveTips(initialSet);

      const fetchNewTips = async () => {
          setIsFetchingTips(true);
          const newAiTips = await generateLoadingTips(fileNames);
          if (newAiTips && newAiTips.length > 0) {
              setActiveTips(prev => {
                  const combined = Array.from(new Set([...newAiTips, ...prev]));
                  return combined.sort(() => Math.random() - 0.5);
              });
          }
          setIsFetchingTips(false);
      };
      
      fetchNewTips();
  }, [fileNames]);

  useEffect(() => {
      // Default to Snake (Index 0)
      setGameIndex(0);
      const interval = setInterval(() => {
          setTipIndex(prev => (prev + 1) % activeTips.length);
      }, 5000); 
      return () => clearInterval(interval);
  }, [activeTips]);

  const formatTip = (text: string) => {
      const parts = text.split('`');
      return parts.map((part, i) => {
          if (i % 2 === 1) {
              return <span key={i} className="bg-gray-300 dark:bg-gray-700 text-red-600 dark:text-terminal-green font-bold px-1 rounded mx-0.5" dir="ltr">{part}</span>;
          }
          return <span key={i}>{part}</span>;
      });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      
      {/* Loading Spinner & Message */}
      <div className="text-center space-y-4">
         <div className="w-12 h-12 md:w-16 md:h-16 mx-auto relative">
            <div className="absolute inset-0 border-4 border-t-terminal-green border-r-transparent border-b-terminal-green border-l-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-t-transparent border-r-blue-500 border-b-transparent border-l-blue-500 rounded-full animate-spin-slow opacity-70"></div>
         </div>
         <h2 className="font-mono text-base md:text-lg font-bold animate-pulse text-terminal-green px-2">{message}</h2>
      </div>

      {/* Tip Box */}
      <div className="w-full bg-gray-100 dark:bg-[#1a1a1a] p-3 border-l-4 border-blue-500 shadow-md transition-all duration-500">
          <div className="flex justify-between items-center mb-1">
             <div className="text-[10px] font-bold text-gray-400 uppercase">
                {isFetchingTips ? (lang === 'ar' ? 'جاري التوليد...' : 'GENERATING_FRESH_TIPS...') : (lang === 'ar' ? 'تلميح ذكي' : 'CONTEXT_AWARE_HINT')}
             </div>
             {isFetchingTips && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>}
          </div>
          <p className="font-mono text-xs text-gray-700 dark:text-gray-300 min-h-[2.5rem] flex items-center flex-wrap">
              {activeTips.length > 0 && formatTip(activeTips[tipIndex])}
          </p>
      </div>

      {/* Game Console */}
      <div className="w-full bg-gray-200 dark:bg-[#111] p-4 rounded-xl shadow-2xl border-b-8 border-gray-400 dark:border-black flex flex-col items-center">
          <div className="w-full bg-[#9ead86] border-4 border-gray-500 p-2 rounded shadow-inner mb-2 font-mono flex flex-col items-center">
               <div className="text-[10px] text-gray-700 font-bold w-full text-center border-b border-gray-600/20 mb-1 pb-1">Z+ PORTABLE SYSTEM</div>
               {GAMES[gameIndex]}
          </div>

          <div className="w-full flex justify-between items-center px-4 min-h-[160px]">
               {/* Controls - Mobile Only */}
               <div className="md:hidden">
                   <DPad onDir={handleDir} />
               </div>

               {/* Controls - Desktop Only */}
               <div className="hidden md:flex flex-col items-start justify-center text-gray-500 font-mono text-[10px] space-y-2 opacity-60">
                    <div className="flex items-center gap-2">
                        <span className="border border-gray-500 px-1.5 py-0.5 rounded bg-gray-300 dark:bg-gray-800">▲▼◀▶</span>
                        <span>TO MOVE</span>
                    </div>
                    <div>USE KEYBOARD ARROWS</div>
               </div>

               {/* Action Buttons */}
               <div className="flex flex-col gap-3 mt-4">
                    <div className="flex gap-4 rotate-12">
                        <button className="w-10 h-10 bg-red-600 rounded-full shadow-[0_4px_0_#990000] active:shadow-none active:translate-y-1 active:bg-red-700"></button>
                        <button 
                            className="w-10 h-10 bg-blue-600 rounded-full shadow-[0_4px_0_#000099] active:shadow-none active:translate-y-1 active:bg-blue-700"
                            onClick={() => setGameIndex((i) => (i + 1) % GAMES.length)}
                        ></button>
                    </div>
                    <div className="text-[9px] text-gray-500 font-bold flex gap-8 ml-2">
                        <span>B</span>
                        <span>A</span>
                    </div>
               </div>
          </div>
      </div>
    </div>
  );
};