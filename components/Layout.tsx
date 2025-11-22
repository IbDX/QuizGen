import React, { useState, useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  onHome: () => void;
  onOpenLibrary: () => void;
  isFullWidth: boolean;
  onToggleFullWidth: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onHome, onOpenLibrary, isFullWidth, onToggleFullWidth }) => {
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
    <div className={`min-h-screen flex flex-col font-mono selection:bg-palette-accent selection:text-white`}>
      {/* Header / Terminal Bar */}
      <header className="border-b-2 border-gray-300 dark:border-palette-accent p-4 flex justify-between items-center bg-gray-200 dark:bg-palette-header sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-6">
          {/* Z+ Logo / Home Button */}
          <button 
            onClick={onHome}
            className="flex items-center justify-center w-10 h-10 bg-black text-white border-2 border-palette-accent hover:scale-110 transition-transform cursor-pointer shadow-[0_0_10px_rgba(27,60,83,0.5)]"
            title="Return to Main Menu"
          >
             <span className="font-bold text-xl italic font-mono">Z+</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex gap-2 hidden md:flex">
              <div className="w-3 h-3 rounded-full bg-red-500 opacity-80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500 opacity-80"></div>
            </div>
            <h1 className="text-xl font-bold tracking-tighter hidden sm:block">
              <span className="text-gray-500 dark:text-palette-accent">~/</span>
              <span className="text-blue-600 dark:text-palette-text">exam-gen</span>
              <span className="animate-pulse text-palette-text">_</span>
            </h1>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
           {/* Library Button */}
           <button
            onClick={onOpenLibrary}
            className="p-2 border border-gray-400 dark:border-palette-accent hover:bg-gray-300 dark:hover:bg-palette-accent dark:hover:text-white transition-colors text-gray-700 dark:text-palette-text group"
            title="Question Library"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
             </svg>
           </button>

           {/* Settings Trigger */}
           <button
            onClick={() => setShowSettings(true)}
            className="p-2 border border-gray-400 dark:border-palette-accent hover:bg-gray-300 dark:hover:bg-palette-accent dark:hover:text-white transition-colors text-gray-700 dark:text-palette-text"
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
             <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.1)] opacity-0 dark:opacity-30 h-full w-full z-0" style={{backgroundSize: '100% 4px'}}></div>
          )}
          <div className="relative z-10">
             {children}
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-gray-500 dark:text-palette-text/50 border-t border-gray-300 dark:border-palette-accent">
        STATUS: ONLINE | SYSTEM: READY | V1.3.0 | VIRUSTOTAL: ACTIVE
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-palette-header border-2 border-gray-300 dark:border-palette-accent w-full max-w-md shadow-2xl p-6 animate-fade-in relative text-gray-900 dark:text-palette-text">
                <button 
                    onClick={() => setShowSettings(false)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
                >
                    ✕
                </button>
                
                <h2 className="text-xl font-bold mb-6 border-b border-gray-300 dark:border-palette-accent pb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    SYSTEM PREFERENCES
                </h2>

                <div className="space-y-6">
                    {/* Font Size Control */}
                    <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-gray-600 dark:text-palette-text">Global Font Scale</label>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold">A</span>
                            <input 
                                type="range" 
                                min="12" 
                                max="24" 
                                step="1" 
                                value={fontSize} 
                                onChange={(e) => setFontSize(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-palette-deep accent-blue-600 dark:accent-palette-text"
                            />
                            <span className="text-xl font-bold">A</span>
                        </div>
                        <div className="text-center font-mono text-xs mt-1 opacity-70">{fontSize}px</div>
                    </div>

                    {/* Full Width Toggle */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-palette-accent bg-gray-50 dark:bg-palette-deep">
                        <span className="font-bold text-sm">Full Width View</span>
                        <button 
                            onClick={onToggleFullWidth}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${isFullWidth ? 'bg-purple-600' : 'bg-gray-300 dark:bg-palette-accent/50'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isFullWidth ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    {/* CRT Toggle */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-palette-accent bg-gray-50 dark:bg-palette-deep">
                        <span className="font-bold text-sm">CRT Scanlines</span>
                        <button 
                            onClick={() => setCrtEnabled(!crtEnabled)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${crtEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-palette-accent/50'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${crtEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-palette-accent bg-gray-50 dark:bg-palette-deep">
                        <span className="font-bold text-sm">Dark Mode</span>
                        <button 
                            onClick={() => setDarkMode(!darkMode)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-palette-accent/50'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                </div>

                <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full mt-8 py-3 bg-gray-800 hover:bg-gray-700 dark:bg-palette-accent dark:hover:bg-palette-deep text-white dark:text-palette-text font-bold uppercase transition-colors"
                >
                    SAVE & CLOSE
                </button>
            </div>
        </div>
      )}
    </div>
  );
};