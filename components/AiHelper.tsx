
import React, { useState, useRef, useEffect } from 'react';
import { getAiHelperResponse } from '../services/gemini';
import { UILanguage } from '../types';
import { t } from '../utils/translations';

interface AiHelperProps {
    lang: UILanguage;
}

interface Message {
    role: 'user' | 'ai';
    text: string;
}

export const AiHelper: React.FC<AiHelperProps> = ({ lang }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', text: t('ai_helper_welcome', lang) }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsLoading(true);

        const response = await getAiHelperResponse(userMsg, lang);
        
        setMessages(prev => [...prev, { role: 'ai', text: response }]);
        setIsLoading(false);
    };

    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end font-sans">
            
            {/* CHAT WINDOW */}
            {isOpen && (
                <div className="mb-4 w-80 md:w-96 h-96 bg-white dark:bg-[#111] border-2 border-gray-300 dark:border-terminal-green shadow-2xl flex flex-col animate-fade-in rounded-lg overflow-hidden relative">
                    
                    {/* Header */}
                    <div className="bg-gray-100 dark:bg-terminal-green/20 border-b border-gray-300 dark:border-terminal-green p-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                             <span className="font-bold text-sm text-gray-700 dark:text-terminal-green uppercase tracking-wider">
                                 {t('ai_helper_title', lang)}
                             </span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-red-500 dark:text-terminal-green dark:hover:text-white transition-colors">
                            ✕
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-black/50">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    max-w-[85%] p-3 rounded-lg text-sm leading-relaxed shadow-sm
                                    ${m.role === 'user' 
                                        ? 'bg-blue-600 text-white rounded-br-none' 
                                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                                    }
                                `}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg rounded-bl-none flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSubmit} className="p-3 border-t border-gray-300 dark:border-terminal-green bg-white dark:bg-gray-900">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={t('ai_helper_placeholder', lang)}
                                className="flex-grow bg-gray-100 dark:bg-black border border-gray-300 dark:border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500 dark:focus:border-terminal-green dark:text-white"
                            />
                            <button 
                                type="submit" 
                                disabled={isLoading || !input.trim()}
                                className="p-2 bg-blue-600 dark:bg-terminal-green text-white dark:text-black rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                                ➤
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* FAB TOGGLE */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95
                    ${isOpen 
                        ? 'bg-gray-600 text-white' 
                        : 'bg-terminal-green text-terminal-btn-text animate-bounce-slow'
                    }
                `}
                title="System Support"
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                )}
            </button>
        </div>
    );
};
