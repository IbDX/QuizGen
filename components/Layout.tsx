
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
  forceStaticHeader?: boolean;
}

export type ThemeOption = 'light' | 'dark' | 'palestine';

// Cursor SVGs updated to use variable-like colors or generic
const CURSOR_DEFAULT_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 2L9 21L12.5 12.5L21 9L2 2Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
</svg>
`;
// Note: Actual SVGs in data URIs usually need hardcoded colors unless using mask. 
// We keep the green/black aesthetic for the cursor as a stylistic choice for the "Terminal" feel.
const CURSOR_POINTER_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 2L9 21L12.5 12.5L21 9L2 2Z" fill="#10B981" stroke="#064E3B" stroke-width="1" stroke-linejoin="round"/>
</svg>
`;

const CURSOR_TEXT_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M5 4V2H11V4" stroke="#10B981" stroke-width="2"/>
<path d="M8 4V20" stroke="#10B981" stroke-width="2"/>
<path d="M5 20V22H11V20" stroke="#10B981" stroke-width="2"/>
</svg>
`;

const b64 = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

const CURSORS = {
    default: "auto", // Fallback
    pointer: b64(CURSOR_POINTER_SVG),
    text: b64(CURSOR_TEXT_SVG),
    // ... others simplified for brevity or keeping defaults
};

const FONT_OPTIONS = [
    { name: 'Fira Code', value: "'Fira Code', monospace" },
    { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
    { name: 'Roboto Mono', value: "'Roboto Mono', monospace" },
    { name: 'Cairo (Arabic)', value: "'Cairo', sans-serif" },
];

const ZPlusLogo: React.FC<{ theme: ThemeOption }> = ({ theme }) => {
    const isPalestine = theme === 'palestine';
    const isLight = theme === 'light';

    return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
            <defs>
                <linearGradient id="termMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isLight ? "#3b82f6" : "#22c55e"} />
                    <stop offset="100%" stopColor={isLight ? "#1d4ed8" : "#15803d"} />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <g filter="url(#glow)">
                <path 
                    d="M20 30 H70 L30 70 H80" 
                    fill="none" 
                    stroke={isPalestine ? "#15803d" : "url(#termMetal)"} 
                    strokeWidth="12" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                />
                <path 
                    d="M85 30 V60 M70 45 H100" 
                    fill="none" 
                    stroke={isPalestine ? "#dc2626" : "url(#termMetal)"} 
                    strokeWidth="10" 
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

  const handleMouseEnterHeader = () => { if (shouldAutoHideHeader) setIsHeaderVisible(true); };
  const handleMouseLeaveHeader = () => { if (shouldAutoHideHeader && !isMobileMenuOpen && !showSettings) setIsHeaderVisible(false); };

  return (
    <div 
        className={`min-h-screen flex flex-col font-mono selection:bg-terminal-green/30 selection:text-white ${useCustomCursor ? 'custom-cursor' : ''} relative overflow-x-hidden`} 
        dir={uiLanguage === 'ar' ? 'rtl' : 'ltr'}
    >
      {enableBackgroundAnim && <BackgroundEffect theme={theme} />}
      <AiHelper lang={uiLanguage} onSetUiLanguage={onSetUiLanguage} />

      {useCustomCursor && (
        <style>{`
          .custom-cursor a, .custom-cursor button:not(:disabled) { cursor: url('${CURSORS.pointer}') 10 10, pointer !important; }
          .custom-cursor input[type="text"], .custom-cursor textarea { cursor: url('${CURSORS.text}') 12 12, text !important; }
        `}</style>
      )}

      {shouldAutoHideHeader && (
          <div className="hidden md:block fixed top-0 left-0 w-full h-4 z-50 bg-transparent" onMouseEnter={handleMouseEnterHeader} />
      )}

      <header 
        className={`
            fixed top-0 left-0 right-0 z-40 
            bg-terminal-glass backdrop-blur-xl
            border-b border-terminal-gray/20
            shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.1)]
            transition-transform duration-500 ease-in-out
            h-16 md:h-20
            ${isMobileMenuOpen ? '' : (isHeaderVisible ? 'translate-y-0' : '-translate-y-full')}
        `}
        onMouseLeave={handleMouseLeaveHeader}
        onMouseEnter={handleMouseEnterHeader}
      >
        <div className="px-4 md:px-8 flex justify-between items-center h-full max-w-7xl mx-auto">
            {/* LOGO */}
            <div className="flex items-center gap-4">
                <button onClick={onHome} className="group outline-none" title={t('home', uiLanguage)}>
                    <div className="w-10 h-10 md:w-12 md:h-12 transition-transform group-hover:scale-110 duration-300">
                        <ZPlusLogo theme={theme} />
                    </div>
                </button>
                <div className="hidden md:flex flex-col justify-center">
                    <span className="font-bold text-lg leading-tight tracking-tight text-terminal-light">
                        Z+ <span className="text-terminal-green">EXAM</span>
                    </span>
                    <span className="text-[9px] tracking-[0.3em] text-gray-500 dark:text-gray-400 font-sans font-bold">GENERATION SYSTEM</span>
                </div>
            </div>
            
            {/* DESKTOP NAV */}
            <div className="hidden md:flex gap-3 items-center">
                <NavButton onClick={onToggleLibrary} active={isLibraryOpen} icon="📚" label={t('library', uiLanguage)} />
                <NavButton onClick={() => setShowSettings(true)} active={showSettings} icon="⚙️" label={t('settings', uiLanguage)} />
            </div>

            {/* MOBILE HAMBURGER */}
            <div className="md:hidden">
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-terminal-light hover:bg-terminal-gray/20 rounded-lg transition-all"
                >
                    <div className="space-y-1.5">
                        <span className={`block w-6 h-0.5 bg-current transition-transform ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                        <span className={`block w-6 h-0.5 bg-current transition-opacity ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
                        <span className={`block w-6 h-0.5 bg-current transition-transform ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                    </div>
                </button>
            </div>
        </div>

        {/* MOBILE MENU */}
        <div className={`md:hidden absolute top-full left-0 w-full bg-terminal-glass backdrop-blur-xl border-b border-terminal-gray/20 transition-all duration-300 overflow-hidden ${isMobileMenuOpen ? 'max-h-[80vh] opacity-100 shadow-xl' : 'max-h-0 opacity-0'}`}>
            <div className="p-4 space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                     <MobileNavButton onClick={() => { onHome(); setIsMobileMenuOpen(false); }} icon="🏠" label={t('home', uiLanguage)} />
                     <MobileNavButton onClick={() => { onToggleLibrary(); setIsMobileMenuOpen(false); }} icon="📚" label={t('library', uiLanguage)} active={isLibraryOpen} />
                     <MobileNavButton onClick={() => { setShowSettings(true); setIsMobileMenuOpen(false); }} icon="⚙️" label={t('settings', uiLanguage)} />
                 </div>
                 {mobileActions && mobileActions.length > 0 && (
                     <div className="pt-2 border-t border-terminal-gray/20 space-y-2">
                        {mobileActions.map((action, i) => (
                             <button
                                key={i}
                                onClick={() => { if(!action.disabled) { action.onClick(); setIsMobileMenuOpen(false); } }}
                                disabled={action.disabled}
                                className={`w-full p-3 rounded-lg text-sm font-bold text-left transition-colors ${action.variant === 'primary' ? 'bg-terminal-green text-black shadow-lg shadow-terminal-green/20' : 'bg-terminal-surface text-terminal-light border border-terminal-gray/20'}`}
                             >
                                {action.label}
                             </button>
                        ))}
                     </div>
                 )}
            </div>
        </div>
      </header>

      <main className={`flex-grow p-4 md:p-8 w-full transition-all duration-300 pt-20 md:pt-28 z-10 ${isFullWidth ? 'px-4' : 'max-w-5xl mx-auto'}`}>
         {children}
      </main>

      <footer className={`p-4 text-center text-[10px] text-gray-500 z-10 border-t border-terminal-gray/10 bg-terminal-black/50 backdrop-blur-sm transition-transform duration-300 ${autoHideFooter && !isMobileMenuOpen ? 'translate-y-full hover:translate-y-0 opacity-0 hover:opacity-100' : ''}`}>
        Z+ SYSTEM V1.6 | {t('status_online', uiLanguage)}
      </footer>

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-terminal-surface border border-terminal-gray/20 w-full max-w-xl shadow-2xl rounded-2xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-terminal-gray/20 flex justify-between items-center bg-terminal-black/20">
                    <h2 className="font-bold text-terminal-light flex items-center gap-2">⚙️ {t('system_preferences', uiLanguage)}</h2>
                    <button onClick={() => setShowSettings(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-terminal-gray/20 text-terminal-light transition-colors">✕</button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-grow space-y-6">
                    {/* Theme Section */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('ui_theme', uiLanguage)}</label>
                        <div className="grid grid-cols-3 gap-2">
                            <ThemeButton active={theme === 'light'} onClick={() => setTheme('light')} label="LIGHT" color="bg-gray-100 text-gray-800" />
                            <ThemeButton active={theme === 'dark'} onClick={() => setTheme('dark')} label="TERMINAL" color="bg-zinc-800 text-green-400 border border-green-500/30" />
                            <ThemeButton active={theme === 'palestine'} onClick={() => setTheme('palestine')} label="PALESTINE" color="bg-neutral-800 text-white border-l-4 border-red-600" />
                        </div>
                    </div>

                    {/* Lang Section */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('system_language', uiLanguage)}</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => onSetUiLanguage('en')} className={`p-2 text-xs font-bold rounded-lg border transition-all ${uiLanguage === 'en' ? 'border-terminal-green bg-terminal-green/10 text-terminal-green' : 'border-terminal-gray/20 text-gray-500'}`}>ENGLISH</button>
                            <button onClick={() => onSetUiLanguage('ar')} className={`p-2 text-xs font-bold rounded-lg border transition-all ${uiLanguage === 'ar' ? 'border-terminal-green bg-terminal-green/10 text-terminal-green' : 'border-terminal-gray/20 text-gray-500'}`}>العربية</button>
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-2">
                        <ToggleRow label={t('full_width', uiLanguage)} checked={isFullWidth} onChange={onToggleFullWidth} />
                        <ToggleRow label={t('auto_hide_menu', uiLanguage)} checked={autoHideHeader} onChange={() => setAutoHideHeader(!autoHideHeader)} />
                        <ToggleRow label={t('digital_background', uiLanguage)} checked={enableBackgroundAnim} onChange={() => setEnableBackgroundAnim(!enableBackgroundAnim)} />
                        <ToggleRow label={t('terminal_cursor', uiLanguage)} checked={useCustomCursor} onChange={() => setUseCustomCursor(!useCustomCursor)} />
                    </div>
                </div>

                <div className="p-4 border-t border-terminal-gray/20 bg-terminal-black/20">
                    <button onClick={() => setShowSettings(false)} className="w-full py-3 bg-terminal-green hover:bg-terminal-green/90 text-black font-bold rounded-xl shadow-lg shadow-terminal-green/20 transition-all text-sm">
                        {t('save_close', uiLanguage)}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const NavButton = ({ onClick, active, icon, label }: any) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${active ? 'bg-terminal-green text-black shadow-lg shadow-terminal-green/30' : 'text-gray-500 dark:text-gray-400 hover:bg-terminal-gray/10 hover:text-terminal-light'}`}>
        <span>{icon}</span>
        <span>{label}</span>
    </button>
);

const MobileNavButton = ({ onClick, active, icon, label }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${active ? 'border-terminal-green bg-terminal-green/10 text-terminal-green' : 'border-terminal-gray/20 bg-terminal-surface text-gray-500'}`}>
        <span className="text-xl mb-1">{icon}</span>
        <span className="text-[10px] font-bold">{label}</span>
    </button>
);

const ThemeButton = ({ active, onClick, label, color }: any) => (
    <button onClick={onClick} className={`p-3 rounded-xl text-xs font-bold transition-all border-2 ${active ? 'border-terminal-green scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'} ${color}`}>
        {label}
    </button>
);

const ToggleRow = ({ label, checked, onChange }: any) => (
    <div className="flex items-center justify-between p-3 bg-terminal-black/20 rounded-lg border border-terminal-gray/10">
        <span className="text-sm font-medium text-terminal-light">{label}</span>
        <button onClick={onChange} className={`w-10 h-5 rounded-full p-1 transition-colors ${checked ? 'bg-terminal-green' : 'bg-gray-400/30'}`}>
            <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    </div>
);
