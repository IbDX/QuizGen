
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, sendExamBuilderMessage, generateExamFromBuilderChat } from '../services/gemini';
import { Question, ExamSettings } from '../types';
import { saveFullExam, triggerExamDownload } from '../services/library';
import { MarkdownRenderer } from './MarkdownRenderer';
import { t } from '../utils/translations';
import { UILanguage } from '../types';

interface ExamBuilderProps {
    onExamGenerated: (questions: Question[], settings: Partial<ExamSettings>, title?: string) => void;
    onCancel: () => void;
    isFullWidth: boolean;
    lang: UILanguage;
    onQuotaError: () => void;
}

interface GeneratedExamData {
    questions: Question[];
    settings: Partial<ExamSettings>;
    title: string;
}

export const ExamBuilder: React.FC<ExamBuilderProps> = ({ onExamGenerated, onCancel, isFullWidth, lang, onQuotaError }) => {
    // State
    const [languageSelected, setLanguageSelected] = useState<boolean>(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [quickReplies, setQuickReplies] = useState<string[]>([]);
    
    // New state for holding the generated exam before starting
    const [generatedData, setGeneratedData] = useState<GeneratedExamData | null>(null);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, languageSelected, quickReplies]);
    
    // Auto-grow textarea effect
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 150)}px`; // Increased max height for better multi-line view
        }
    }, [input]);

    const handleLanguageSelect = (selectedLang: 'en' | 'ar') => {
        setLanguageSelected(true);
        const greeting = selectedLang === 'ar' 
            ? "مرحباً! أنا مهندس الاختبارات الذكي.\n\nيمكنني تصميم اختبارات MCQ، كتابة أكواد، أو حتى **مخططات هيكلية** (UML، خرائط تدفق).\n\nللبدء، يرجى تزويدي بالمعلومات التالية:\n1. **موضوع الاختبار** (مثال: فيزياء، جافا سكربت، تصميم أنظمة).\n2. **لغة الأسئلة** (هل تريد الاختبار بالعربية أم الإنجليزية؟)."
            : "Hello! I am your AI Exam Builder.\n\nI can design MCQs, Coding Challenges, and even **Diagram Questions** (UML, Flowcharts).\n\nTo get started, please tell me:\n1. The **Subject** of the exam (e.g., Physics, JavaScript, System Design).\n2. The **Language** you want the questions to be in (English or Arabic).";
        
        setMessages([{ role: 'model', text: greeting }]);
        setQuickReplies(selectedLang === 'ar' 
            ? ["جافا سكربت - للمبتدئين", "فيزياء عامة", "تاريخ الحاسوب"] 
            : ["JavaScript Basics", "General Physics", "Computer History"]
        );
    };

    const handleSendMessage = async (textOverride?: string) => {
        const textToSend = textOverride || input;
        
        if (!textToSend.trim() || isTyping || isFinalizing) return;

        setInput('');
        setQuickReplies([]); // Clear old suggestions
        setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
        setIsTyping(true);

        try {
            const rawResponse = await sendExamBuilderMessage(messages, textToSend);
            
            // Parse response for Suggestions
            let cleanResponse = rawResponse;
            let newSuggestions: string[] = [];
            
            if (rawResponse.includes('||SUGGESTIONS||')) {
                const parts = rawResponse.split('||SUGGESTIONS||');
                cleanResponse = parts[0].trim();
                try {
                    const jsonString = parts[1].trim();
                    // Basic cleanup in case parsing is tricky
                    const validJson = jsonString.substring(jsonString.indexOf('['), jsonString.lastIndexOf(']') + 1);
                    newSuggestions = JSON.parse(validJson);
                } catch (e) {
                    console.warn("Failed to parse suggested replies", e);
                }
            }

            setMessages(prev => [...prev, { role: 'model', text: cleanResponse }]);
            setQuickReplies(newSuggestions.slice(0, 3)); // Ensure max 3

        } catch (error: any) {
            if (error.message === "429_RATE_LIMIT" || error.message?.includes('429') || error.message?.toLowerCase().includes('quota')) {
                onQuotaError();
            }
            setMessages(prev => [...prev, { role: 'model', text: t('connection_error', lang) }]);
        } finally {
            setIsTyping(false);
        }
    };
    
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage();
    };

    const handleCompileExam = async () => {
        if (messages.length < 2) return; 
        setIsFinalizing(true);
        try {
            const { questions, settings, title } = await generateExamFromBuilderChat(messages);
            setGeneratedData({ questions, settings, title });
        } catch (error: any) {
            console.error(error);
            if (error.message === "429_RATE_LIMIT" || error.message?.includes('429') || error.message?.toLowerCase().includes('quota')) {
                onQuotaError();
            }
            alert("Failed to compile exam from chat. Please ensure the conversation has defined specific questions.");
            setIsFinalizing(false);
        }
    };

    const handleStartExam = () => {
        if (generatedData) {
            onExamGenerated(generatedData.questions, generatedData.settings, generatedData.title);
        }
    };

    const handleSaveToLibrary = () => {
        if (generatedData) {
            saveFullExam(generatedData.questions, generatedData.title);
            setSaveStatus(t('saved', lang));
            setTimeout(() => setSaveStatus(null), 2000);
        }
    };

    const handleDownload = async () => {
        if (generatedData) {
            await triggerExamDownload(generatedData.questions, generatedData.title);
        }
    };

    return (
        // MAIN TERMINAL CONTAINER
        <div className={`
            fixed inset-0 top-16 z-30 flex flex-col bg-[#050505] 
            md:static md:z-0 md:h-[calc(100vh-12rem)] md:min-h-[600px] md:mt-8 md:rounded-lg md:border-2 md:border-terminal-green md:shadow-[0_0_30px_rgba(0,255,65,0.15)]
            ${isFullWidth ? 'md:max-w-none' : 'md:max-w-5xl md:mx-auto'}
            relative overflow-hidden
        `}>
            {/* GRID PATTERN BACKGROUND */}
            <div 
                className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ 
                    backgroundImage: 'radial-gradient(circle, #00ff41 1px, transparent 1px)', 
                    backgroundSize: '20px 20px' 
                }}
            ></div>
            
            {/* TACTICAL HEADER */}
            <div className="bg-[#0c0c0c] border-b border-terminal-green/50 p-4 flex justify-between items-center shrink-0 z-20 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black rounded border border-terminal-green flex items-center justify-center relative overflow-hidden group">
                        <span className="text-xl relative z-10">🤖</span>
                        <div className="absolute inset-0 bg-terminal-green/10 group-hover:bg-terminal-green/20 transition-colors"></div>
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-white font-mono tracking-[0.2em] leading-none mb-1">
                            {t('builder_title', lang)}
                        </h2>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-terminal-green rounded-full animate-pulse shadow-[0_0_5px_#00ff41]"></div>
                            <span className="text-[9px] text-terminal-green font-mono tracking-widest font-bold">
                                NET: SECURE
                            </span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={onCancel}
                    className="px-4 py-2 bg-transparent border border-gray-700 text-gray-400 font-bold font-mono text-[10px] uppercase tracking-wider hover:border-red-500 hover:text-red-500 transition-colors rounded-sm"
                >
                    {t('abort', lang)}
                </button>
            </div>

            {/* If Exam is Generated, Show Success Overlay */}
            {generatedData ? (
                <div className="flex-grow flex flex-col items-center justify-center p-6 bg-[#050505] animate-fade-in relative z-50">
                     <div className="max-w-md w-full text-center space-y-6 bg-[#0c0c0c] p-8 rounded-lg border border-terminal-green shadow-[0_0_50px_rgba(0,255,65,0.1)] relative">
                        
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-terminal-green rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(0,255,65,0.4)] mb-6 text-black border-4 border-black/20">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            
                            <h3 className="text-2xl font-bold font-mono text-white mb-2 tracking-tight">{t('exam_ready', lang)}</h3>
                            <p className="text-gray-400 text-xs font-mono">{t('exam_ready_desc', lang)}</p>
                        </div>

                        <div className="relative z-10 text-left bg-[#151515] p-4 rounded border border-terminal-green/30 space-y-3 text-xs font-mono">
                            <div className="flex justify-between border-b border-dashed border-gray-800 pb-2">
                                <span className="text-gray-500 uppercase">{t('suggested_title', lang)}</span>
                                <span className="font-bold text-terminal-green">{generatedData.title}</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-gray-800 pb-2">
                                <span className="text-gray-500 uppercase">{t('questions_count', lang)}</span>
                                <span className="font-bold text-white">{generatedData.questions.length}</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-gray-800 pb-2">
                                <span className="text-gray-500 uppercase">{t('time_limit', lang)}</span>
                                <span className="font-bold text-white">
                                    {generatedData.settings.timeLimitMinutes 
                                        ? `${generatedData.settings.timeLimitMinutes} ${t('minutes', lang)}` 
                                        : '∞'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 uppercase">{t('mode', lang)}</span>
                                <span className="font-bold text-white">{generatedData.settings.mode}</span>
                            </div>
                        </div>

                        <div className="relative z-10 grid grid-cols-1 gap-3 pt-2">
                            <button 
                                onClick={handleStartExam}
                                className="w-full py-3 bg-terminal-green text-black font-bold uppercase tracking-widest rounded hover:bg-terminal-dimGreen active:scale-95 transition-all shadow-lg text-sm"
                            >
                                {t('start_now', lang)}
                            </button>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={handleSaveToLibrary}
                                    className="w-full py-2 border border-purple-500 text-purple-400 hover:bg-purple-900/20 font-bold uppercase text-[10px] tracking-wider rounded transition-colors"
                                >
                                    {saveStatus || t('save_library', lang)}
                                </button>
                                <button 
                                    onClick={handleDownload}
                                    className="w-full py-2 border border-gray-600 text-gray-400 hover:bg-gray-800 font-bold uppercase text-[10px] tracking-wider rounded transition-colors"
                                >
                                    {t('download_zplus', lang)}
                                </button>
                            </div>
                        </div>
                     </div>
                </div>
            ) : !languageSelected ? (
                // LANGUAGE SELECTION SCREEN
                <div className="flex-grow flex flex-col items-center justify-center p-6 bg-[#050505] animate-fade-in overflow-y-auto relative z-10">
                    <div className="max-w-md w-full text-center space-y-8">
                        <div className="space-y-3">
                             <div className="text-5xl mb-6 animate-bounce">👋</div>
                             <h3 className="text-2xl font-bold text-white font-mono">{t('init_system', lang)}</h3>
                             <p className="text-gray-500 text-sm font-mono">{t('select_lang_msg', lang)}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            <button 
                                onClick={() => handleLanguageSelect('en')}
                                className="p-6 border border-gray-800 hover:border-terminal-green bg-[#111] hover:bg-[#1a1a1a] rounded transition-all group flex flex-row md:flex-col items-center justify-center gap-4 active:scale-95"
                            >
                                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🇺🇸</span>
                                <span className="font-bold font-mono text-lg text-gray-300 group-hover:text-terminal-green">ENGLISH</span>
                            </button>

                            <button 
                                onClick={() => handleLanguageSelect('ar')}
                                className="p-6 border border-gray-800 hover:border-terminal-green bg-[#111] hover:bg-[#1a1a1a] rounded transition-all group flex flex-row md:flex-col items-center justify-center gap-4 active:scale-95"
                            >
                                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🇸🇦</span>
                                <span className="font-bold font-sans text-lg text-gray-300 group-hover:text-terminal-green">العربية</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                // CHAT INTERFACE
                <>
                    {/* Chat Area */}
                    <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-6 bg-[#050505] scroll-smooth relative z-10">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                <div className={`
                                    max-w-[90%] md:max-w-[75%] px-4 py-3 text-sm md:text-base leading-relaxed break-words relative
                                    ${m.role === 'user' 
                                        ? 'border-r-2 border-gray-500 bg-[#151515] text-gray-300' 
                                        : 'border-l-2 border-terminal-green bg-[#111] text-gray-200 shadow-[0_0_10px_rgba(0,0,0,0.5)]'
                                    }
                                `}>
                                    {m.role === 'model' && (
                                        <div className="text-[10px] font-bold text-terminal-green mb-3 uppercase tracking-widest flex items-center gap-2 border-b border-terminal-green/20 pb-2">
                                            <span className="text-lg">🤖</span> {t('agent_role', lang)}
                                        </div>
                                    )}
                                    {m.role === 'user' && (
                                        <div className="text-[9px] font-bold text-gray-500 mb-2 uppercase tracking-widest text-right">
                                            USER_INPUT
                                        </div>
                                    )}
                                    <MarkdownRenderer content={m.text} className={m.role === 'user' ? 'text-gray-300 font-mono' : 'font-mono'} />
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start animate-pulse">
                                <div className="bg-[#111] border-l-2 border-terminal-green/50 px-4 py-3 flex gap-1 items-center">
                                    <span className="w-1.5 h-1.5 bg-terminal-green rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-terminal-green rounded-full animate-bounce delay-100"></span>
                                    <span className="w-1.5 h-1.5 bg-terminal-green rounded-full animate-bounce delay-200"></span>
                                </div>
                            </div>
                        )}
                        {/* Spacer for bottom scrolling */}
                        <div className="h-4"></div> 
                    </div>

                    {/* Controls Area */}
                    <div className="bg-[#0c0c0c] border-t border-terminal-green/30 shrink-0 pb-safe z-20">
                        
                        {isFinalizing ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-4 px-6">
                                <div className="text-terminal-green font-mono font-bold text-base md:text-lg animate-pulse">{t('compiling', lang)}</div>
                                <div className="w-full max-w-md h-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-terminal-green animate-progress"></div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 md:p-4 space-y-3">
                                {/* Suggested Replies Chips */}
                                {quickReplies.length > 0 && !isTyping && (
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0">
                                        {quickReplies.map((reply, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSendMessage(reply)}
                                                className="whitespace-nowrap px-4 py-2 bg-[#1a1a1a] border border-terminal-green/30 hover:border-terminal-green hover:bg-terminal-green hover:text-black rounded text-[10px] font-bold font-mono uppercase tracking-wide text-terminal-green transition-all shadow-sm active:scale-95"
                                            >
                                                {reply}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <form onSubmit={handleFormSubmit} className="flex gap-0 items-end bg-black p-0 border border-terminal-green/50 focus-within:border-terminal-green transition-colors">
                                    <div className="pl-3 py-3 text-terminal-green animate-pulse">➤</div>
                                    <textarea 
                                        ref={textareaRef}
                                        rows={1}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder={lang === 'ar' ? "اكتب ردك هنا..." : "Type your response here..."}
                                        className="flex-grow p-3 bg-transparent outline-none font-mono text-white resize-none max-h-40 min-h-[24px] text-sm md:text-base leading-relaxed placeholder-gray-600"
                                        autoFocus
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!input.trim() || isTyping}
                                        className="px-4 py-3 bg-terminal-green text-black hover:bg-terminal-dimGreen disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold h-full flex items-center justify-center uppercase text-xs tracking-wider"
                                    >
                                        SEND
                                    </button>
                                </form>

                                <div className="flex justify-end pt-2">
                                    <button 
                                        onClick={handleCompileExam}
                                        disabled={messages.length < 2}
                                        className="w-full md:w-auto px-6 py-3 bg-[#151515] text-terminal-green border border-terminal-green font-bold text-[10px] font-mono uppercase tracking-widest hover:bg-terminal-green hover:text-black transition-all active:scale-95 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t('builder_generate', lang)}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
            
            <style>{`
                @keyframes progress { 0% { width: 0% } 100% { width: 100% } }
                .animate-progress { animation: progress 2s ease-in-out infinite; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
            `}</style>
        </div>
    );
};
