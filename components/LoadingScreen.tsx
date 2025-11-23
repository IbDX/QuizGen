

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

// Shared Input Props
interface GameProps {
    externalDir?: string;
    externalAction?: string;
}

// 1. SNAKE GAME
const SnakeGame: React.FC<GameProps> = ({ externalDir, externalAction }) => {
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
        if (externalAction === 'ACTION' && gameOver) resetGame();
    }, [externalAction, gameOver]);

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

                if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
                    setGameOver(true);
                    return prev;
                }
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
        <div className="flex flex-col items-center h-full w-full">
            <div className="mb-1 font-mono text-[10px] flex justify-between w-full px-4 text-[#222]">
                <span>SCORE: {score}</span>
                {gameOver ? <span className="text-red-800 font-bold animate-pulse">GAME OVER (PRESS A)</span> : <span>SNAKE</span>}
            </div>
            <div className="relative bg-[#9ead86] border-2 border-gray-600/50 w-48 h-48 sm:w-56 sm:h-56 grid shadow-inner" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)` }}>
                {Array.from({length: GRID_SIZE*GRID_SIZE}).map((_, i) => {
                    const x = i % GRID_SIZE;
                    const y = Math.floor(i / GRID_SIZE);
                    const isSnake = snake.some(s => s.x === x && s.y === y);
                    const isHead = snake[0].x === x && snake[0].y === y;
                    const isFood = food.x === x && food.y === y;
                    return (
                        <div key={i} className={`w-full h-full ${isHead ? 'bg-black' : isSnake ? 'bg-gray-800' : isFood ? 'bg-red-900/80 rounded-full' : 'opacity-0'}`}></div>
                    )
                })}
            </div>
        </div>
    );
};

// 2. TIC TAC TOE (XO)
const TicTacToe: React.FC<GameProps> = ({ externalDir, externalAction }) => {
    const [board, setBoard] = useState(Array(9).fill(null));
    const [cursor, setCursor] = useState(4); // Center
    const [winner, setWinner] = useState<string | null>(null);
    const [isXNext, setIsXNext] = useState(true);

    const checkWinner = (squares: any[]) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
            }
        }
        return squares.every(Boolean) ? 'DRAW' : null;
    };

    useEffect(() => {
        if (externalDir) {
            let next = cursor;
            switch(externalDir) {
                case 'UP': next = cursor - 3; break;
                case 'DOWN': next = cursor + 3; break;
                case 'LEFT': next = cursor - 1; break;
                case 'RIGHT': next = cursor + 1; break;
            }
            if (next >= 0 && next < 9) setCursor(next);
        }
    }, [externalDir]);

    const handlePlay = (idx: number) => {
        if (board[idx] || winner) return;
        const newBoard = [...board];
        newBoard[idx] = 'X';
        setBoard(newBoard);
        setIsXNext(false);
        
        const w = checkWinner(newBoard);
        if (w) setWinner(w);
        else {
            // CPU Move (Simple Random)
            setTimeout(() => {
                const emptyIndices = newBoard.map((v, i) => v === null ? i : null).filter(v => v !== null) as number[];
                if (emptyIndices.length > 0) {
                    const cpuMove = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
                    newBoard[cpuMove] = 'O';
                    setBoard([...newBoard]);
                    setIsXNext(true);
                    const w2 = checkWinner(newBoard);
                    if (w2) setWinner(w2);
                }
            }, 500);
        }
    };

    useEffect(() => {
        if (externalAction === 'ACTION') {
            if (winner) {
                setBoard(Array(9).fill(null));
                setWinner(null);
                setIsXNext(true);
            } else {
                handlePlay(cursor);
            }
        }
    }, [externalAction]);

    return (
        <div className="flex flex-col items-center h-full w-full">
            <div className="mb-1 font-mono text-[10px] flex justify-between w-full px-4 text-[#222]">
                <span>P1: X | CPU: O</span>
                {winner ? <span className="font-bold animate-pulse">{winner === 'DRAW' ? 'DRAW!' : `${winner} WINS!`} (PRESS A)</span> : <span>TIC-TAC-TOE</span>}
            </div>
            <div className="relative bg-[#9ead86] border-2 border-gray-600/50 w-48 h-48 sm:w-56 sm:h-56 grid grid-cols-3 grid-rows-3 gap-1 p-1 shadow-inner">
                {board.map((cell, i) => (
                    <div 
                        key={i} 
                        className={`
                            flex items-center justify-center text-4xl font-bold font-mono border border-gray-600/20
                            ${cursor === i ? 'bg-black/10 shadow-inner' : ''}
                            ${cell === 'X' ? 'text-black' : 'text-gray-700'}
                        `}
                    >
                        {cell}
                        {cursor === i && !cell && !winner && <div className="w-2 h-2 bg-black/30 rounded-full animate-ping absolute"></div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

// 3. SOKOBAN
const SokobanGame: React.FC<GameProps> = ({ externalDir, externalAction }) => {
    // 0: Floor, 1: Wall, 2: Box, 3: Target, 4: Player, 5: Box on Target
    const LEVEL = [
        [1,1,1,1,1,1,1,1],
        [1,0,0,0,0,1,1,1],
        [1,0,2,0,0,3,0,1],
        [1,0,4,0,0,1,0,1],
        [1,1,2,0,3,1,0,1],
        [1,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1],
    ];
    
    // Flatten level for simple state, store dynamic entities separately
    const [walls] = useState(() => {
        const w: string[] = [];
        LEVEL.forEach((row, y) => row.forEach((cell, x) => { if(cell===1) w.push(`${x},${y}`) }));
        return w;
    });
    const [targets] = useState(() => {
        const t: string[] = [];
        LEVEL.forEach((row, y) => row.forEach((cell, x) => { if(cell===3) t.push(`${x},${y}`) }));
        return t;
    });
    
    // Dynamic State
    const [player, setPlayer] = useState({x: 2, y: 3});
    const [boxes, setBoxes] = useState([{x: 2, y: 2}, {x: 2, y: 4}]); // Corrected logic
    const [won, setWon] = useState(false);

    useEffect(() => {
        if (externalAction === 'ACTION' && won) {
            // Reset
            setPlayer({x: 2, y: 3});
            setBoxes([{x: 2, y: 2}, {x: 2, y: 4}]);
            setWon(false);
        }
    }, [externalAction]);

    useEffect(() => {
        if (!externalDir || won) return;
        
        let dx = 0, dy = 0;
        switch(externalDir) {
            case 'UP': dy = -1; break;
            case 'DOWN': dy = 1; break;
            case 'LEFT': dx = -1; break;
            case 'RIGHT': dx = 1; break;
        }

        const newX = player.x + dx;
        const newY = player.y + dy;
        const key = `${newX},${newY}`;

        if (walls.includes(key)) return;

        const boxIndex = boxes.findIndex(b => b.x === newX && b.y === newY);
        if (boxIndex >= 0) {
            // Push Box
            const boxNextX = newX + dx;
            const boxNextY = newY + dy;
            const boxNextKey = `${boxNextX},${boxNextY}`;
            
            if (walls.includes(boxNextKey) || boxes.some(b => b.x === boxNextX && b.y === boxNextY)) {
                return; // Blocked
            }
            
            const newBoxes = [...boxes];
            newBoxes[boxIndex] = {x: boxNextX, y: boxNextY};
            setBoxes(newBoxes);
            setPlayer({x: newX, y: newY});
            
            // Check Win
            if (newBoxes.every(b => targets.includes(`${b.x},${b.y}`))) setWon(true);
        } else {
            setPlayer({x: newX, y: newY});
        }
    }, [externalDir]);

    return (
        <div className="flex flex-col items-center h-full w-full">
            <div className="mb-1 font-mono text-[10px] flex justify-between w-full px-4 text-[#222]">
                <span>SOKOBAN</span>
                {won && <span className="font-bold animate-pulse text-green-900">SOLVED! (PRESS A)</span>}
            </div>
            <div className="relative bg-[#9ead86] border-2 border-gray-600/50 w-48 h-42 sm:w-56 sm:h-48 grid shadow-inner" style={{ gridTemplateColumns: `repeat(8, 1fr)`, gridTemplateRows: `repeat(7, 1fr)` }}>
                {Array.from({length: 56}).map((_, i) => {
                    const x = i % 8;
                    const y = Math.floor(i / 8);
                    const key = `${x},${y}`;
                    
                    const isWall = walls.includes(key);
                    const isTarget = targets.includes(key);
                    const isBox = boxes.some(b => b.x === x && b.y === y);
                    const isPlayer = player.x === x && player.y === y;
                    
                    return (
                        <div key={i} className={`flex items-center justify-center text-[10px] sm:text-xs`}>
                            {isWall && <div className="w-full h-full bg-gray-700 border border-gray-600"></div>}
                            {isTarget && !isBox && !isPlayer && <div className="w-2 h-2 bg-red-800/50 rounded-full"></div>}
                            {isBox && <div className={`w-3/4 h-3/4 border border-black ${isTarget ? 'bg-green-600' : 'bg-yellow-700'}`}></div>}
                            {isPlayer && <div className="w-3/4 h-3/4 bg-blue-800 rounded-sm animate-pulse"></div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// 4. MEMORY
const MemoryGame: React.FC<GameProps> = ({ externalDir, externalAction }) => {
    const ICONS = ['⚡', '💾', '💿', '🖥️', '⌨️', '🖱️', '🔋', '📡'];
    
    // Initial State Setup
    const [cards, setCards] = useState(() => {
        const d = [...ICONS, ...ICONS];
        return d.sort(() => Math.random() - 0.5);
    });
    
    const [flipped, setFlipped] = useState<number[]>([]);
    const [matched, setMatched] = useState<number[]>([]);
    const [cursor, setCursor] = useState(0);
    const [gameOver, setGameOver] = useState(false);

    useEffect(() => {
        if (externalDir) {
            let next = cursor;
            switch(externalDir) {
                case 'UP': next = cursor - 4; break;
                case 'DOWN': next = cursor + 4; break;
                case 'LEFT': next = cursor - 1; break;
                case 'RIGHT': next = cursor + 1; break;
            }
            if (next >= 0 && next < 16) setCursor(next);
        }
    }, [externalDir]);

    useEffect(() => {
        if (externalAction === 'ACTION') {
            if (gameOver) {
                // Reset
                setCards([...ICONS, ...ICONS].sort(() => Math.random() - 0.5));
                setFlipped([]);
                setMatched([]);
                setGameOver(false);
            } else {
                // Flip Logic
                if (matched.includes(cursor) || flipped.includes(cursor) || flipped.length >= 2) return;
                
                const newFlipped = [...flipped, cursor];
                setFlipped(newFlipped);
                
                if (newFlipped.length === 2) {
                    const c1 = cards[newFlipped[0]];
                    const c2 = cards[newFlipped[1]];
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
    }, [externalAction]);

    return (
        <div className="flex flex-col items-center h-full w-full">
            <div className="mb-1 font-mono text-[10px] flex justify-between w-full px-4 text-[#222]">
                <span>MATCH PAIRS</span>
                {gameOver && <span className="font-bold animate-pulse text-green-900">COMPLETE! (PRESS A)</span>}
            </div>
            <div className="relative bg-[#9ead86] border-2 border-gray-600/50 w-48 h-48 sm:w-56 sm:h-56 grid grid-cols-4 grid-rows-4 gap-1 p-1 shadow-inner">
                 {cards.map((icon, i) => {
                     const isFlipped = flipped.includes(i) || matched.includes(i);
                     return (
                         <div 
                            key={i}
                            className={`
                                flex items-center justify-center text-lg border border-gray-600/30
                                ${cursor === i ? 'ring-2 ring-black/50 z-10' : ''}
                                ${isFlipped ? 'bg-[#8b9c70]' : 'bg-[#4a553a]'}
                            `}
                         >
                             {isFlipped ? icon : <span className="opacity-20 text-[8px]">Z+</span>}
                         </div>
                     )
                 })}
            </div>
        </div>
    );
};

interface LoadingScreenProps {
  message: string;
  fileNames?: string[];
  lang?: UILanguage;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message, fileNames = [], lang = 'en' }) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [gameIndex, setGameIndex] = useState(0);
  const [dPadInput, setDPadInput] = useState<string>('');
  const [actionInput, setActionInput] = useState<string>('');
  
  const [activeTips, setActiveTips] = useState<string[]>([]);
  const [isFetchingTips, setIsFetchingTips] = useState(false);

  // --- CONTROLS ---
  const handleDir = (dir: string) => {
      setDPadInput(dir);
      setTimeout(() => setDPadInput(''), 100);
  };

  const handleAction = (type: 'ACTION' | 'CYCLE') => {
      if (type === 'CYCLE') {
          setGameIndex((i) => (i + 1) % 4); // 4 Games
      } else {
          setActionInput('ACTION');
          setTimeout(() => setActionInput(''), 100);
      }
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
              // Action Buttons
              case 'Enter': 
              case ' ': 
              case 'z': 
                  handleAction('ACTION'); 
                  break;
              case 'Shift':
              case 'x':
                  handleAction('CYCLE');
                  break;
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const GAMES = [
      <SnakeGame key="snake" externalDir={dPadInput} externalAction={actionInput} />, 
      <TicTacToe key="xo" externalDir={dPadInput} externalAction={actionInput} />, 
      <SokobanGame key="sokoban" externalDir={dPadInput} externalAction={actionInput} />,
      <MemoryGame key="memory" externalDir={dPadInput} externalAction={actionInput} />
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
          const newAiTips = await generateLoadingTips(fileNames, lang as UILanguage);
          if (newAiTips && newAiTips.length > 0) {
              setActiveTips(prev => {
                  const combined = Array.from(new Set([...newAiTips, ...prev]));
                  return combined.sort(() => Math.random() - 0.5);
              });
          }
          setIsFetchingTips(false);
      };
      
      fetchNewTips();
  }, [fileNames, lang]);

  useEffect(() => {
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
                    <div className="flex items-center gap-2">
                         <span className="border border-gray-500 px-1.5 py-0.5 rounded bg-gray-300 dark:bg-gray-800">SPACE/Z</span>
                         <span>ACTION</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <span className="border border-gray-500 px-1.5 py-0.5 rounded bg-gray-300 dark:bg-gray-800">SHIFT/X</span>
                         <span>CYCLE GAME</span>
                    </div>
               </div>

               {/* Action Buttons */}
               <div className="flex flex-col gap-3 mt-4">
                    <div className="flex gap-4 rotate-12">
                        {/* Button B - Red - Cycle */}
                        <button 
                            className="w-10 h-10 bg-red-600 rounded-full shadow-[0_4px_0_#990000] active:shadow-none active:translate-y-1 active:bg-red-700 select-none"
                            onPointerDown={(e) => { e.preventDefault(); handleAction('CYCLE'); }}
                        ></button>
                        
                        {/* Button A - Blue - Action */}
                        <button 
                            className="w-10 h-10 bg-blue-600 rounded-full shadow-[0_4px_0_#000099] active:shadow-none active:translate-y-1 active:bg-blue-700 select-none"
                            onPointerDown={(e) => { e.preventDefault(); handleAction('ACTION'); }}
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
