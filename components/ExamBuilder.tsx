

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, sendExamBuilderMessage, generateExamFromBuilderChat } from '../services/gemini';
import { Question, ExamSettings } from '../types';
import { saveFullExam } from '../services/library';
import { MarkdownRenderer } from './MarkdownRenderer';
import { t } from '../utils/translations';
import { UILanguage } from '../types';

interface ExamBuilderProps {
    onExamGenerated: (questions: Question[], settings: Partial<ExamSettings>, title?: string) => void;
    onCancel: () => void;
    isFullWidth: boolean;
    lang: UILanguage;
}

interface GeneratedExamData {
    questions: Question[];
    settings: Partial<ExamSettings>;
    title: string;
}

export const ExamBuilder: React.FC<ExamBuilderProps> = ({ onExamGenerated, onCancel, isFullWidth, lang }) => {
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

        } catch (error) {
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
        } catch (error) {
            console.error(error);
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

    const handleDownload = () => {
        if (generatedData) {
            const exportData = {
                id: `exam_${Date.now()}`,
                title: generatedData.title,
                date: new Date().toISOString(),
                questions: generatedData.questions
            };
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = `${generatedData.title.replace(/\s+/g, '_')}_${Date.now()}.zplus`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        }
    };

    return (
        // CONTAINER STRATEGY:
        // Mobile: Fixed full screen (inset-0 top-16) to sit exactly under navbar. No rounding.
        // Desktop: Relative card, centered, rounded, shadow.
        <div className={`
            fixed inset-0 top-16 z-30 flex flex-col bg-white dark:bg-black 
            md:static md:z-0 md:h-[calc(100vh-12rem)] md:min-h-[600px] md:mt-8 md:rounded-lg md:border-2 md:border-terminal-green md:shadow-[0_0_30px_rgba(0,255,65,0.15)]
            ${isFullWidth ? 'md:max-w-none' : 'md:max-w-5xl md:mx-auto'}
        `}>
            
            {/* Header */}
            <div className="bg-gray-50 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-terminal-green/50 p-3 md:p-4 flex justify-between items-center shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-terminal-green rounded-full animate-pulse shadow-[0_0_8px_var(--color-term-green)]"></div>
                    <div>
                        <h2 className="font-bold text-base md:text-lg text-gray-800 dark:text-terminal-light font-mono tracking-wider leading-none">
                            {t('builder_title', lang)}
                        </h2>
                        <span className="text-[10px] text-gray-500 dark:text-terminal-green/70 font-mono tracking-widest hidden md:inline-block">
                            {t('builder_mode', lang)}
                        </span>
                    </div>
                </div>
                <button 
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded text-xs font-bold font-mono border border-gray-300 dark:border-gray-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                >
                    {t('abort', lang)}
                </button>
            </div>

            {/* If Exam is Generated, Show Success Overlay */}
            {generatedData ? (
                <div className="flex-grow flex flex-col items-center justify-center p-6 bg-white dark:bg-black animate-fade-in relative z-50">
                     <div className="max-w-md w-full text-center space-y-6 bg-gray-50 dark:bg-[#0c0c0c] p-8 rounded-xl border border-gray-200 dark:border-terminal-green/50 shadow-2xl">
                        <div className="w-16 h-16 bg-terminal-green rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(0,255,65,0.4)]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        
                        <div>
                            <h3 className="text-2xl font-bold font-mono text-gray-900 dark:text-white mb-2">{t('exam_ready', lang)}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('exam_ready_desc', lang)}</p>
                        </div>

                        <div className="text-left bg-white dark:bg-black/50 p-4 rounded border border-gray-200 dark:border-gray-800 space-y-2 text-sm font-mono">
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('suggested_title', lang)}:</span>
                                <span className="font-bold text-blue-600 dark:text-terminal-green">{generatedData.title}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('questions_count', lang)}:</span>
                                <span className="font-bold dark:text-white">{generatedData.questions.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('time_limit', lang)}:</span>
                                <span className="font-bold dark:text-white">
                                    {generatedData.settings.timeLimitMinutes 
                                        ? `${generatedData.settings.timeLimitMinutes} ${t('minutes', lang)}` 
                                        : '∞'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('mode', lang)}:</span>
                                <span className="font-bold dark:text-white">{generatedData.settings.mode}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <button 
                                onClick={handleStartExam}
                                className="w-full py-3 bg-terminal-green hover:bg-terminal-dimGreen text-black font-bold uppercase tracking-widest rounded transition-colors shadow-lg"
                            >
                                {t('start_now', lang)}
                            </button>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={handleSaveToLibrary}
                                    className="w-full py-2 border border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-bold uppercase text-xs rounded transition-colors"
                                >
                                    {saveStatus || t('save_library', lang)}
                                </button>
                                <button 
                                    onClick={handleDownload}
                                    className="w-full py-2 border border-gray-400 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold uppercase text-xs rounded transition-colors"
                                >
                                    {t('download_zplus', lang)}
                                </button>
                            </div>
                        </div>
                     </div>
                </div>
            ) : !languageSelected ? (
                // LANGUAGE SELECTION SCREEN
                <div className="flex-grow flex flex-col items-center justify-center p-6 bg-white dark:bg-black animate-fade-in overflow-y-auto">
                    <div className="max-w-md w-full text-center space-y-8">
                        <div className="space-y-3">
                             <div className="text-5xl mb-6 animate-bounce">👋</div>
                             <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{t('init_system', lang)}</h3>
                             <p className="text-gray-500 text-sm">{t('select_lang_msg', lang)}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            <button 
                                onClick={() => handleLanguageSelect('en')}
                                className="p-6 border-2 border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-terminal-green bg-gray-50 dark:bg-gray-900 rounded-xl transition-all group flex flex-row md:flex-col items-center justify-center gap-4 active:scale-95"
                            >
                                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🇺🇸</span>
                                <span className="font-bold font-mono text-lg text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-terminal-green">ENGLISH</span>
                            </button>

                            <button 
                                onClick={() => handleLanguageSelect('ar')}
                                className="p-6 border-2 border-gray-200 dark:border-gray-800 hover:border-green-500 dark:hover:border-terminal-green bg-gray-50 dark:bg-gray-900 rounded-xl transition-all group flex flex-row md:flex-col items-center justify-center gap-4 active:scale-95"
                            >
                                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🇸🇦</span>
                                <span className="font-bold font-sans text-lg text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-terminal-green">العربية</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                // CHAT INTERFACE
                <>
                    {/* Chat Area */}
                    <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-6 bg-white dark:bg-black scroll-smooth">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                <div className={`
                                    max-w-[90%] md:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm text-sm md:text-base leading-relaxed break-words relative
                                    ${m.role === 'user' 
                                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm' 
                                        : 'bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                                    }
                                `}>
                                    {m.role === 'model' && (
                                        <div className="text-[9px] font-bold text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                                            <span>🤖</span> {t('agent_role', lang)}
                                        </div>
                                    )}
                                    <MarkdownRenderer content={m.text} className={m.role === 'user' ? 'text-white' : ''} />
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start animate-pulse">
                                <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                                </div>
                            </div>
                        )}
                        {/* Spacer for bottom scrolling */}
                        <div className="h-4"></div> 
                    </div>

                    {/* Controls Area */}
                    <div className="bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 shrink-0 pb-safe">
                        
                        {isFinalizing ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-4 px-6">
                                <div className="text-terminal-green font-mono font-bold text-base md:text-lg animate-pulse">{t('compiling', lang)}</div>
                                <div className="w-full max-w-md h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
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
                                                className="whitespace-nowrap px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-full text-xs font-bold text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-sm active:scale-95"
                                            >
                                                {reply}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <form onSubmit={handleFormSubmit} className="flex gap-2 items-end bg-gray-100 dark:bg-gray-900 p-2 rounded-xl border border-transparent focus-within:border-blue-400 dark:focus-within:border-terminal-green transition-colors">
                                    <textarea 
                                        ref={textareaRef}
                                        rows={1}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        // Removed onKeyDown to allow natural multi-line behavior
                                        placeholder={lang === 'ar' ? "اكتب ردك هنا..." : "Type your response here..."}
                                        className="flex-grow p-2 bg-transparent outline-none font-sans text-gray-800 dark:text-white resize-none max-h-40 min-h-[24px] text-sm md:text-base leading-relaxed"
                                        autoFocus
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!input.trim() || isTyping}
                                        className="p-2 bg-blue-600 dark:bg-terminal-green text-white dark:text-black rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-90 flex-shrink-0 w-10 h-10 flex items-center justify-center"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rtl:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                        </svg>
                                    </button>
                                </form>

                                <div className="flex justify-end">
                                    <button 
                                        onClick={handleCompileExam}
                                        disabled={messages.length < 2}
                                        className="w-full md:w-auto px-6 py-3 bg-gray-900 dark:bg-gray-800 text-white dark:text-terminal-green font-bold text-xs uppercase tracking-widest hover:bg-black dark:hover:bg-gray-700 transition-all active:scale-95 rounded-lg border border-gray-700 dark:border-terminal-green disabled:opacity-50 disabled:cursor-not-allowed"
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
