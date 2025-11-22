
import React, { useState, useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  onHome: () => void;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
  isFullWidth: boolean;
  onToggleFullWidth: () => void;
}

// Base64 SVG for a Terminal/Cyberpunk Arrow Cursor
// Black fill, Green (#00ff41) Stroke, Sharp angles.
const CURSOR_DEFAULT_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 2L9 21L12.5 12.5L21 9L2 2Z" fill="#000000" stroke="#00ff41" stroke-width="1.5" stroke-linejoin="round"/>
</svg>
`;

// Pointer State (Hovering Links/Buttons) - Filled Green
const CURSOR_POINTER_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 2L9 21L12.5 12.5L21 9L2 2Z" fill="#00ff41" stroke="#003300" stroke-width="1" stroke-linejoin="round"/>
</svg>
`;

// Text State (Inputs) - Bracket Style I-Beam
const CURSOR_TEXT_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M5 4V2H11V4" stroke="#00ff41" stroke-width="2"/>
<path d="M8 4V20" stroke="#00ff41" stroke-width="2"/>
<path d="M5 20V22H11V20" stroke="#00ff41" stroke-width="2"/>
</svg>
`;

const CURSOR_URI = `data:image/svg+xml;base64,${btoa(CURSOR_DEFAULT_SVG)}`;
const POINTER_URI = `data:image/svg+xml;base64,${btoa(CURSOR_POINTER_SVG)}`;
const TEXT_URI = `data:image/svg+xml;base64,${btoa(CURSOR_TEXT_SVG)}`;

const FONT_OPTIONS = [
    { name: 'Fira Code', value: "'Fira Code', monospace" },
    { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
    { name: 'Roboto Mono', value: "'Roboto Mono', monospace" },
    { name: 'Courier New', value: "'Courier New', Courier, monospace" },
];

export const Layout: React.FC<LayoutProps> = ({ children, onHome, onToggleLibrary, isLibraryOpen, isFullWidth, onToggleFullWidth }) => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [useCustomCursor, setUseCustomCursor] = useState(true);
  
  // New Settings
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [autoHideHeader, setAutoHideHeader] = useState(true);

  // Header Visibility State
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Apply Font Family
  useEffect(() => {
      document.body.style.fontFamily = fontFamily;
  }, [fontFamily]);

  // Header Auto-Hide Logic
  useEffect(() => {
      if (!autoHideHeader) {
          setIsHeaderVisible(true);
          return;
      }

      const timer = setTimeout(() => {
          if (!isMobileMenuOpen) setIsHeaderVisible(false);
      }, 1500);
      return () => clearTimeout(timer);
  }, [autoHideHeader, isMobileMenuOpen]);

  const handleMouseEnterHeader = () => {
      if (autoHideHeader) setIsHeaderVisible(true);
  };

  const handleMouseLeaveHeader = () => {
      if (autoHideHeader && !isMobileMenuOpen && !showSettings) {
          setIsHeaderVisible(false);
      }
  };

  return (
    <div className={`min-h-screen flex flex-col font-mono selection:bg-terminal-green selection:text-terminal-black ${useCustomCursor ? 'custom-cursor' : ''}`}>
      
      {/* Inject Custom Cursor Styles */}
      {useCustomCursor && (
        <style>{`
          /* Default State */
          .custom-cursor {
            cursor: url('${CURSOR_URI}') 2 2, auto !important;
          }
          
          /* Pointer State (Links, Buttons) */
          .custom-cursor a, 
          .custom-cursor button, 
          .custom-cursor [role="button"],
          .custom-cursor .cursor-pointer,
          .custom-cursor select,
          .custom-cursor label {
            cursor: url('${POINTER_URI}') 2 2, pointer !important;
          }

          /* Text Selection State (Inputs) */
          .custom-cursor input[type="text"],
          .custom-cursor input[type="number"],
          .custom-cursor input[type="password"],
          .custom-cursor input[type="email"],
          .custom-cursor textarea,
          .custom-cursor .prism-editor-textarea {
            cursor: url('${TEXT_URI}') 6 12, text !important;
          }
        `}</style>
      )}

      {/* Sensor Strip - Invisible area at top to trigger header when hidden - DESKTOP ONLY */}
      {autoHideHeader && (
          <div 
            className="hidden md:block fixed top-0 left-0 w-full h-6 z-50 bg-transparent"
            onMouseEnter={handleMouseEnterHeader}
          />
      )}

      {/* Visual Cue for Hidden Header - DESKTOP ONLY */}
      {autoHideHeader && (
        <div 
            className={`hidden md:flex fixed top-0 left-1/2 -translate-x-1/2 z-40 transition-all duration-700 ease-in-out pointer-events-none flex-col items-center ${isHeaderVisible ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}
        >
            <div className="w-32 h-1.5 bg-gray-400/50 dark:bg-terminal-green/30 rounded-b-full shadow-[0_0_10px_rgba(0,255,65,0.2)] backdrop-blur-sm animate-pulse"></div>
            <div className="text-[8px] font-bold text-gray-400 dark:text-terminal-green/50 mt-0.5 tracking-[0.2em] uppercase opacity-70">
               MENU
            </div>
        </div>
      )}

      {/* Animated Header */}
      <header 
        className={`
            fixed top-0 left-0 right-0 z-40 
            bg-gray-200/95 dark:bg-gray-900/95 backdrop-blur-md 
            border-b-2 border-gray-300 dark:border-terminal-green 
            shadow-lg transition-transform duration-700 ease-in-out
            h-16 md:h-20
            translate-y-0
            ${isMobileMenuOpen ? '' : (isHeaderVisible ? 'md:translate-y-0' : 'md:-translate-y-full')}
        `}
        onMouseLeave={handleMouseLeaveHeader}
        onMouseEnter={handleMouseEnterHeader}
      >
        <div className="p-4 flex justify-between items-center h-full max-w-7xl mx-auto">
            <div className="flex items-center pl-2">
            {/* Z+ Logo / Home Button */}
            <button 
                onClick={onHome}
                className="relative group outline-none focus:outline-none"
                title="Return to Main Menu"
            >
                <div className="absolute -inset-1 bg-terminal-green rounded-full blur opacity-20 group-hover:opacity-60 transition duration-500 animate-pulse"></div>
                <div className="relative flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black border-2 border-terminal-green group-hover:border-white transition-all duration-300 shadow-[0_0_10px_rgba(0,255,65,0.3)] group-hover:shadow-[0_0_20px_rgba(0,255,65,0.8)] group-hover:scale-110 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-terminal-green/10 to-transparent translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700"></div>
                    <span className="font-bold text-xl md:text-2xl italic font-mono text-white group-hover:text-terminal-green transition-colors z-10">Z+</span>
                </div>
            </button>
            </div>
            
            {/* DESKTOP NAVIGATION */}
            <div className="hidden md:flex gap-4 items-center">
                <button
                    onClick={onToggleLibrary}
                    className={`p-2 border transition-colors group ${isLibraryOpen ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-400 dark:border-terminal-green hover:bg-gray-300 dark:hover:bg-terminal-green dark:hover:text-black text-gray-700 dark:text-terminal-green'}`}
                    title={isLibraryOpen ? "Close Library" : "Open Question Library"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${!isLibraryOpen && 'group-hover:scale-110 transition-transform'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                </button>

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

            {/* MOBILE HAMBURGER BUTTON */}
            <div className="md:hidden">
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-gray-800 dark:text-terminal-green hover:bg-gray-200 dark:hover:bg-gray-800 rounded border border-transparent hover:border-gray-400 dark:hover:border-terminal-green transition-all"
                >
                    <div className="space-y-1.5">
                        <div className={`w-6 h-0.5 bg-current transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
                        <div className={`w-6 h-0.5 bg-current transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></div>
                        <div className={`w-6 h-0.5 bg-current transition-transform duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
                    </div>
                </button>
            </div>
        </div>

        {/* MOBILE MENU DROPDOWN */}
        <div className={`md:hidden overflow-hidden transition-all duration-500 ease-in-out bg-gray-100 dark:bg-black border-b border-gray-300 dark:border-terminal-green ${isMobileMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col p-4 gap-2">
                 <button 
                    onClick={() => { onHome(); setIsMobileMenuOpen(false); }}
                    className="p-4 text-left font-bold text-sm hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-black border border-gray-300 dark:border-gray-800 text-gray-700 dark:text-terminal-green transition-colors"
                 >
                    HOME
                 </button>
                 <button 
                    onClick={() => { onToggleLibrary(); setIsMobileMenuOpen(false); }}
                    className={`p-4 text-left font-bold text-sm border transition-colors ${isLibraryOpen ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-black text-gray-700 dark:text-terminal-green'}`}
                 >
                    {isLibraryOpen ? 'CLOSE LIBRARY' : 'OPEN LIBRARY'}
                 </button>
                 <button 
                    onClick={() => { setShowSettings(true); setIsMobileMenuOpen(false); }}
                    className="p-4 text-left font-bold text-sm hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-black border border-gray-300 dark:border-gray-800 text-gray-700 dark:text-terminal-green transition-colors"
                 >
                    SETTINGS
                 </button>
            </div>
        </div>
      </header>

      {/* Main Content Area - Adjusted padding for fixed header */}
      <main className={`flex-grow p-4 md:p-8 w-full transition-all duration-300 pt-20 md:pt-28 ${isFullWidth ? 'px-4' : 'max-w-5xl mx-auto'}`}>
        <div className="relative">
          <div className="relative z-10">
             {children}
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-gray-500 dark:text-gray-600 border-t border-gray-300 dark:border-gray-800">
        STATUS: ONLINE | SYSTEM: READY | V1.4.0 | VIRUSTOTAL: ACTIVE
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-default">
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
                    {/* Font Family Selection */}
                    <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-gray-600 dark:text-terminal-green">System Font</label>
                        <select 
                            value={fontFamily}
                            onChange={(e) => setFontFamily(e.target.value)}
                            className="w-full p-2 bg-gray-200 dark:bg-black border border-gray-300 dark:border-gray-700 rounded text-sm font-mono"
                        >
                            {FONT_OPTIONS.map(font => (
                                <option key={font.name} value={font.value}>{font.name}</option>
                            ))}
                        </select>
                    </div>

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
                    
                    {/* Sticky / Auto-Hide Header Toggle - HIDDEN ON MOBILE (Always Sticky) */}
                    <div className="hidden md:flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black">
                        <div>
                            <span className="font-bold text-sm block">Auto-Hide Menu</span>
                            <span className="text-[10px] text-gray-500 uppercase">Hides when not in use</span>
                        </div>
                        <button 
                            onClick={() => setAutoHideHeader(!autoHideHeader)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${autoHideHeader ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${autoHideHeader ? 'translate-x-6' : 'translate-x-0'}`}></div>
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

                    {/* Custom Cursor Toggle (PC Only) */}
                    <div className="hidden md:flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black">
                        <div>
                            <span className="font-bold text-sm block">Terminal Cursor</span>
                            <span className="text-[10px] text-gray-500 uppercase">Themed Pointer</span>
                        </div>
                        <button 
                            onClick={() => setUseCustomCursor(!useCustomCursor)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${useCustomCursor ? 'bg-terminal-green' : 'bg-gray-300 dark:bg-gray-700'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${useCustomCursor ? 'translate-x-6' : 'translate-x-0'}`}></div>
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
