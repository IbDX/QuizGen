import React, { useState, useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  onHome: () => void;
  isFullWidth: boolean;
  onToggleFullWidth: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onHome, isFullWidth, onToggleFullWidth }) => {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className={`min-h-screen flex flex-col font-mono selection:bg-terminal-green selection:text-terminal-black`}>
      {/* Header / Terminal Bar */}
      <header className="border-b-2 border-gray-300 dark:border-terminal-green p-4 flex justify-between items-center bg-gray-200 dark:bg-gray-900 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          {/* Z+ Logo / Home Button */}
          <button 
            onClick={onHome}
            className="flex items-center justify-center w-10 h-10 bg-black text-white border-2 border-terminal-green hover:scale-110 transition-transform cursor-pointer shadow-[0_0_10px_rgba(0,255,65,0.5)]"
            title="Return to Main Menu"
          >
             <span className="font-bold text-xl italic font-mono">Z+</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex gap-2 hidden md:flex">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <h1 className="text-xl font-bold tracking-tighter hidden sm:block">
              <span className="text-gray-500 dark:text-gray-400">~/</span>
              <span className="text-blue-600 dark:text-blue-400">exam-gen</span>
              <span className="animate-pulse">_</span>
            </h1>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={onToggleFullWidth}
            className="px-3 py-1 border border-gray-400 dark:border-terminal-green text-xs hover:bg-gray-300 dark:hover:bg-terminal-green dark:hover:text-black transition-colors uppercase font-bold"
          >
            [{isFullWidth ? 'COMPRESS' : 'EXPAND'}]
          </button>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="px-3 py-1 border border-gray-400 dark:border-terminal-green text-xs hover:bg-gray-300 dark:hover:bg-terminal-green dark:hover:text-black transition-colors uppercase"
          >
            [{darkMode ? 'LIGHT' : 'DARK'}]
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-grow p-4 md:p-8 w-full transition-all duration-300 ${isFullWidth ? 'px-4' : 'max-w-5xl mx-auto'}`}>
        <div className="relative">
          {/* CRT Scanline Effect (Optional visual flair) */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(0,255,65,0.03)] opacity-0 dark:opacity-100 h-full w-full z-0"></div>
          <div className="relative z-10">
             {children}
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-gray-500 dark:text-gray-600 border-t border-gray-300 dark:border-gray-800">
        STATUS: ONLINE | SYSTEM: READY | V1.1.0
      </footer>
    </div>
  );
};