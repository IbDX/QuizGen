
import React, { useState, useEffect, useMemo, useRef } from 'react';

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

interface LoadingScreenProps {
  message: string;
  fileNames?: string[];
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message, fileNames = [] }) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [GameComponent, setGameComponent] = useState<React.ReactNode>(null);

  // Compute tips based on file names
  const activeTips = useMemo(() => {
    const relevantTips: string[] = [];
    
    if (fileNames.length > 0) {
        fileNames.forEach(name => {
            const lowerName = name.toLowerCase();
            // Iterate through known contexts
            Object.keys(CONTEXT_TIPS).forEach(key => {
                // Avoid "Java" matching "Javascript" incorrectly by checking strict bounds or specific logic if needed
                if (key === 'java' && lowerName.includes('javascript')) return;

                if (lowerName.includes(key)) {
                    relevantTips.push(...CONTEXT_TIPS[key]);
                }
            });
        });
    }

    // Remove duplicates using Set
    const uniqueRelevant = Array.from(new Set(relevantTips));

    // If we found relevant tips, use them. Otherwise (or if mixed with empty), add some general ones or fall back entirely.
    // To keep it fresh, if we have relevant tips, we prioritize them, but maybe mix in a few general ones if list is short.
    if (uniqueRelevant.length > 0) {
        return uniqueRelevant;
    }
    
    return GENERAL_TIPS;
  }, [fileNames]);

  useEffect(() => {
      // Randomly choose a game on mount
      setGameComponent(Math.random() > 0.5 ? <SnakeGame /> : <XO />);
      
      const interval = setInterval(() => {
          setTipIndex(prev => (prev + 1) % activeTips.length);
      }, 5000); // Slightly longer duration to read technical tips
      return () => clearInterval(interval);
  }, [activeTips]);

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
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
              {activeTips === GENERAL_TIPS ? 'SYSTEM_INFO / RANDOM_FACT' : 'CONTEXT_AWARE_HINT'}
          </div>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300 min-h-[3rem] flex items-center">
              {activeTips[tipIndex]}
          </p>
      </div>

      {/* Mini Game Section */}
      <div className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-black p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 bg-gray-200 dark:bg-gray-800 px-3 py-1 text-[10px] font-bold tracking-widest">
              WAITING_ROOM_MODULE.EXE
          </div>
          <div className="mt-4 flex justify-center">
              {GameComponent}
          </div>
      </div>
    </div>
  );
};
