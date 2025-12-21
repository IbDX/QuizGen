
import React, { useState } from 'react';
import { ThemeOption, UILanguage, UserProfile } from '../types';
import { t } from '../utils/translations';
import { PerformanceDashboard } from './PerformanceDashboard';
import { calculateSHA512 } from '../utils/crypto';
import { gamification } from '../services/gamification';

interface SettingsViewProps {
    isFullWidth: boolean;
    onToggleFullWidth: () => void;
    theme: ThemeOption;
    setTheme: (t: ThemeOption) => void;
    uiLanguage: UILanguage;
    setUiLanguage: (l: UILanguage) => void;
    fontFamily: string;
    setFontFamily: (f: string) => void;
    fontSize: number;
    setFontSize: (s: number) => void;
    autoHideHeader: boolean;
    setAutoHideHeader: (b: boolean) => void;
    enableBackgroundAnim: boolean;
    setEnableBackgroundAnim: (b: boolean) => void;
    useCustomCursor: boolean;
    setUseCustomCursor: (b: boolean) => void;
    onClose: () => void;
    userProfile?: UserProfile; 
    onUpdateProfile?: (profile: UserProfile) => void;
}

const FONT_OPTIONS = [
    { name: 'Fira Code', value: "'Fira Code', monospace" },
    { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
    { name: 'Roboto Mono', value: "'Roboto Mono', monospace" },
    { name: 'Cairo (Arabic)', value: "'Cairo', sans-serif" },
    { name: 'Courier New', value: "'Courier New', Courier, monospace" },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
    isFullWidth, onToggleFullWidth,
    theme, setTheme,
    uiLanguage, setUiLanguage,
    fontFamily, setFontFamily,
    fontSize, setFontSize,
    autoHideHeader, setAutoHideHeader,
    enableBackgroundAnim, setEnableBackgroundAnim,
    useCustomCursor, setUseCustomCursor,
    onClose,
    userProfile,
    onUpdateProfile
}) => {
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [showHackerInput, setShowHackerInput] = useState(false);
    const [hackerPwd, setHackerPwd] = useState('');

    const handleHackerAttempt = async (e: React.FormEvent) => {
        e.preventDefault();
        const hash = await calculateSHA512(hackerPwd);
        // SHA-512 for target password
        if (hash === "279eb4d9c63c178468b783a62a56080cbf1c6cfb6ae3cbf21ae596bea2790857fed3fc6ab503e70baf51f0f384ae3e93b024aa4363067f86418e40edf51fad88") {
            const newProfile = gamification.unlockEverything();
            if (onUpdateProfile) onUpdateProfile(newProfile);
            alert("ACCESS GRANTED. SYSTEM LEVEL: MAX. ALL BADGES UNLOCKED.");
            setShowHackerInput(false);
            setHackerPwd('');
        } else {
            alert("ACCESS DENIED.");
            setHackerPwd('');
        }
    };

    const ThemeButton = ({ id, label, locked, lvl }: { id: ThemeOption, label: string, locked: boolean, lvl: number }) => (
        <button 
            onClick={() => !locked && setTheme(id)} 
            disabled={locked}
            className={`p-3 border rounded text-[10px] font-bold transition-all shadow-sm relative overflow-hidden group
                ${locked ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-black border-gray-300 dark:border-gray-800' : ''}
                ${theme === id 
                    ? 'border-terminal-green bg-terminal-gray text-terminal-green ring-1 ring-terminal-green' 
                    : !locked ? 'border-gray-300 dark:border-gray-700 bg-white dark:bg-terminal-black text-gray-500 hover:border-gray-400' : ''}
            `}
        >
            {label}
            {locked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-[9px] backdrop-blur-[1px]">
                    🔒 LVL {lvl}
                </div>
            )}
        </button>
    );

    return (
        <div className={`mx-auto transition-all duration-300 animate-fade-in ${isFullWidth ? 'max-w-none w-full' : 'max-w-4xl'}`}>
            {showDiagnostics && <PerformanceDashboard onClose={() => setShowDiagnostics(false)} />}
            
            {showHackerInput && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <form onSubmit={handleHackerAttempt} className="bg-black border-2 border-red-500 w-full max-w-sm p-6 shadow-[0_0_50px_rgba(255,0,0,0.5)] rounded">
                        <h3 className="text-red-500 font-bold font-mono text-xl mb-4 tracking-widest text-center animate-pulse">ROOT ACCESS REQUIRED</h3>
                        <input 
                            type="password" 
                            value={hackerPwd}
                            onChange={(e) => setHackerPwd(e.target.value)}
                            placeholder="ENTER PASSPHRASE"
                            className="w-full bg-[#111] border border-red-800 text-red-500 p-3 mb-4 font-mono text-center outline-none focus:border-red-500"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowHackerInput(false)} className="flex-1 py-2 bg-gray-800 text-gray-400 hover:bg-gray-700 font-mono text-xs">CANCEL</button>
                            <button type="submit" className="flex-1 py-2 bg-red-900 text-red-200 hover:bg-red-800 font-mono text-xs font-bold">AUTHENTICATE</button>
                        </div>
                    </form>
                </div>
            )}
            
            <div className="bg-white dark:bg-terminal-black border-2 border-gray-300 dark:border-terminal-green shadow-xl p-0 relative overflow-hidden flex flex-col rounded-lg">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-300 dark:border-terminal-green/30 bg-gray-50 dark:bg-[#111] flex justify-between items-center">
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-terminal-green">
                        <span className="text-3xl">⚙️</span> {t('system_preferences', uiLanguage)}
                    </h2>
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-terminal-gray hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-600 dark:text-terminal-light hover:text-red-600 dark:hover:text-red-400 rounded transition-colors font-bold text-sm uppercase"
                    >
                        ✕ {t('save_close', uiLanguage)}
                    </button>
                </div>
                
                <div className="p-6 md:p-8 space-y-10">
                    
                    {/* 1. INTERFACE SECTION */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <h3 className="text-sm font-bold text-blue-600 dark:text-terminal-green uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span>🎨</span> {t('settings_interface', uiLanguage)}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                Customize the visual appearance and language of the Z+ System.
                            </p>
                        </div>
                        
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Theme */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold mb-3 text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t('ui_theme', uiLanguage)}</label>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                    <ThemeButton id="light" label="LIGHT" locked={false} lvl={0} />
                                    <ThemeButton id="dark" label="TERMINAL" locked={false} lvl={0} />
                                    <ThemeButton id="palestine" label="PALESTINE" locked={false} lvl={0} />
                                    <ThemeButton 
                                        id="cyberpunk" 
                                        label="CYBERPUNK" 
                                        locked={!userProfile?.unlockedThemes.includes('cyberpunk')} 
                                        lvl={3} 
                                    />
                                    <ThemeButton 
                                        id="synthwave" 
                                        label="SYNTHWAVE" 
                                        locked={!userProfile?.unlockedThemes.includes('synthwave')} 
                                        lvl={5} 
                                    />
                                </div>
                            </div>

                            {/* Language */}
                            <div>
                                <label className="block text-xs font-bold mb-3 text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t('system_language', uiLanguage)}</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setUiLanguage('en')} className={`flex-1 p-3 border rounded text-xs font-bold transition-all shadow-sm ${uiLanguage === 'en' ? 'bg-gray-800 text-white dark:bg-terminal-green dark:text-black border-gray-800 dark:border-terminal-green' : 'bg-white dark:bg-terminal-black text-gray-500 border-gray-300 dark:border-gray-700'}`}>ENGLISH</button>
                                    <button onClick={() => setUiLanguage('ar')} className={`flex-1 p-3 border rounded text-xs font-bold transition-all shadow-sm ${uiLanguage === 'ar' ? 'bg-gray-800 text-white dark:bg-terminal-green dark:text-black border-gray-800 dark:border-terminal-green' : 'bg-white dark:bg-terminal-black text-gray-500 border-gray-300 dark:border-gray-700'}`}>العربية</button>
                                </div>
                            </div>

                            {/* Font Family */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold mb-3 text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t('font_family', uiLanguage)}</label>
                                <select 
                                    value={fontFamily} 
                                    onChange={(e) => setFontFamily(e.target.value)}
                                    className="w-full p-3 bg-gray-50 dark:bg-[#151515] border border-gray-300 dark:border-gray-700 rounded text-sm outline-none focus:border-blue-500 dark:focus:border-terminal-green dark:text-terminal-light transition-colors cursor-pointer"
                                >
                                    {FONT_OPTIONS.map((font) => (
                                        <option key={font.name} value={font.value}>{font.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Font Scale */}
                            <div className="md:col-span-2">
                                <div className="flex justify-between mb-3">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t('global_font_scale', uiLanguage)}</label>
                                    <span className="text-xs font-mono bg-gray-200 dark:bg-terminal-gray px-2 py-0.5 rounded text-gray-700 dark:text-terminal-green">{fontSize}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="12" 
                                    max="20" 
                                    step="1" 
                                    value={fontSize}
                                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600 dark:accent-terminal-green"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-200 dark:bg-terminal-green/20"></div>

                    {/* 2. DISPLAY & VISUALS */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <h3 className="text-sm font-bold text-purple-600 dark:text-terminal-green uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span>🖥️</span> {t('settings_display', uiLanguage)} & {t('settings_visuals', uiLanguage)}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                Control layout behavior and graphical effects.
                            </p>
                        </div>

                        <div className="lg:col-span-2 space-y-4">
                            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#151515] rounded border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-blue-400 dark:hover:border-terminal-green transition-all group">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-terminal-green transition-colors">{t('full_width', uiLanguage)}</span>
                                <div className={`w-12 h-6 rounded-full relative transition-colors ${isFullWidth ? 'bg-blue-600 dark:bg-terminal-green' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                    <input type="checkbox" checked={isFullWidth} onChange={onToggleFullWidth} className="hidden" />
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${isFullWidth ? 'left-7 rtl:right-7 rtl:left-auto' : 'left-1 rtl:right-1 rtl:left-auto'}`}></div>
                                </div>
                            </label>

                            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#151515] rounded border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-blue-400 dark:hover:border-terminal-green transition-all group">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-terminal-green transition-colors">{t('auto_hide_menu', uiLanguage)}</span>
                                <div className={`w-12 h-6 rounded-full relative transition-colors ${autoHideHeader ? 'bg-blue-600 dark:bg-terminal-green' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                    <input type="checkbox" checked={autoHideHeader} onChange={() => setAutoHideHeader(!autoHideHeader)} className="hidden" />
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${autoHideHeader ? 'left-7 rtl:right-7 rtl:left-auto' : 'left-1 rtl:right-1 rtl:left-auto'}`}></div>
                                </div>
                            </label>

                            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#151515] rounded border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-blue-400 dark:hover:border-terminal-green transition-all group">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-terminal-green transition-colors">{t('matrix_rain', uiLanguage)}</span>
                                <div className={`w-12 h-6 rounded-full relative transition-colors ${enableBackgroundAnim ? 'bg-blue-600 dark:bg-terminal-green' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                    <input type="checkbox" checked={enableBackgroundAnim} onChange={() => setEnableBackgroundAnim(!enableBackgroundAnim)} className="hidden" />
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${enableBackgroundAnim ? 'left-7 rtl:right-7 rtl:left-auto' : 'left-1 rtl:right-1 rtl:left-auto'}`}></div>
                                </div>
                            </label>

                            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#151515] rounded border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-blue-400 dark:hover:border-terminal-green transition-all group">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-terminal-green transition-colors">{t('terminal_cursor', uiLanguage)}</span>
                                <div className={`w-12 h-6 rounded-full relative transition-colors ${useCustomCursor ? 'bg-blue-600 dark:bg-terminal-green' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                    <input type="checkbox" checked={useCustomCursor} onChange={() => setUseCustomCursor(!useCustomCursor)} className="hidden" />
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${useCustomCursor ? 'left-7 rtl:right-7 rtl:left-auto' : 'left-1 rtl:right-1 rtl:left-auto'}`}></div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-gray-200 dark:bg-terminal-green/20"></div>

                    {/* 3. SYSTEM INFO */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <h3 className="text-sm font-bold text-red-600 dark:text-terminal-alert uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span>🛠️</span> {t('settings_system', uiLanguage)}
                            </h3>
                        </div>
                        <div className="lg:col-span-2 space-y-3">
                            <button
                                onClick={() => setShowDiagnostics(true)}
                                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-[#150505] rounded border border-gray-300 dark:border-terminal-green/30 hover:bg-gray-100 dark:hover:bg-terminal-green/10 hover:border-terminal-green transition-all group text-left"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-800 dark:text-terminal-green">PERFORMANCE MONITOR</span>
                                    <span className="text-[10px] text-gray-500">View API latency, storage quota, and interactions</span>
                                </div>
                                <span className="text-gray-400 dark:text-terminal-green">📊</span>
                            </button>

                            <button
                                onClick={() => setShowHackerInput(true)}
                                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-[#150505] rounded border border-gray-300 dark:border-terminal-green/30 hover:bg-gray-100 dark:hover:bg-terminal-green/10 hover:border-terminal-green transition-all group text-left"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-800 dark:text-terminal-green">HACKER</span>
                                    <span className="text-[10px] text-gray-500">Access advanced developer override tools</span>
                                </div>
                                <span className="text-gray-400 dark:text-terminal-green">👾</span>
                            </button>

                            <a 
                                href="https://github.com/your-repo/terminal-exam-gen/issues" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 bg-red-50 dark:bg-[#150505] rounded border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/30 hover:border-red-400 dark:hover:border-terminal-alert transition-all group"
                            >
                                <span className="text-sm font-bold text-red-700 dark:text-terminal-alert group-hover:translate-x-1 transition-transform">
                                    {t('report_issue', uiLanguage)}
                                </span>
                                <span className="text-red-400 dark:text-red-700 group-hover:text-red-600 dark:group-hover:text-terminal-alert">↗</span>
                            </a>
                        </div>
                    </div>

                </div>
                
                <div className="p-6 border-t border-gray-300 dark:border-terminal-green/30 bg-gray-50 dark:bg-[#111]">
                    <button onClick={onClose} className="w-full py-4 bg-gray-800 hover:bg-gray-700 dark:bg-terminal-green dark:hover:bg-terminal-dimGreen text-white dark:text-terminal-btn-text font-bold uppercase transition-all rounded shadow-lg tracking-widest text-sm hover:scale-[1.01] active:scale-[0.99]">
                        {t('save_close', uiLanguage)}
                    </button>
                </div>
            </div>
        </div>
    );
};
