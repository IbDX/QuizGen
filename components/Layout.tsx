import React, { useState, useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  onHome: () => void;
  isFullWidth: boolean;
  onToggleFullWidth: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onHome, isFullWidth, onToggleFullWidth }) => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [crtEnabled, setCrtEnabled] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Apply root font size for global scaling
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  return (
    <div className={`min-h-screen flex flex-col font-mono selection:bg-terminal-green selection:text-terminal-black`}>
      {/* Header / Terminal Bar */}
      <header className="border-b-2 border-gray-300 dark:border-terminal-green p-4 flex justify-between items-center bg-gray-200 dark:bg-gray-900 sticky top-0 z-40 shadow-md">
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
        
        <div className="flex gap-2 items-center">
           {/* Settings Trigger */}
           <button
            onClick={() => setShowSettings(true)}
            className="p-2 border border-gray-400 dark:border-terminal-green hover:bg-gray-300 dark:hover:bg-terminal-green dark:hover:text-black transition-colors text-gray-700 dark:text-terminal-green"
            title="System Preferences"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
           </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-grow p-4 md:p-8 w-full transition-all duration-300 ${isFullWidth ? 'px-4' : 'max-w-5xl mx-auto'}`}>
        <div className="relative">
          {/* CRT Scanline Effect (Optional visual flair) */}
          {crtEnabled && (
             <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(0,255,65,0.03)] opacity-0 dark:opacity-100 h-full w-full z-0" style={{backgroundSize: '100% 4px'}}></div>
          )}
          <div className="relative z-10">
             {children}
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-gray-500 dark:text-gray-600 border-t border-gray-300 dark:border-gray-800">
        STATUS: ONLINE | SYSTEM: READY | V1.2.0
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-terminal-green w-full max-w-md shadow-2xl p-6 animate-fade-in relative">
                <button 
                    onClick={() => setShowSettings(false)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
                >
                    ✕
                </button>
                
                <h2 className="text-xl font-bold mb-6 border-b border-gray-300 dark:border-gray-700 pb-2 flex items-center gap-2 text-gray-800 dark:text-terminal-green">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    SYSTEM PREFERENCES
                </h2>

                <div className="space-y-6 text-gray-800 dark:text-gray-200">
                    {/* Font Size Control */}
                    <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-gray-600 dark:text-terminal-green">Global Font Scale</label>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold">A</span>
                            <input 
                                type="range" 
                                min="12" 
                                max="24" 
                                step="1" 
                                value={fontSize} 
                                onChange={(e) => setFontSize(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600 dark:accent-terminal-green"
                            />
                            <span className="text-xl font-bold">A</span>
                        </div>
                        <div className="text-center font-mono text-xs mt-1 opacity-70">{fontSize}px</div>
                    </div>

                    {/* Full Width Toggle */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black">
                        <span className="font-bold text-sm">Full Width View</span>
                        <button 
                            onClick={onToggleFullWidth}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${isFullWidth ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isFullWidth ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    {/* CRT Toggle */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black">
                        <span className="font-bold text-sm">CRT Scanlines</span>
                        <button 
                            onClick={() => setCrtEnabled(!crtEnabled)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${crtEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${crtEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black">
                        <span className="font-bold text-sm">Dark Mode</span>
                        <button 
                            onClick={() => setDarkMode(!darkMode)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                </div>

                <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full mt-8 py-3 bg-gray-800 hover:bg-gray-700 dark:bg-terminal-green dark:hover:bg-terminal-dimGreen text-white dark:text-black font-bold uppercase transition-colors"
                >
                    SAVE & CLOSE
                </button>
            </div>
        </div>
      )}
    </div>
  );
};