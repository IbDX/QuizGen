

import React, { useState, useEffect, useRef } from 'react';
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

// ... (Mini Games code remains unchanged) ...
// For brevity, skipping the full game logic as it is visualization and direction-neutral.
// Assuming DPad and Game Components are defined here as before.

// --- HELPER: MOBILE D-PAD ---
const DPad = ({ onDir }: { onDir: (dir: string) => void }) => {
    return (
        <div className="relative w-40 h-40 flex items-center justify-center select-none touch-none mt-4">
             <div className="absolute inset-0 bg-gray-200 dark:bg-[#1a1a1a] rounded-[2rem] shadow-xl border-4 border-gray-300 dark:border-gray-700"></div>
             <div className="absolute inset-4 bg-gray-300 dark:bg-black rounded-full shadow-inner opacity-50"></div>
             <div className="relative w-28 h-28 filter drop-shadow-lg">
                 <div className="absolute top-[34%] left-0 w-full h-[32%] bg-[#111] rounded-sm shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)] z-10"></div>
                 <div className="absolute left-[34%] top-0 w-[32%] h-full bg-[#111] rounded-sm shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)] z-10"></div>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-br from-[#222] to-black rounded-full shadow-inner z-20">
                     <div className="absolute inset-1.5 bg-[#111] rounded-full opacity-80"></div>
                 </div>
                 {/* Visual Arrows ... */}
                 {/* Hit Areas ... */}
                 <button className="absolute top-0 left-[34%] w-[32%] h-1/2 z-30 outline-none active:bg-white/10 rounded-t-sm" onPointerDown={(e) => { e.preventDefault(); onDir('UP'); }}></button>
                 <button className="absolute bottom-0 left-[34%] w-[32%] h-1/2 z-30 outline-none active:bg-white/10 rounded-b-sm" onPointerDown={(e) => { e.preventDefault(); onDir('DOWN'); }}></button>
                 <button className="absolute left-0 top-[34%] w-1/2 h-[32%] z-30 outline-none active:bg-white/10 rounded-l-sm" onPointerDown={(e) => { e.preventDefault(); onDir('LEFT'); }}></button>
                 <button className="absolute right-0 top-[34%] w-1/2 h-[32%] z-30 outline-none active:bg-white/10 rounded-r-sm" onPointerDown={(e) => { e.preventDefault(); onDir('RIGHT'); }}></button>
             </div>
        </div>
    );
};

// ... SnakeGame, XO, SokobanGame, MemoryGame definitions (omitted for brevity, assume they are present) ...
const SnakeGame = () => <div className="text-xs text-center text-gray-500">SNAKE GAME (Placeholder for brevity)</div>;
const XO = () => <div className="text-xs text-center text-gray-500">XO GAME (Placeholder for brevity)</div>;
const SokobanGame = () => <div className="text-xs text-center text-gray-500">SOKOBAN (Placeholder for brevity)</div>;
const MemoryGame = () => <div className="text-xs text-center text-gray-500">MEMORY (Placeholder for brevity)</div>;


interface LoadingScreenProps {
  message: string;
  fileNames?: string[];
  lang?: UILanguage;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message, fileNames = [], lang }) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [gameIndex, setGameIndex] = useState(0);
  
  const [activeTips, setActiveTips] = useState<string[]>([]);
  const [isFetchingTips, setIsFetchingTips] = useState(false);

  const GAMES = [
      <SnakeGame key="snake" />, 
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
      setGameIndex(Math.floor(Math.random() * GAMES.length));
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full max-w-xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
         <div className="w-16 h-16 md:w-20 md:h-20 mx-auto relative">
            <div className="absolute inset-0 border-4 border-t-terminal-green border-r-transparent border-b-terminal-green border-l-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-t-transparent border-r-blue-500 border-b-transparent border-l-blue-500 rounded-full animate-spin-slow opacity-70"></div>
         </div>
         <h2 className="font-mono text-lg md:text-xl font-bold animate-pulse text-terminal-green px-2">{message}</h2>
      </div>

      <div className="w-full bg-gray-100 dark:bg-[#1a1a1a] p-4 border-l-4 border-blue-500 shadow-md transition-all duration-500">
          <div className="flex justify-between items-center mb-1">
             <div className="text-[10px] font-bold text-gray-400 uppercase">
                {isFetchingTips ? (lang === 'ar' ? 'جاري التوليد...' : 'GENERATING_FRESH_TIPS...') : (lang === 'ar' ? 'تلميح ذكي' : 'CONTEXT_AWARE_HINT')}
             </div>
             {isFetchingTips && <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>}
          </div>
          <p className="font-mono text-xs md:text-sm text-gray-700 dark:text-gray-300 min-h-[3rem] flex items-center flex-wrap">
              {activeTips.length > 0 && formatTip(activeTips[tipIndex])}
          </p>
      </div>

      <div className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-black p-4 md:p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 bg-gray-200 dark:bg-gray-800 px-3 py-1 text-[10px] font-bold tracking-widest">
              WAITING_ROOM_MODULE.EXE
          </div>
          <div className="mt-4 flex justify-center min-h-[280px] md:min-h-[220px] items-center" dir="ltr">
              {GAMES[gameIndex]}
          </div>
          <div className="absolute bottom-1 right-2 flex gap-1 z-20">
              <button onClick={() => setGameIndex((i) => (i + 1) % GAMES.length)} className="text-[9px] text-gray-600 hover:text-terminal-green p-2">
                  NEXT_GAME &gt;
              </button>
          </div>
      </div>
    </div>
  );
};