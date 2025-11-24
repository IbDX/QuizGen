
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, sendExamBuilderMessage, generateExamFromBuilderChat } from '../services/gemini';
import { Question } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { t } from '../utils/translations';
import { UILanguage } from '../types';

interface ExamBuilderProps {
    onExamGenerated: (questions: Question[]) => void;
    onCancel: () => void;
    isFullWidth: boolean;
    lang: UILanguage;
}

export const ExamBuilder: React.FC<ExamBuilderProps> = ({ onExamGenerated, onCancel, isFullWidth, lang }) => {
    // State
    const [languageSelected, setLanguageSelected] = useState<boolean>(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, languageSelected]);

    const handleLanguageSelect = (selectedLang: 'en' | 'ar') => {
        setLanguageSelected(true);
        const greeting = selectedLang === 'ar' 
            ? "مرحباً! أنا مهندس الاختبارات الذكي.\n\nللبدء، يرجى تزويدي بالمعلومات التالية:\n1. **موضوع الاختبار** (مثال: فيزياء، جافا سكربت، تاريخ).\n2. **لغة الأسئلة** (هل تريد الاختبار بالعربية أم الإنجليزية؟)."
            : "Hello! I am your AI Exam Builder.\n\nTo get started, please tell me:\n1. The **Subject** of the exam (e.g., Physics, JavaScript, History).\n2. The **Language** you want the questions to be in (English or Arabic).";
        
        setMessages([{ role: 'model', text: greeting }]);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isTyping || isFinalizing) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsTyping(true);

        try {
            const response = await sendExamBuilderMessage(messages, userMsg);
            setMessages(prev => [...prev, { role: 'model', text: response }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: "Connection interrupted. Please try again." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleCompileExam = async () => {
        if (messages.length < 2) return; 
        setIsFinalizing(true);
        try {
            const questions = await generateExamFromBuilderChat(messages);
            onExamGenerated(questions);
        } catch (error) {
            console.error(error);
            alert("Failed to compile exam from chat. Please ensure the conversation has defined specific questions.");
            setIsFinalizing(false);
        }
    };

    return (
        <div className={`w-full mx-auto mt-4 md:mt-10 transition-all duration-300 ${isFullWidth ? 'max-w-none px-4' : 'max-w-4xl'}`}>
            <div className="bg-gray-100 dark:bg-black border-2 border-terminal-green shadow-[0_0_20px_rgba(0,255,65,0.1)] rounded-lg overflow-hidden flex flex-col h-[80vh]">
                
                {/* Header */}
                <div className="bg-terminal-green/10 border-b border-terminal-green p-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-terminal-green rounded-full animate-pulse"></div>
                        <h2 className="font-bold text-lg md:text-xl text-gray-800 dark:text-terminal-light font-mono tracking-wider">
                            AI EXAM BUILDER <span className="text-xs opacity-60 ml-2">[INTERACTIVE MODE]</span>
                        </h2>
                    </div>
                    <button 
                        onClick={onCancel}
                        className="text-gray-500 hover:text-red-500 transition-colors font-mono font-bold text-sm"
                    >
                        [ESC] ABORT
                    </button>
                </div>

                {!languageSelected ? (
                    // LANGUAGE SELECTION SCREEN
                    <div className="flex-grow flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-900/50 animate-fade-in">
                        <div className="max-w-md w-full text-center space-y-8">
                            <div className="space-y-2">
                                 <div className="text-4xl mb-4 animate-bounce">👋</div>
                                 <h3 className="text-2xl font-bold text-gray-800 dark:text-terminal-light font-mono">INITIALIZE SYSTEM</h3>
                                 <p className="text-gray-500 font-mono text-sm">Select conversation language to begin.</p>
                                 <p className="text-gray-500 font-mono text-xs opacity-75">اختر لغة المحادثة للبدء</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => handleLanguageSelect('en')}
                                    className="p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-terminal-green dark:hover:border-terminal-green bg-white dark:bg-black hover:bg-green-50 dark:hover:bg-terminal-green/10 rounded-xl transition-all group flex flex-col items-center gap-2"
                                >
                                    <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🇺🇸</span>
                                    <span className="font-bold font-mono text-gray-700 dark:text-gray-300 group-hover:text-terminal-green">ENGLISH</span>
                                </button>

                                <button 
                                    onClick={() => handleLanguageSelect('ar')}
                                    className="p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-terminal-green dark:hover:border-terminal-green bg-white dark:bg-black hover:bg-green-50 dark:hover:bg-terminal-green/10 rounded-xl transition-all group flex flex-col items-center gap-2"
                                >
                                    <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🇸🇦</span>
                                    <span className="font-bold font-mono text-gray-700 dark:text-gray-300 group-hover:text-terminal-green font-sans">العربية</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // CHAT INTERFACE
                    <>
                        {/* Chat Area */}
                        <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6 bg-white dark:bg-gray-900/50 scroll-smooth">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] md:max-w-[75%] rounded-lg p-4 shadow-sm text-sm md:text-base leading-relaxed ${
                                        m.role === 'user' 
                                            ? 'bg-blue-600 text-white border border-blue-700 rounded-br-none shadow-md' 
                                            : 'bg-white dark:bg-black border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm'
                                    }`}>
                                        <div className={`font-bold text-[10px] mb-1 uppercase tracking-wider ${m.role === 'user' ? 'text-blue-100 opacity-80' : 'text-gray-500 opacity-50'}`}>
                                            {m.role === 'user' ? 'USER' : 'SYSTEM AGENT'}
                                        </div>
                                        <MarkdownRenderer content={m.text} className={m.role === 'user' ? 'text-white' : ''} />
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 p-4 rounded-lg rounded-bl-none">
                                        <span className="inline-block w-2 h-4 bg-terminal-green animate-blink"></span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Controls Area */}
                        <div className="p-4 bg-gray-50 dark:bg-black border-t border-gray-300 dark:border-gray-800 shrink-0">
                            
                            {isFinalizing ? (
                                <div className="flex flex-col items-center justify-center py-6 gap-4 animate-pulse">
                                    <div className="text-terminal-green font-mono font-bold text-lg">COMPILING EXAM DATA...</div>
                                    <div className="w-full max-w-md h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-terminal-green animate-progress"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <form onSubmit={handleSendMessage} className="flex gap-2 mb-4">
                                        <input 
                                            type="text" 
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder={lang === 'ar' ? "اكتب ردك هنا..." : "Type your response here..."}
                                            className="flex-grow p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:border-terminal-green focus:ring-1 focus:ring-terminal-green outline-none font-mono text-gray-800 dark:text-terminal-light"
                                            autoFocus
                                        />
                                        <button 
                                            type="submit"
                                            disabled={!input.trim() || isTyping}
                                            className="px-6 bg-gray-800 dark:bg-terminal-green/20 border border-gray-600 dark:border-terminal-green text-white dark:text-terminal-green hover:bg-gray-700 dark:hover:bg-terminal-green/30 font-bold uppercase rounded transition-colors disabled:opacity-50"
                                        >
                                            ➤
                                        </button>
                                    </form>

                                    <div className="flex justify-between items-center">
                                        <p className="text-[10px] text-gray-400 font-mono hidden md:block">
                                            {lang === 'ar' ? "استخدم الدردشة لتحديد المحتوى، ثم اضغط 'إنشاء الاختبار' عند الانتهاء." : "Negotiate exam content above. Click 'GENERATE EXAM' when ready."}
                                        </p>
                                        <button 
                                            onClick={handleCompileExam}
                                            className="w-full md:w-auto px-8 py-3 bg-blue-600 dark:bg-terminal-green text-white dark:text-black font-bold font-mono uppercase tracking-widest hover:bg-blue-700 dark:hover:bg-terminal-dimGreen shadow-lg transition-all active:scale-95"
                                        >
                                            [ {lang === 'ar' ? "إنشاء الاختبار النهائي" : "GENERATE FINAL EXAM"} ]
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
            
            <style>{`
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                .animate-blink { animation: blink 1s infinite; }
                @keyframes progress { 0% { width: 0% } 100% { width: 100% } }
                .animate-progress { animation: progress 2s ease-in-out infinite; }
            `}</style>
        </div>
    );
};
