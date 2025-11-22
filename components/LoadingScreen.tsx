
import React, { useState, useEffect, useRef } from 'react';
import { generateLoadingTips } from '../services/gemini';

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

// --- SNAKE GAME COMPONENT ---
const GRID_SIZE = 15;
const SPEED = 150;

const SnakeGame = () => {
  const [snake, setSnake] = useState([{ x: 7, y: 7 }]);
  const [food, setFood] = useState({ x: 10, y: 10 });
  const [dir, setDir] = useState({ x: 1, y: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const generateFood = () => {
    return {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
  };

  const resetGame = () => {
    setSnake([{ x: 7, y: 7 }]);
    setFood(generateFood());
    setDir({ x: 1, y: 0 });
    setGameOver(false);
    setScore(0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowUp': if (dir.y === 0) setDir({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (dir.y === 0) setDir({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (dir.x === 0) setDir({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (dir.x === 0) setDir({ x: 1, y: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dir]);

  useEffect(() => {
    if (gameOver) return;
    gameLoopRef.current = setInterval(() => {
      setSnake(prev => {
        const newHead = { x: prev[0].x + dir.x, y: prev[0].y + dir.y };
        
        // Wall collision
        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          setGameOver(true);
          return prev;
        }
        // Self collision
        if (prev.some(s => s.x === newHead.x && s.y === newHead.y)) {
          setGameOver(true);
          return prev;
        }

        const newSnake = [newHead, ...prev];
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 1);
          setFood(generateFood());
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, SPEED);
    return () => clearInterval(gameLoopRef.current!);
  }, [dir, food, gameOver]);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex justify-between w-full px-4 font-mono text-xs font-bold text-terminal-green">
         <span>STATUS: {gameOver ? 'CRASHED' : 'RUNNING'}</span>
         <span>SCORE: {score}</span>
      </div>
      <div 
        className="relative bg-black border-2 border-terminal-green grid"
        style={{
            width: '200px', height: '200px',
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const isSnake = snake.some(s => s.x === x && s.y === y);
            const isFood = food.x === x && food.y === y;
            const isHead = snake[0].x === x && snake[0].y === y;
            return (
                <div key={i} className={`${isHead ? 'bg-white' : isSnake ? 'bg-terminal-green' : isFood ? 'bg-red-500 animate-pulse' : 'bg-transparent'}`}></div>
            );
        })}
        {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-500 font-bold animate-pulse cursor-pointer" onClick={resetGame}>
                RESTART
            </div>
        )}
      </div>
      <div className="mt-2 text-[10px] text-gray-500">USE ARROW KEYS</div>
    </div>
  );
};

// --- TIC TAC TOE COMPONENT ---
const XO = () => {
    const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
    const [winner, setWinner] = useState<string | null>(null);
    const [isCPUTurn, setIsCPUTurn] = useState(false);

    const checkWinner = (squares: (string | null)[]) => {
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
        return squares.every(s => s) ? 'Draw' : null;
    };

    const handleClick = (i: number) => {
        if (board[i] || winner || isCPUTurn) return;
        const next = [...board];
        next[i] = 'X';
        setBoard(next);
        const w = checkWinner(next);
        if (w) setWinner(w);
        else setIsCPUTurn(true);
    };

    useEffect(() => {
        if (isCPUTurn && !winner) {
            const timeout = setTimeout(() => {
                const empty = board.map((v, i) => v === null ? i : null).filter(v => v !== null) as number[];
                if (empty.length > 0) {
                    const random = empty[Math.floor(Math.random() * empty.length)];
                    const next = [...board];
                    next[random] = 'O';
                    setBoard(next);
                    const w = checkWinner(next);
                    if (w) setWinner(w);
                }
                setIsCPUTurn(false);
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [isCPUTurn, board, winner]);

    const reset = () => {
        setBoard(Array(9).fill(null));
        setWinner(null);
        setIsCPUTurn(false);
    };

    return (
        <div className="flex flex-col items-center">
            <div className="mb-2 flex justify-between w-full px-8 font-mono text-xs font-bold text-terminal-green">
                <span>YOU: X</span>
                <span>CPU: O</span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-terminal-green p-1 border border-terminal-green">
                {board.map((val, i) => (
                    <button 
                        key={i} 
                        onClick={() => handleClick(i)}
                        className="w-16 h-16 bg-black flex items-center justify-center text-2xl font-bold hover:bg-gray-900"
                    >
                        {val === 'X' && <span className="text-blue-500">X</span>}
                        {val === 'O' && <span className="text-red-500">O</span>}
                    </button>
                ))}
            </div>
            {winner && (
                <div className="mt-4 text-sm font-bold uppercase animate-bounce cursor-pointer text-terminal-green" onClick={reset}>
                    {winner === 'Draw' ? 'DRAW - CLICK TO RESTART' : `WINNER: ${winner} - CLICK TO RESTART`}
                </div>
            )}
            {!winner && <div className="mt-2 text-[10px] text-gray-500">{isCPUTurn ? 'CPU THINKING...' : 'YOUR TURN'}</div>}
        </div>
    );
};

// --- SOKOBAN COMPONENT ---
// Simple level: 0=floor, 1=wall, 2=box, 3=target, 4=player
const INITIAL_LEVEL = [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,2,0,2,0,1],
    [1,0,3,4,3,0,1],
    [1,0,0,0,0,0,1],
    [1,0,1,0,1,0,1],
    [1,1,1,1,1,1,1]
];

const SokobanGame = () => {
    const [grid, setGrid] = useState<number[][]>(JSON.parse(JSON.stringify(INITIAL_LEVEL)));
    const [playerPos, setPlayerPos] = useState({x: 3, y: 3});
    const [won, setWon] = useState(false);

    const reset = () => {
        setGrid(JSON.parse(JSON.stringify(INITIAL_LEVEL)));
        setPlayerPos({x: 3, y: 3});
        setWon(false);
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if(won) return;
            if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            } else {
                return;
            }

            const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
            const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
            
            if (dx === 0 && dy === 0) return;

            setGrid(prev => {
                const nextGrid = prev.map(row => [...row]);
                const x = playerPos.x;
                const y = playerPos.y;
                const nx = x + dx;
                const ny = y + dy;
                const nnx = nx + dx;
                const nny = ny + dy;

                // Logic Helper: 
                // Cell Types: 0=Floor, 1=Wall, 2=Box, 3=Target, 4=Player, 5=BoxOnTarget, 6=PlayerOnTarget

                const targetCell = nextGrid[ny][nx];
                
                // Check Walls
                if (targetCell === 1) return prev;

                // Check Moving into Empty Floor or Target
                if (targetCell === 0 || targetCell === 3) {
                    // Move Player
                    // Restore old cell
                    nextGrid[y][x] = (prev[y][x] === 6) ? 3 : 0;
                    // Set new cell
                    nextGrid[ny][nx] = (targetCell === 3) ? 6 : 4;
                    setPlayerPos({x: nx, y: ny});
                    return nextGrid;
                }

                // Check Pushing Box (2 or 5)
                if (targetCell === 2 || targetCell === 5) {
                    const beyondCell = nextGrid[nny][nnx];
                    // Can only push into Floor (0) or Target (3)
                    if (beyondCell === 0 || beyondCell === 3) {
                         // Move Box
                         nextGrid[nny][nnx] = (beyondCell === 3) ? 5 : 2;
                         
                         // Move Player
                         // Restore old player spot
                         nextGrid[y][x] = (prev[y][x] === 6) ? 3 : 0;
                         // Set new player spot (where box was)
                         nextGrid[ny][nx] = (targetCell === 5) ? 6 : 4; // If box was on target, now player is on target
                         
                         setPlayerPos({x: nx, y: ny});
                         
                         if (!nextGrid.some(r => r.includes(2))) {
                             setWon(true);
                         }

                         return nextGrid;
                    }
                }
                
                return prev;
            });
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [playerPos, won]);

    // Map cell values to colors/chars
    const renderCell = (val: number) => {
        switch(val) {
            case 1: return <div className="w-full h-full bg-gray-700 border border-gray-600"></div>; // Wall
            case 2: return <div className="w-full h-full bg-yellow-600 border-2 border-yellow-400 flex items-center justify-center text-[10px]">box</div>; // Box
            case 3: return <div className="w-full h-full flex items-center justify-center"><div className="w-2 h-2 bg-red-500 rounded-full"></div></div>; // Target
            case 4: return <div className="w-full h-full bg-blue-500 border border-blue-300 flex items-center justify-center">☺</div>; // Player
            case 5: return <div className="w-full h-full bg-green-500 border-2 border-green-300 flex items-center justify-center">✓</div>; // Box on Target
            case 6: return <div className="w-full h-full bg-blue-500 border border-blue-300 flex items-center justify-center">☺</div>; // Player on Target
            default: return null; // Floor
        }
    };

    return (
        <div className="flex flex-col items-center">
             <div className="mb-2 flex justify-between w-full px-4 font-mono text-xs font-bold text-terminal-green">
                <span>SOKOBAN</span>
                <span>{won ? 'VICTORY!' : 'PUSH BOXES'}</span>
            </div>
            <div 
                className="grid bg-black border-2 border-terminal-green p-1"
                style={{
                    gridTemplateColumns: `repeat(7, 25px)`,
                    gridTemplateRows: `repeat(7, 25px)`,
                    gap: '1px'
                }}
            >
                {grid.flat().map((cell, i) => (
                    <div key={i} className="w-[25px] h-[25px] bg-[#111]">
                        {renderCell(cell)}
                    </div>
                ))}
            </div>
            <div className="mt-4 text-[10px] text-gray-500 cursor-pointer underline hover:text-white" onClick={reset}>
                {won ? 'PLAY AGAIN' : 'RESET LEVEL'}
            </div>
        </div>
    );
};

// --- MEMORY MATCH COMPONENT ---
const SYMBOLS = ['{}', '[]', '()', '&&', '||', '!=', '=>', '++'];

interface Card {
    id: number;
    val: string;
    flipped: boolean;
    matched: boolean;
}

const MemoryGame = () => {
    const [cards, setCards] = useState<Card[]>([]);
    const [turns, setTurns] = useState(0);
    const [disabled, setDisabled] = useState(false);
    const [firstChoice, setFirstChoice] = useState<Card | null>(null);
    const [secondChoice, setSecondChoice] = useState<Card | null>(null);

    const shuffleCards = () => {
        const shuffled = [...SYMBOLS, ...SYMBOLS]
            .sort(() => Math.random() - 0.5)
            .map((val, id) => ({ id, val, flipped: false, matched: false }));
        
        setFirstChoice(null);
        setSecondChoice(null);
        setCards(shuffled);
        setTurns(0);
    };

    useEffect(() => {
        shuffleCards();
    }, []);

    useEffect(() => {
        if (firstChoice && secondChoice) {
            setDisabled(true);
            if (firstChoice.val === secondChoice.val) {
                setCards(prev => prev.map(card => 
                    card.val === firstChoice.val ? { ...card, matched: true } : card
                ));
                resetTurn();
            } else {
                setTimeout(() => resetTurn(), 1000);
            }
        }
    }, [firstChoice, secondChoice]);

    const resetTurn = () => {
        setFirstChoice(null);
        setSecondChoice(null);
        setCards(prev => prev.map(card => ({ ...card, flipped: card.matched })));
        setDisabled(false);
        setTurns(t => t + 1);
    };

    const handleChoice = (card: Card) => {
        if (disabled || card.flipped || card.matched) return;
        
        // Visual flip immediately
        setCards(prev => prev.map(c => c.id === card.id ? { ...c, flipped: true } : c));

        firstChoice ? setSecondChoice(card) : setFirstChoice(card);
    };

    const isWin = cards.length > 0 && cards.every(c => c.matched);

    return (
        <div className="flex flex-col items-center">
             <div className="mb-2 flex justify-between w-full px-4 font-mono text-xs font-bold text-terminal-green">
                <span>MEMORY</span>
                <span>TURNS: {turns}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
                {cards.map(card => (
                    <div 
                        key={card.id} 
                        className={`
                            w-10 h-10 flex items-center justify-center text-xs font-bold cursor-pointer transition-all duration-300
                            border border-terminal-green
                            ${card.flipped || card.matched ? 'bg-terminal-green text-black rotate-y-180' : 'bg-black text-terminal-green'}
                        `}
                        onClick={() => handleChoice(card)}
                    >
                        {(card.flipped || card.matched) ? card.val : '?'}
                    </div>
                ))}
            </div>
             {isWin && (
                 <div className="mt-4 text-sm font-bold animate-bounce text-terminal-green cursor-pointer" onClick={shuffleCards}>
                     ALL MATCHED! RESTART
                 </div>
             )}
             {!isWin && (
                 <div className="mt-4 text-[10px] text-gray-500">FIND MATCHING PAIRS</div>
             )}
        </div>
    );
};


interface LoadingScreenProps {
  message: string;
  fileNames?: string[];
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message, fileNames = [] }) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [gameIndex, setGameIndex] = useState(0);
  
  // State for active tips - initialize with standard list first to avoid empty flash
  const [activeTips, setActiveTips] = useState<string[]>([]);
  const [isFetchingTips, setIsFetchingTips] = useState(false);

  // Game Registry
  const GAMES = [
      <SnakeGame key="snake" />, 
      <XO key="xo" />, 
      <SokobanGame key="sokoban" />,
      <MemoryGame key="memory" />
  ];

  // Calculate initial static tips synchronously on mount
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
      // Fallback to general if no context matched
      const initialSet = uniqueRelevant.length > 0 ? uniqueRelevant : GENERAL_TIPS;
      setActiveTips(initialSet);

      // Trigger AI Fetch to get new tips
      const fetchNewTips = async () => {
          setIsFetchingTips(true);
          const newAiTips = await generateLoadingTips(fileNames);
          if (newAiTips && newAiTips.length > 0) {
              // Append new AI tips to the rotation immediately
              setActiveTips(prev => {
                  // Combine unique tips
                  const combined = Array.from(new Set([...newAiTips, ...prev]));
                  // Shuffle slightly
                  return combined.sort(() => Math.random() - 0.5);
              });
          }
          setIsFetchingTips(false);
      };
      
      fetchNewTips();
  }, [fileNames]);

  useEffect(() => {
      // Pick a random game once on mount
      setGameIndex(Math.floor(Math.random() * GAMES.length));
      
      const interval = setInterval(() => {
          setTipIndex(prev => (prev + 1) % activeTips.length);
      }, 5000); 
      return () => clearInterval(interval);
  }, [activeTips]);

  // Helper to style code snippets in tips (enclosed in backticks)
  const formatTip = (text: string) => {
      const parts = text.split('`');
      return parts.map((part, i) => {
          if (i % 2 === 1) {
              // It's code (inside backticks)
              return <span key={i} className="bg-gray-300 dark:bg-gray-700 text-red-600 dark:text-terminal-green font-bold px-1 rounded mx-0.5">{part}</span>;
          }
          return <span key={i}>{part}</span>;
      });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full max-w-xl mx-auto p-6 space-y-8 animate-fade-in">
      {/* Status Section */}
      <div className="text-center space-y-4">
         <div className="w-20 h-20 mx-auto relative">
            <div className="absolute inset-0 border-4 border-t-terminal-green border-r-transparent border-b-terminal-green border-l-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-t-transparent border-r-blue-500 border-b-transparent border-l-blue-500 rounded-full animate-spin-slow opacity-70"></div>
         </div>
         <h2 className="font-mono text-xl font-bold animate-pulse text-terminal-green">{message}</h2>
      </div>

      {/* Info/Tip Section */}
      <div className="w-full bg-gray-100 dark:bg-[#1a1a1a] p-4 border-l-4 border-blue-500 shadow-md transition-all duration-500">
          <div className="flex justify-between items-center mb-1">
             <div className="text-[10px] font-bold text-gray-400 uppercase">
                {isFetchingTips ? 'GENERATING_FRESH_TIPS...' : 'CONTEXT_AWARE_HINT'}
             </div>
             {isFetchingTips && <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>}
          </div>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300 min-h-[3rem] flex items-center flex-wrap">
              {activeTips.length > 0 && formatTip(activeTips[tipIndex])}
          </p>
      </div>

      {/* Mini Game Section */}
      <div className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-black p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 bg-gray-200 dark:bg-gray-800 px-3 py-1 text-[10px] font-bold tracking-widest">
              WAITING_ROOM_MODULE.EXE
          </div>
          <div className="mt-4 flex justify-center min-h-[220px] items-center">
              {GAMES[gameIndex]}
          </div>
          {/* Game Switcher (Easter Egg) */}
          <div className="absolute bottom-1 right-2 flex gap-1">
              <button onClick={() => setGameIndex((i) => (i + 1) % GAMES.length)} className="text-[9px] text-gray-600 hover:text-terminal-green">
                  NEXT_GAME &gt;
              </button>
          </div>
      </div>
    </div>
  );
};
