
import React, { useState, useRef, useEffect } from 'react';
import { getAiHelperResponse } from '../services/gemini';
import { UILanguage } from '../types';
import { t } from '../utils/translations';
import { MarkdownRenderer } from './MarkdownRenderer';
import { sanitizeInput } from '../utils/security';

interface AiHelperProps {
    lang: UILanguage;
    onSetUiLanguage: (lang: UILanguage) => void;
}

interface Message {
    role: 'user' | 'ai';
    text: string;
}

export const AiHelper: React.FC<AiHelperProps> = ({ lang, onSetUiLanguage }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', text: t('ai_helper_welcome', lang) }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const MAX_CHARS = 300;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        // 1. Sanitization & Length Check
        const validation = sanitizeInput(input, MAX_CHARS); 
        
        if (!validation.isValid) {
            setMessages(prev => [...prev, { role: 'ai', text: `⚠️ SYSTEM ALERT: ${validation.error}` }]);
            setInput('');
            return;
        }

        const userMsg = validation.sanitizedValue;

        // 2. Prompt Injection Heuristic
        const injectionPatterns = [/ignore previous/i, /system prompt/i, /you are now/i, /act as/i];
        if (injectionPatterns.some(p => p.test(userMsg))) {
             setMessages(prev => [...prev, { role: 'user', text: userMsg }]); 
             setIsLoading(true);
             setTimeout(() => {
                 setMessages(prev => [...prev, { role: 'ai', text: "🛡️ SECURITY PROTOCOL: Prompt injection attempt detected. Request denied." }]);
                 setIsLoading(false);
             }, 800);
             setInput('');
             return;
        }

        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsLoading(true);

        const response = await getAiHelperResponse(userMsg, lang);
        
        setMessages(prev => [...prev, { role: 'ai', text: response }]);
        setIsLoading(false);
    };

    const handleClear = () => {
        setMessages([{ role: 'ai', text: t('ai_helper_welcome', lang) }]);
    };

    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end font-sans">
            
            {/* CHAT WINDOW */}
            {isOpen && (
                <div className="mb-4 w-80 md:w-96 h-[500px] bg-white dark:bg-terminal-gray border border-gray-300 dark:border-terminal-border shadow-2xl flex flex-col animate-fade-in rounded-lg overflow-hidden relative backdrop-blur-sm">
                    
                    {/* Header */}
                    <div className="bg-gray-100 dark:bg-terminal-gray border-b border-gray-300 dark:border-terminal-border p-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                             <div className="relative">
                                <div className="w-2.5 h-2.5 bg-terminal-green rounded-full animate-pulse shadow-[0_0_8px_var(--color-term-green)]"></div>
                             </div>
                             <span className="font-mono font-bold text-xs text-gray-700 dark:text-terminal-green tracking-widest">
                                 {t('ai_helper_title', lang)}
                             </span>
                        </div>
                        <div className="flex items-center gap-2">
                             <button
                                onClick={handleClear}
                                title="Clear Chat"
                                className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-red-500 px-2"
                             >
                                🗑️
                             </button>
                             <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-red-500 dark:text-terminal-green dark:hover:text-white transition-colors px-1">
                                ✕
                             </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-terminal-black/80">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    max-w-[85%] p-3 text-xs md:text-sm leading-relaxed shadow-sm break-words
                                    ${m.role === 'user' 
                                        ? 'bg-terminal-green text-terminal-btn-text rounded-2xl rounded-br-none' 
                                        : 'bg-white dark:bg-terminal-gray border border-gray-200 dark:border-terminal-border text-gray-800 dark:text-terminal-light rounded-2xl rounded-bl-none'
                                    }
                                `}>
                                    {m.role === 'ai' ? (
                                        <MarkdownRenderer content={m.text} className="!text-xs md:!text-sm" />
                                    ) : (
                                        m.text
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-terminal-gray border border-gray-200 dark:border-terminal-border p-3 rounded-2xl rounded-bl-none flex gap-1 items-center h-10">
                                    <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-terminal-green rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-terminal-green rounded-full animate-bounce delay-100"></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-terminal-green rounded-full animate-bounce delay-200"></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSubmit} className="p-3 border-t border-gray-300 dark:border-terminal-border bg-white dark:bg-terminal-gray">
                        <div className="relative flex gap-2 items-center">
                            <div className="flex-grow relative group">
                                <input 
                                    type="text" 
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    maxLength={MAX_CHARS}
                                    placeholder={t('ai_helper_placeholder', lang)}
                                    className="w-full bg-gray-100 dark:bg-terminal-black border border-gray-300 dark:border-gray-700 rounded p-2.5 pr-12 text-sm outline-none focus:border-terminal-green dark:text-terminal-light transition-colors"
                                />
                                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono pointer-events-none ${input.length >= MAX_CHARS ? 'text-red-500' : 'text-gray-400'}`}>
                                    {input.length}/{MAX_CHARS}
                                </span>
                            </div>
                            <button 
                                type="submit" 
                                disabled={isLoading || !input.trim()}
                                className="p-2.5 bg-terminal-green text-terminal-btn-text rounded hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 rtl:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* FAB TOGGLE */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-transparent
                    ${isOpen 
                        ? 'bg-gray-700 text-white' 
                        : 'bg-terminal-green text-terminal-btn-text animate-pulse shadow-[0_0_15px_var(--color-term-green)] border-terminal-green'
                    }
                `}
                title="System Support"
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                ) : (
                    // Custom Bot Face Icon
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4V4a2 2 0 0 1 2-2z" />
                        <path d="M9 15h6" />
                        <path d="M9 11v.01" />
                        <path d="M15 11v.01" />
                        <line x1="12" y1="2" x2="12" y2="4" />
                    </svg>
                )}
            </button>
        </div>
    );
};
