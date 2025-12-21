
import React, { useState, useEffect } from 'react';
import { BackgroundEffect } from './BackgroundEffect';
import { UILanguage, ThemeOption } from '../types';
import { t } from '../utils/translations';
import { AiHelper } from './AiHelper';

export interface MobileAction {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'purple';
    disabled?: boolean;
}

export type SystemStatus = 'ONLINE' | 'QUOTA_LIMIT' | 'OFFLINE';

interface LayoutProps {
  children: React.ReactNode;
  onHome: () => void;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
  onToggleSettings: () => void;
  isSettingsOpen: boolean;
  isFullWidth: boolean;
  onToggleFullWidth: () => void;
  autoHideFooter?: boolean;
  onToggleAutoHideFooter?: () => void;
  mobileActions?: MobileAction[];
  uiLanguage: UILanguage;
  onSetUiLanguage: (lang: UILanguage) => void;
  forceStaticHeader?: boolean;
  systemStatus?: SystemStatus;
  
  // Visual Props
  theme: ThemeOption;
  autoHideHeader: boolean;
  enableBackgroundAnim: boolean;
  useCustomCursor: boolean;
}

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

const ZPlusLogo: React.FC<{ theme: ThemeOption }> = ({ theme }) => {
    const isPalestine = theme === 'palestine';
    const isLight = theme === 'light';

    return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible" role="img" aria-label="Z+ Logo">
            <defs>
                <linearGradient id="termMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isLight ? "#1e3a8a" : "#0f3923"} />
                    <stop offset="50%" stopColor={isLight ? "#3b82f6" : "#00ff41"} />
                    <stop offset="100%" stopColor={isLight ? "#172554" : "#002200"} />
                </linearGradient>
                <linearGradient id="palMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0b0f0c" />
                    <stop offset="50%" stopColor="#14532d" />
                    <stop offset="100%" stopColor="#e5e7eb" />
                </linearGradient>
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
                <path d="M15 25 H65 L25 75 H75" fill="none" stroke={isPalestine ? "url(#palMetal)" : "url(#termMetal)"} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M85 35 V65 M70 50 H100" fill="none" stroke={isPalestine ? "url(#palMetal)" : "url(#termMetal)"} strokeWidth="12" strokeLinecap="round"/>
            </g>
        </svg>
    );
};

export const Layout: React.FC<LayoutProps> = ({ 
    children, onHome, onToggleLibrary, isLibraryOpen, onToggleSettings, isSettingsOpen, isFullWidth, onToggleFullWidth,
    autoHideFooter = true, onToggleAutoHideFooter, mobileActions,
    uiLanguage, onSetUiLanguage,
    forceStaticHeader = false,
    systemStatus = 'ONLINE',
    theme, autoHideHeader, enableBackgroundAnim, useCustomCursor
}) => {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const shouldAutoHideHeader = autoHideHeader && !forceStaticHeader;

  useEffect(() => {
      if (!shouldAutoHideHeader) { setIsHeaderVisible(true); return; }
      const timer = setTimeout(() => { if (!isMobileMenuOpen) setIsHeaderVisible(false); }, 1500);
      return () => clearTimeout(timer);
  }, [shouldAutoHideHeader, isMobileMenuOpen]);

  const handleMouseEnterHeader = () => { if (shouldAutoHideHeader) setIsHeaderVisible(true); };
  const handleMouseLeaveHeader = () => { if (shouldAutoHideHeader && !isMobileMenuOpen && !isSettingsOpen) setIsHeaderVisible(false); };

  const getActionColor = (variant?: string) => {
      switch(variant) {
          case 'primary': return 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700';
          case 'success': return 'bg-green-600 text-white border-green-600 hover:bg-green-700';
          case 'warning': return 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600';
          case 'purple': return 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700';
          default: return 'border-gray-300 dark:border-terminal-border hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-terminal-btn-text text-gray-700 dark:text-terminal-green';
      }
  };

  const isPalestine = theme === 'palestine';
  
  const palestineBgStyle = isPalestine ? {
      backgroundColor: '#0b0f0c',
      backgroundImage: 'radial-gradient(circle at 50% 0%, #1b231d 0%, #0b0f0c 70%)'
  } : {};

  // Status Styling Logic
  const getStatusColor = () => {
      switch(systemStatus) {
          case 'QUOTA_LIMIT': return 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]';
          case 'OFFLINE': return 'bg-gray-500 shadow-none';
          case 'ONLINE': default: return 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]';
      }
  };

  const getStatusTextColor = () => {
      switch(systemStatus) {
          case 'QUOTA_LIMIT': return 'text-red-600 dark:text-red-500';
          case 'OFFLINE': return 'text-gray-500 dark:text-gray-500';
          case 'ONLINE': default: return 'text-gray-600 dark:text-terminal-green';
      }
  };

  const getStatusBorderColor = () => {
      if (systemStatus === 'QUOTA_LIMIT') return 'border-red-500 dark:border-red-500/50';
      return 'border-gray-300 dark:border-terminal-green/30';
  };

  return (
    <div 
        className={`min-h-screen flex flex-col font-mono selection:bg-terminal-green selection:text-terminal-btn-text ${useCustomCursor ? 'custom-cursor' : ''} relative overflow-x-hidden transition-colors duration-500`} 
        dir={uiLanguage === 'ar' ? 'rtl' : 'ltr'}
        style={palestineBgStyle}
    >
      {/* SKIP LINK FOR ACCESSIBILITY */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-4 focus:left-4 focus:bg-terminal-green focus:text-black focus:p-4 focus:font-bold focus:shadow-xl focus:border-2 focus:border-white focus:outline-none"
      >
        {t('home', uiLanguage)}: Skip to Content
      </a>

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
          <div className="hidden md:block fixed top-0 left-0 w-full h-6 z-50 bg-transparent cursor-crosshair" onMouseEnter={handleMouseEnterHeader} />
      )}

      {shouldAutoHideHeader && (
        <div className={`hidden md:flex fixed top-0 left-1/2 -translate-x-1/2 z-40 transition-all duration-700 ease-in-out pointer-events-none flex-col items-center ${isHeaderVisible ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
            <div className="w-32 h-1.5 bg-gray-400/50 dark:bg-terminal-green/30 rounded-b-full shadow-[0_0_10px_rgba(0,255,65,0.2)] backdrop-blur-sm animate-pulse"></div>
        </div>
      )}

      <header 
        className={`
            fixed top-0 left-0 right-0 z-40 
            bg-white/95 dark:bg-[#050505]/95 backdrop-blur-md 
            border-b-2 ${systemStatus === 'QUOTA_LIMIT' ? 'border-red-500' : 'border-gray-300 dark:border-terminal-green/50'}
            shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(0,255,65,0.1)]
            transition-all duration-700 ease-in-out
            h-16 md:h-20 translate-y-0
            ${isMobileMenuOpen ? '' : (isHeaderVisible ? 'md:translate-y-0' : 'md:-translate-y-full')}
        `}
        style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: 'center',
        }}
        onMouseLeave={handleMouseLeaveHeader}
        onMouseEnter={handleMouseEnterHeader}
        role="banner"
      >
        {/* Subtle Overlay to dampen pattern opacity */}
        <div className="absolute inset-0 bg-white/90 dark:bg-[#050505]/90 pointer-events-none"></div>

        <div className="relative p-4 flex justify-between items-center h-full max-w-7xl mx-auto z-10">
            {/* LEFT: LOGO */}
            <div className="flex items-center gap-4">
                <button 
                    onClick={onHome}
                    className="relative group outline-none focus:outline-none flex items-center gap-3"
                    title={t('home', uiLanguage)}
                    aria-label={t('home', uiLanguage)}
                >
                    <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border border-transparent dark:border-terminal-green/20 rounded bg-gray-100 dark:bg-black group-hover:border-terminal-green transition-colors overflow-hidden">
                        <ZPlusLogo theme={theme} />
                    </div>
                    <div className="hidden sm:flex flex-col items-start leading-none">
                        <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tighter">Q&A AI GEN</span>
                        <span className="text-[9px] text-gray-500 dark:text-terminal-green font-mono tracking-widest">FILE EXTRACTOR</span>
                    </div>
                </button>
            </div>
            
            {/* CENTER: Status Indicator (Desktop) */}
            <div className={`hidden md:flex items-center gap-2 border ${getStatusBorderColor()} px-3 py-1 rounded-sm bg-gray-50 dark:bg-[#0a0a0a]`} role="status" aria-live="polite">
                <div className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`}></div>
                <span className={`text-[10px] font-bold ${getStatusTextColor()} tracking-widest uppercase`}>
                    SYSTEM: {systemStatus.replace('_', ' ')}
                </span>
            </div>

            {/* RIGHT: DESKTOP TOOLS */}
            <div className="hidden md:flex gap-0 items-center border border-gray-300 dark:border-terminal-green/30 rounded-sm overflow-hidden bg-white dark:bg-[#0a0a0a]">
                <button
                    onClick={onToggleLibrary}
                    className={`
                        h-10 w-12 flex items-center justify-center transition-all border-r border-gray-300 dark:border-terminal-green/30
                        ${isLibraryOpen 
                            ? 'bg-blue-600 text-white' 
                            : 'text-gray-600 dark:text-terminal-green hover:bg-blue-600 dark:hover:bg-terminal-green hover:text-white dark:hover:text-black'
                        }
                    `}
                    title={t('library', uiLanguage)}
                    aria-label={t('library', uiLanguage)}
                    aria-expanded={isLibraryOpen}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                </button>

                <button
                    onClick={onToggleSettings}
                    className={`
                        h-10 w-12 flex items-center justify-center transition-all
                        ${isSettingsOpen 
                            ? 'bg-gray-300 dark:bg-terminal-green text-black' 
                            : 'text-gray-600 dark:text-terminal-green hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-black'
                        }
                    `}
                    title={t('settings', uiLanguage)}
                    aria-label={t('settings', uiLanguage)}
                    aria-expanded={isSettingsOpen}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>

            {/* RIGHT: MOBILE MENU TOGGLE */}
            <div className="md:hidden">
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-gray-800 dark:text-terminal-green hover:bg-gray-200 dark:hover:bg-terminal-green dark:hover:text-black rounded border border-gray-400 dark:border-terminal-green/50 transition-all"
                    aria-label="Toggle Menu"
                    aria-expanded={isMobileMenuOpen}
                >
                    <div className="space-y-1.5">
                        <div className={`w-5 h-0.5 bg-current transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
                        <div className={`w-5 h-0.5 bg-current transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></div>
                        <div className={`w-5 h-0.5 bg-current transition-transform duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
                    </div>
                </button>
            </div>
        </div>

        {/* MOBILE MENU PANEL */}
        <div className={`
            md:hidden fixed top-16 left-0 right-0 z-0 bg-gray-100 dark:bg-[#0c0c0c] border-b-2 border-gray-300 dark:border-terminal-green 
            transition-all duration-300 ease-in-out origin-top shadow-2xl
            ${isMobileMenuOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}
        `}>
            <div className="p-4 space-y-4">
                 <div className="flex items-center gap-2 border border-gray-300 dark:border-terminal-green/30 px-3 py-2 rounded-sm bg-gray-200 dark:bg-[#151515] mb-4 justify-center">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`}></div>
                    <span className={`text-[10px] font-bold ${getStatusTextColor()} tracking-widest uppercase`}>
                        SYSTEM: {systemStatus.replace('_', ' ')}
                    </span>
                 </div>

                 <div className="grid grid-cols-3 gap-3">
                     <button 
                        onClick={() => { onHome(); setIsMobileMenuOpen(false); }}
                        className="flex flex-col items-center justify-center p-3 rounded bg-white dark:bg-[#151515] border border-gray-300 dark:border-terminal-gray text-gray-700 dark:text-terminal-green hover:border-blue-500 dark:hover:border-terminal-green transition-colors"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span className="text-[10px] font-bold">HOME</span>
                     </button>

                     <button 
                        onClick={() => { onToggleLibrary(); setIsMobileMenuOpen(false); }}
                        className={`flex flex-col items-center justify-center p-3 rounded border transition-colors ${isLibraryOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#151515] border-gray-300 dark:border-terminal-gray text-gray-700 dark:text-terminal-green hover:border-blue-500 dark:hover:border-terminal-green'}`}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                         </svg>
                         <span className="text-[10px] font-bold">LIBRARY</span>
                     </button>

                     <button 
                        onClick={() => { onToggleSettings(); setIsMobileMenuOpen(false); }}
                        className={`flex flex-col items-center justify-center p-3 rounded border transition-colors ${isSettingsOpen ? 'bg-gray-800 text-white dark:bg-terminal-green dark:text-black border-gray-800 dark:border-terminal-green' : 'bg-white dark:bg-[#151515] border-gray-300 dark:border-terminal-gray text-gray-700 dark:text-terminal-green hover:border-blue-500 dark:hover:border-terminal-green'}`}
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[10px] font-bold">CONFIG</span>
                     </button>
                 </div>

                 {mobileActions && mobileActions.length > 0 && (
                     <div className="border-t border-gray-300 dark:border-terminal-green/30 pt-3 mt-3">
                        <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 px-1 uppercase tracking-wider mb-2">Actions</div>
                        <div className="flex flex-col gap-2">
                            {mobileActions.map((action, i) => (
                                <button
                                    key={i}
                                    onClick={() => { if(!action.disabled) { action.onClick(); setIsMobileMenuOpen(false); } }}
                                    disabled={action.disabled}
                                    className={`p-3 text-left font-bold text-sm border rounded transition-colors ${getActionColor(action.variant)} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                     </div>
                 )}
            </div>
        </div>
      </header>

      <main 
        id="main-content" 
        className={`flex-grow p-4 md:p-8 w-full transition-all duration-300 pt-20 md:pt-28 z-10 ${isFullWidth ? 'px-4' : 'max-w-5xl mx-auto'}`}
        tabIndex={-1}
      >
        <div className="relative">
          <div className="relative z-10">{children}</div>
        </div>
      </main>
    </div>
  );
};
