
import React, { useState, useEffect } from 'react';
import { BackgroundEffect } from './BackgroundEffect';
import { UILanguage } from '../types';
import { t } from '../utils/translations';
import { AiHelper } from './AiHelper';

export interface MobileAction {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'purple';
    disabled?: boolean;
}

interface LayoutProps {
  children: React.ReactNode;
  onHome: () => void;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
  isFullWidth: boolean;
  onToggleFullWidth: () => void;
  autoHideFooter?: boolean;
  onToggleAutoHideFooter?: () => void;
  mobileActions?: MobileAction[];
  uiLanguage: UILanguage;
  onSetUiLanguage: (lang: UILanguage) => void;
  forceStaticHeader?: boolean; // New prop to control header behavior
}

export type ThemeOption = 'light' | 'dark' | 'palestine';

// ... (CURSORS SVGs remain the same)
const CURSOR_DEFAULT_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 2L9 21L12.5 12.5L21 9L2 2Z" fill="#000000" stroke="#00ff41" stroke-width="1.5" stroke-linejoin="round"/>
</svg>
`;

const CURSOR_POINTER_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 2L9 21L12.5 12.5L21 9L2 2Z" fill="#00ff41" stroke="#003300" stroke-width="1" stroke-linejoin="round"/>
</svg>
`;

const CURSOR_TEXT_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M5 4V2H11V4" stroke="#00ff41" stroke-width="2"/>
<path d="M8 4V20" stroke="#00ff41" stroke-width="2"/>
<path d="M5 20V22H11V20" stroke="#00ff41" stroke-width="2"/>
</svg>
`;

const CURSOR_WAIT_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6 2H18V6L12 12L6 6V2Z" fill="#00ff41"/>
<path d="M6 22H18V18L12 12L6 18V22Z" fill="#00ff41" fill-opacity="0.5"/>
<path d="M6 2H18V6L14 10V14L18 18V22H6V18L10 14V10L6 6V2Z" stroke="#00ff41" stroke-width="2"/>
</svg>
`;

const CURSOR_NOT_ALLOWED_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="12" cy="12" r="8" stroke="#ff3333" stroke-width="2"/>
<path d="M6 6L18 18" stroke="#ff3333" stroke-width="2"/>
</svg>
`;

const CURSOR_GRAB_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 2C12 2 11 5 11 8V13H8V8C8 5 7 2 7 2" stroke="#00ff41" stroke-width="2"/>
<path d="M17 4C17 4 16 6 16 9V13H14" stroke="#00ff41" stroke-width="2"/>
<path d="M19 12V17C19 20 16 22 12 22C8 22 5 20 5 17V12" stroke="#00ff41" stroke-width="2"/>
</svg>
`;

const CURSOR_GRABBING_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="7" y="7" width="10" height="10" rx="2" fill="#00ff41"/>
<path d="M6 10H18M6 14H18" stroke="black" stroke-width="1"/>
<rect x="5" y="5" width="14" height="14" rx="3" stroke="#00ff41" stroke-width="2"/>
</svg>
`;

const CURSOR_CROSSHAIR_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 2V22M2 12H22" stroke="#00ff41" stroke-width="1"/>
<rect x="10" y="10" width="4" height="4" stroke="#00ff41" stroke-width="1" fill="none"/>
</svg>
`;

const b64 = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

const CURSORS = {
    default: b64(CURSOR_DEFAULT_SVG),
    pointer: b64(CURSOR_POINTER_SVG),
    text: b64(CURSOR_TEXT_SVG),
    wait: b64(CURSOR_WAIT_SVG),
    notAllowed: b64(CURSOR_NOT_ALLOWED_SVG),
    grab: b64(CURSOR_GRAB_SVG),
    grabbing: b64(CURSOR_GRABBING_SVG),
    crosshair: b64(CURSOR_CROSSHAIR_SVG)
};

const FONT_OPTIONS = [
    { name: 'Fira Code', value: "'Fira Code', monospace" },
    { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
    { name: 'Roboto Mono', value: "'Roboto Mono', monospace" },
    { name: 'Cairo (Arabic)', value: "'Cairo', sans-serif" },
    { name: 'Courier New', value: "'Courier New', Courier, monospace" },
];

// Enhanced 3D Z+ Logo
const ZPlusLogo: React.FC<{ theme: ThemeOption }> = ({ theme }) => {
    const isPalestine = theme === 'palestine';
    const isLight = theme === 'light';

    return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
            <defs>
                {/* Metallic Gradient for Terminal Mode */}
                <linearGradient id="termMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isLight ? "#1e3a8a" : "#0f3923"} />
                    <stop offset="50%" stopColor={isLight ? "#3b82f6" : "#00ff41"} />
                    <stop offset="100%" stopColor={isLight ? "#172554" : "#002200"} />
                </linearGradient>

                {/* Palestine Gradient */}
                <linearGradient id="palMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#000000" />
                    <stop offset="33%" stopColor="#CE1126" />
                    <stop offset="66%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor="#007A3D" />
                </linearGradient>

                {/* 3D Bevel Filter */}
                <filter id="bevel3d" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur"/>
                    <feSpecularLighting in="blur" surfaceScale="4" specularConstant="1.2" specularExponent="15" lightingColor="white" result="specOut">
                        <fePointLight x="-5000" y="-10000" z="20000"/>
                    </feSpecularLighting>
                    <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut"/>
                    <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litPaint"/>
                    <feDropShadow dx="2" dy="3" stdDeviation="2" floodOpacity="0.5"/>
                </filter>
            </defs>

            <g filter="url(#bevel3d)">
                {/* Z Shape - Left Side */}
                <path 
                    d="M15 25 H65 L25 75 H75" 
                    fill="none" 
                    stroke={isPalestine ? "#007A3D" : "url(#termMetal)"} 
                    strokeWidth="14" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                />
                
                {/* Plus Shape - Right Side */}
                <path 
                    d="M85 35 V65 M70 50 H100" 
                    fill="none" 
                    stroke={isPalestine ? "#CE1126" : "url(#termMetal)"} 
                    strokeWidth="12" 
                    strokeLinecap="round"
                />
            </g>
        </svg>
    );
};

export const Layout: React.FC<LayoutProps> = ({ 
    children, onHome, onToggleLibrary, isLibraryOpen, isFullWidth, onToggleFullWidth,
    autoHideFooter = true, onToggleAutoHideFooter, mobileActions,
    uiLanguage, onSetUiLanguage,
    forceStaticHeader = false
}) => {
  const [theme, setTheme] = useState<ThemeOption>('dark');
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [useCustomCursor, setUseCustomCursor] = useState(true);
  
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [autoHideHeader, setAutoHideHeader] = useState(false);
  const [enableBackgroundAnim, setEnableBackgroundAnim] = useState(false);

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Derive effective auto-hide behavior
  const shouldAutoHideHeader = autoHideHeader && !forceStaticHeader;

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'theme-palestine');
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (theme === 'palestine') {
        document.documentElement.classList.add('dark', 'theme-palestine');
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
      document.body.style.fontFamily = fontFamily;
  }, [fontFamily]);

  useEffect(() => {
      if (!shouldAutoHideHeader) {
          setIsHeaderVisible(true);
          return;
      }
      const timer = setTimeout(() => {
          if (!isMobileMenuOpen) setIsHeaderVisible(false);
      }, 1500);
      return () => clearTimeout(timer);
  }, [shouldAutoHideHeader, isMobileMenuOpen]);

  const handleMouseEnterHeader = () => {
      if (shouldAutoHideHeader) setIsHeaderVisible(true);
  };

  const handleMouseLeaveHeader = () => {
      if (shouldAutoHideHeader && !isMobileMenuOpen && !showSettings) {
          setIsHeaderVisible(false);
      }
  };

  const getActionColor = (variant?: string) => {
      switch(variant) {
          case 'primary': return 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700';
          case 'success': return 'bg-green-600 text-white border-green-600 hover:bg-green-700';
          case 'warning': return 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600';
          case 'purple': return 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700';
          default: return 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-black text-gray-700 dark:text-terminal-green';
      }
  };

  const isPalestine = theme === 'palestine';
  
  const headerBorderStyle = isPalestine 
    ? { borderBottomWidth: '2px', borderImage: 'linear-gradient(to right, #CE1126, #FFFFFF, #007A3D) 1' } 
    : {};
    
  const footerBorderStyle = isPalestine
    ? { borderTopWidth: '2px', borderImage: 'linear-gradient(to right, #007A3D, #FFFFFF, #CE1126) 1' }
    : {};
  
  const palestineBgStyle = isPalestine ? {
      background: 'radial-gradient(circle at 50% 50%, #2a2a2a 0%, #1a1a1a 100%)'
  } : {};

  return (
    <div 
        className={`min-h-screen flex flex-col font-mono selection:bg-terminal-green selection:text-terminal-black ${useCustomCursor ? 'custom-cursor' : ''} relative overflow-x-hidden transition-colors duration-500`} 
        dir={uiLanguage === 'ar' ? 'rtl' : 'ltr'}
        style={palestineBgStyle}
    >
      
      {enableBackgroundAnim && <BackgroundEffect theme={theme} />}
      
      <AiHelper lang={uiLanguage} onSetUiLanguage={onSetUiLanguage} />

      {useCustomCursor && (
        <style>{`
          .custom-cursor { cursor: url('${CURSORS.default}') 2 2, auto !important; }
          .custom-cursor a, .custom-cursor button:not(:disabled) { cursor: url('${CURSORS.pointer}') 2 2, pointer !important; }
          .custom-cursor input[type="text"], .custom-cursor textarea { cursor: url('${CURSORS.text}') 12 12, text !important; }
          .custom-cursor .cursor-wait { cursor: url('${CURSORS.wait}') 12 12, wait !important; }
        `}</style>
      )}

      {shouldAutoHideHeader && (
          <div 
            className="hidden md:block fixed top-0 left-0 w-full h-6 z-50 bg-transparent cursor-crosshair"
            onMouseEnter={handleMouseEnterHeader}
          />
      )}

      {shouldAutoHideHeader && (
        <div 
            className={`hidden md:flex fixed top-0 left-1/2 -translate-x-1/2 z-40 transition-all duration-700 ease-in-out pointer-events-none flex-col items-center ${isHeaderVisible ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}
        >
            <div className="w-32 h-1.5 bg-gray-400/50 dark:bg-terminal-green/30 rounded-b-full shadow-[0_0_10px_rgba(0,255,65,0.2)] backdrop-blur-sm animate-pulse"></div>
        </div>
      )}

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
        style={headerBorderStyle}
        onMouseLeave={handleMouseLeaveHeader}
        onMouseEnter={handleMouseEnterHeader}
      >
        <div className="p-4 flex justify-between items-center h-full max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
                <button 
                    onClick={onHome}
                    className="relative group outline-none focus:outline-none"
                    title={t('home', uiLanguage)}
                >
                    <div className="relative w-12 h-12 md:w-14 md:h-14 flex items-center justify-center">
                        <div className={`absolute -inset-2 blur opacity-20 group-hover:opacity-50 transition duration-500 ${isPalestine ? 'bg-red-500' : 'bg-terminal-green'}`}></div>
                        <div className={`relative z-10 w-full h-full flex items-center justify-center`}>
                            <ZPlusLogo theme={theme} />
                        </div>
                    </div>
                </button>
            </div>
            
            <div className="hidden md:flex gap-4 items-center">
                <button
                    onClick={onToggleLibrary}
                    className={`p-2 border transition-colors group ${isLibraryOpen ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-400 dark:border-terminal-green hover:bg-gray-300 dark:hover:bg-terminal-green dark:hover:text-black text-gray-700 dark:text-terminal-green'}`}
                    title={t('library', uiLanguage)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                </button>

                <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 border border-gray-400 dark:border-terminal-green hover:bg-gray-300 dark:hover:bg-terminal-green dark:hover:text-black transition-colors text-gray-700 dark:text-terminal-green"
                    title={t('settings', uiLanguage)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>

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

        {/* MOBILE MENU */}
        <div className={`md:hidden overflow-hidden transition-all duration-500 ease-in-out bg-gray-100 dark:bg-black border-b border-gray-300 dark:border-terminal-green ${isMobileMenuOpen ? 'max-h-[85vh] opacity-100 shadow-2xl overflow-y-auto' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col p-4 gap-4">
                 <div className="grid grid-cols-3 gap-3">
                     <button 
                        onClick={() => { onHome(); setIsMobileMenuOpen(false); }}
                        className="p-3 flex justify-center items-center rounded border border-gray-300 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-black text-gray-700 dark:text-terminal-green transition-colors"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                     </button>

                     <button 
                        onClick={() => { onToggleLibrary(); setIsMobileMenuOpen(false); }}
                        className={`p-3 flex justify-center items-center rounded border transition-colors ${isLibraryOpen ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-black text-gray-700 dark:text-terminal-green'}`}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                         </svg>
                     </button>

                     <button 
                        onClick={() => { setShowSettings(true); setIsMobileMenuOpen(false); }}
                        className="p-3 flex justify-center items-center rounded border border-gray-300 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-black text-gray-700 dark:text-terminal-green transition-colors"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                     </button>
                 </div>

                 {mobileActions && mobileActions.length > 0 && (
                     <>
                        <div className="border-t border-gray-300 dark:border-gray-800 my-2"></div>
                        <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 px-1 uppercase tracking-wider">
                            Actions
                        </div>
                        {mobileActions.map((action, i) => (
                             <button
                                key={i}
                                onClick={() => { if(!action.disabled) { action.onClick(); setIsMobileMenuOpen(false); } }}
                                disabled={action.disabled}
                                className={`p-4 text-left font-bold text-sm border transition-colors ${getActionColor(action.variant)} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                             >
                                {action.label}
                             </button>
                        ))}
                     </>
                 )}
            </div>
        </div>
      </header>

      <main className={`flex-grow p-4 md:p-8 w-full transition-all duration-300 pt-20 md:pt-28 z-10 ${isFullWidth ? 'px-4' : 'max-w-5xl mx-auto'}`}>
        <div className="relative">
          <div className="relative z-10">
             {children}
          </div>
        </div>
      </main>

      <footer 
        className="p-4 text-center text-xs text-gray-500 dark:text-gray-600 border-t border-gray-300 dark:border-gray-800 z-10 relative bg-gray-100/50 dark:bg-black/50 backdrop-blur-sm"
        style={footerBorderStyle}
      >
        {t('status_online', uiLanguage)} | V1.5.0
      </footer>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-default">
            <div className="bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-terminal-green w-full max-w-md shadow-2xl p-6 animate-fade-in relative max-h-[90vh] overflow-hidden flex flex-col">
                <button 
                    onClick={() => setShowSettings(false)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-red-500 z-10 bg-white dark:bg-gray-900 rounded-full p-1 rtl:left-2 rtl:right-auto"
                >
                    ✕
                </button>
                
                <h2 className="text-xl font-bold mb-6 border-b border-gray-300 dark:border-gray-700 pb-2 flex items-center gap-2 text-gray-800 dark:text-terminal-green shrink-0">
                    {t('system_preferences', uiLanguage)}
                </h2>

                <div className="space-y-6 text-gray-800 dark:text-gray-200 overflow-y-auto custom-scrollbar pr-2 flex-grow">
                    {/* UI Language Selection */}
                    <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-gray-600 dark:text-terminal-green">{t('system_language', uiLanguage)}</label>
                        <div className="grid grid-cols-2 gap-2">
                             <button
                                onClick={() => onSetUiLanguage('en')}
                                className={`p-2 border rounded text-xs font-bold transition-all ${uiLanguage === 'en' ? 'border-terminal-green bg-terminal-green text-black' : 'border-gray-700 bg-black text-gray-500'}`}
                             >
                                 ENGLISH
                             </button>
                             <button
                                onClick={() => onSetUiLanguage('ar')}
                                className={`p-2 border rounded text-xs font-bold transition-all font-sans ${uiLanguage === 'ar' ? 'border-terminal-green bg-terminal-green text-black' : 'border-gray-700 bg-black text-gray-500'}`}
                             >
                                 العربية (ARABIC)
                             </button>
                        </div>
                    </div>

                    {/* Theme Selection */}
                    <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-gray-600 dark:text-terminal-green">{t('ui_theme', uiLanguage)}</label>
                        <div className="grid grid-cols-3 gap-2">
                             <button onClick={() => setTheme('light')} className={`p-2 border rounded text-xs font-bold transition-all ${theme === 'light' ? 'border-blue-500 bg-blue-100 text-blue-800' : 'border-gray-300 bg-gray-100 text-gray-600'}`}>LIGHT</button>
                             <button onClick={() => setTheme('dark')} className={`p-2 border rounded text-xs font-bold transition-all ${theme === 'dark' ? 'border-terminal-green bg-terminal-gray text-terminal-green' : 'border-gray-700 bg-black text-gray-500'}`}>TERMINAL</button>
                             <button onClick={() => setTheme('palestine')} className={`p-2 border rounded text-xs font-bold transition-all relative overflow-hidden ${theme === 'palestine' ? 'border-red-500 text-white' : 'border-gray-700 bg-black text-gray-500'}`} style={theme === 'palestine' ? { background: 'linear-gradient(135deg, #CE1126 0%, #007A3D 100%)' } : {}}>PALESTINE</button>
                        </div>
                    </div>

                    {/* Font Family Selection */}
                    <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-gray-600 dark:text-terminal-green">{t('font_family', uiLanguage)}</label>
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
                        <label className="block text-sm font-bold mb-2 uppercase text-gray-600 dark:text-terminal-green">{t('global_font_scale', uiLanguage)}</label>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold">A</span>
                            <input type="range" min="12" max="24" step="1" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600 dark:accent-terminal-green"/>
                            <span className="text-xl font-bold">A</span>
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3">
                         <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black">
                             <span className="font-bold text-sm">{t('digital_background', uiLanguage)}</span>
                             <button onClick={() => setEnableBackgroundAnim(!enableBackgroundAnim)} className={`w-12 h-6 rounded-full p-1 transition-colors ${enableBackgroundAnim ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                 <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${enableBackgroundAnim ? (uiLanguage==='ar'?'translate-x-[-1.5rem]':'translate-x-6') : 'translate-x-0'}`}></div>
                             </button>
                         </div>
                         <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black">
                             <span className="font-bold text-sm">{t('full_width', uiLanguage)}</span>
                             <button onClick={onToggleFullWidth} className={`w-12 h-6 rounded-full p-1 transition-colors ${isFullWidth ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                 <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isFullWidth ? (uiLanguage==='ar'?'translate-x-[-1.5rem]':'translate-x-6') : 'translate-x-0'}`}></div>
                             </button>
                         </div>
                    </div>
                </div>

                <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full mt-6 py-3 bg-gray-800 hover:bg-gray-700 dark:bg-terminal-green dark:hover:bg-terminal-dimGreen text-white dark:text-black font-bold uppercase transition-colors shrink-0"
                >
                    {t('save_close', uiLanguage)}
                </button>
            </div>
        </div>
      )}
    </div>
  );
};