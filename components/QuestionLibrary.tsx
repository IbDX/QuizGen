
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Question, QuestionType, SavedExam, UILanguage } from '../types';
import { getLibrary, removeQuestion, getSavedExams, removeExam, importSavedExam, triggerExamDownload, getHistory } from '../services/library';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeWindow } from './CodeWindow';
import { GraphRenderer } from './GraphRenderer'; 
import { DiagramRenderer } from './DiagramRenderer'; 
import { t } from '../utils/translations';

interface QuestionLibraryProps {
    isFullWidth: boolean;
    onLoadExam?: (exam: SavedExam) => void;
    lang?: UILanguage;
}

export const QuestionLibrary: React.FC<QuestionLibraryProps> = ({ isFullWidth, onLoadExam, lang = 'en' }) => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [exams, setExams] = useState<SavedExam[]>([]);
    const [history, setHistory] = useState<SavedExam[]>([]);
    const [filter, setFilter] = useState<string>('ALL');
    const [activeTab, setActiveTab] = useState<'QUESTIONS' | 'EXAMS' | 'HISTORY'>('QUESTIONS');
    const [isImporting, setIsImporting] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setQuestions(getLibrary());
        setExams(getSavedExams());
        setHistory(getHistory());
    }, []);

    const handleDeleteQuestion = (id: string) => {
        removeQuestion(id);
        setQuestions(prev => prev.filter(q => q.id !== id));
    };

    const handleDeleteExam = (id: string) => {
        removeExam(id);
        setExams(prev => prev.filter(e => e.id !== id));
    };

    const handleLoadExam = (e: SavedExam) => {
        if (onLoadExam) onLoadExam(e);
    };

    const handleImportClick = () => { fileInputRef.current?.click(); };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Limit file size to 10MB
        if (file.size > 10 * 1024 * 1024) {
            alert(lang === 'ar' ? 'حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت.' : 'File too large. Maximum size is 10MB.');
            return;
        }

        setIsImporting(true);
        try {
            const content = await file.text();
            const result = await importSavedExam(content);
            if (result.success) {
                setExams(getSavedExams());
                alert(t('import_success', lang));
                setActiveTab('EXAMS'); 
            } else {
                alert(`${t('import_failed', lang)}: ${result.message || "Unknown error"}`);
            }
        } catch (err) {
            alert(t('import_failed', lang));
        } finally {
            setIsImporting(false);
            if(fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleExportExam = async (exam: SavedExam) => {
        await triggerExamDownload(exam.questions, exam.title);
    };

    const availableFilters = useMemo(() => {
        const types = new Set(questions.map(q => q.type));
        const typeList = Array.from(types).sort();
        return ['ALL', ...typeList];
    }, [questions]);

    const filteredQuestions = filter === 'ALL' ? questions : questions.filter(q => q.type === filter);

    return (
        <div className={`mx-auto transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-4xl'}`}>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".zplus,.json" className="hidden" />

            <div className="flex flex-col md:flex-row items-center justify-between mb-8 border-b border-gray-300 dark:border-terminal-border pb-4 gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-terminal-green">📚</span>
                        {t('library', lang)}
                    </h2>
                    
                    <button 
                        onClick={handleImportClick}
                        disabled={isImporting}
                        className={`flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-terminal-gray dark:hover:bg-terminal-dimGreen text-gray-700 dark:text-terminal-light text-xs font-bold rounded border border-gray-300 dark:border-terminal-border transition-colors ${isImporting ? 'opacity-50 cursor-wait' : ''}`}
                        title="Import Exam File (.zplus)"
                    >
                        {isImporting ? <span className="animate-spin">↻</span> : <span>⬇</span>}
                        <span className="hidden sm:inline">{t('import_exam', lang)}</span>
                    </button>
                </div>
                
                <div className="flex bg-gray-200 dark:bg-terminal-gray p-1 rounded border border-gray-300 dark:border-terminal-border">
                    <button
                        onClick={() => setActiveTab('QUESTIONS')}
                        className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'QUESTIONS' ? 'bg-white dark:bg-terminal-black shadow-sm text-blue-600 dark:text-terminal-green' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}
                    >
                        {t('saved_questions', lang)} ({questions.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('EXAMS')}
                        className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'EXAMS' ? 'bg-white dark:bg-terminal-black shadow-sm text-purple-600 dark:text-terminal-green' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}
                    >
                        {t('saved_exams', lang)} ({exams.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('HISTORY')}
                        className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'HISTORY' ? 'bg-white dark:bg-terminal-black shadow-sm text-orange-600 dark:text-terminal-green' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}
                    >
                        HISTORY ({history.length})
                    </button>
                </div>
            </div>

            {activeTab === 'QUESTIONS' ? (
                <>
                    <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                        {availableFilters.map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-sm font-bold border whitespace-nowrap rounded-sm transition-colors ${filter === f ? 'bg-blue-600 text-white border-blue-600 dark:bg-terminal-green dark:text-terminal-btn-text dark:border-terminal-green' : 'bg-transparent border-gray-400 dark:border-terminal-border hover:border-blue-400 dark:text-terminal-light'}`}
                            >
                                {f === 'ALL' ? (lang === 'ar' ? 'الكل' : 'ALL') : f.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {questions.length === 0 ? (
                        <div className="text-center py-20 opacity-70 text-gray-500 dark:text-gray-400">
                            <div className="text-4xl mb-4 grayscale">📂</div>
                            <p className="font-mono">{t('library_empty', lang)}</p>
                        </div>
                    ) : (
                        <div className="space-y-8 pb-20">
                            {filteredQuestions.map((q, idx) => {
                                const hasCodeBlockInText = q.text.includes('```');
                                let displayText = q.text;
                                if (q.codeSnippet && !hasCodeBlockInText && displayText.includes(q.codeSnippet)) {
                                    displayText = displayText.replace(q.codeSnippet, '').trim();
                                }
                                
                                return (
                                    <div key={q.id} className="p-6 border-l-4 rtl:border-l-0 rtl:border-r-4 border-blue-500 dark:border-terminal-green bg-white dark:bg-terminal-gray shadow-lg relative group">
                                         <button 
                                            onClick={() => handleDeleteQuestion(q.id)}
                                            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-terminal-alert transition-colors"
                                            title="Remove from Library"
                                         >
                                            ✕
                                         </button>
            
                                         <div className="mb-4">
                                            <span className="text-xs font-bold uppercase bg-gray-100 dark:bg-terminal-black border dark:border-terminal-border px-2 py-1 rounded text-gray-600 dark:text-terminal-light">
                                                {q.type} • {q.topic}
                                            </span>
                                         </div>
            
                                         <div className="mb-6 text-lg dark:text-terminal-light">
                                            <MarkdownRenderer content={displayText} />
                                         </div>

                                         {q.graphConfig && <div className="mb-6"><GraphRenderer config={q.graphConfig} /></div>}
                                         {q.diagramConfig && <div className="mb-6"><DiagramRenderer code={q.diagramConfig.code} /></div>}
                                         {!q.graphConfig && !q.diagramConfig && q.visual && (
                                            <div className="mb-6">
                                                <img src={`data:image/png;base64,${q.visual}`} alt="Saved Visual" className="max-h-40 rounded border border-gray-300 dark:border-terminal-border" />
                                            </div>
                                         )}
                                         {q.codeSnippet && !hasCodeBlockInText && <div dir="ltr" className="text-left"><CodeWindow code={q.codeSnippet} /></div>}
                                         {(q.type === QuestionType.CODING || q.type === QuestionType.TRACING) && q.expectedOutput && (
                                            <div className="my-6" dir="ltr">
                                                <div className="bg-[#252526] px-4 py-2 border-b border-black flex items-center rounded-t-lg">
                                                    <span className="text-xs text-gray-400 font-mono uppercase">Expected Output</span>
                                                </div>
                                                <pre className="!m-0 !p-4 !bg-[#1e1e1e] !text-sm overflow-x-auto custom-scrollbar border border-t-0 border-gray-700 rounded-b-lg">
                                                    <code className="text-gray-200 font-mono leading-relaxed whitespace-pre-wrap">{q.expectedOutput}</code>
                                                </pre>
                                            </div>
                                         )}
            
                                         <div className="bg-blue-50 dark:bg-terminal-black p-4 rounded mt-4 border border-blue-100 dark:border-terminal-border">
                                            <h4 className="text-xs font-bold uppercase text-blue-600 dark:text-terminal-green mb-2">{t('analysis', lang)}</h4>
                                            <div className="text-sm dark:text-terminal-light">
                                                {q.type === QuestionType.MCQ && q.options && q.correctOptionIndex !== undefined && (
                                                    <div className="mb-2 font-bold">Correct Answer: {q.options[q.correctOptionIndex].replace(/\*\*/g, '')}</div>
                                                )}
                                                <MarkdownRenderer content={q.explanation} />
                                            </div>
                                         </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : activeTab === 'EXAMS' ? (
                <>
                    {exams.length === 0 ? (
                        <div className="text-center py-20 opacity-70 text-gray-500 dark:text-gray-400">
                            <div className="text-4xl mb-4 grayscale">💾</div>
                            <p className="font-mono">{t('no_saved_exams', lang)}</p>
                        </div>
                    ) : (
                        <div className="grid gap-6 pb-20">
                            {exams.map((exam) => (
                                <div key={exam.id} className="bg-white dark:bg-terminal-gray border border-gray-300 dark:border-terminal-border p-6 shadow-md hover:border-purple-500 dark:hover:border-terminal-green transition-colors relative group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-800 dark:text-terminal-light">{exam.title}</h3>
                                            <p className="text-xs text-gray-500 font-mono">{new Date(exam.date).toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                             <button onClick={() => handleExportExam(exam)} className="text-gray-400 hover:text-blue-500 dark:hover:text-terminal-green p-1" title={t('export_exam', lang)}>⬆</button>
                                            <button onClick={() => handleDeleteExam(exam.id)} className="text-gray-400 hover:text-red-500 dark:hover:text-terminal-alert p-1" title="Delete Exam">✕</button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 mb-6 text-sm">
                                        <div className="bg-purple-100 dark:bg-terminal-black/50 text-purple-700 dark:text-terminal-green px-3 py-1 rounded font-bold border dark:border-terminal-border">
                                            {exam.questions.length} Questions
                                        </div>
                                    </div>
                                    <button onClick={() => handleLoadExam(exam)} className="w-full py-3 bg-purple-600 hover:bg-purple-700 dark:bg-terminal-green dark:text-terminal-btn-text dark:hover:bg-terminal-dimGreen font-bold uppercase tracking-widest text-sm transition-colors">
                                        {t('load_retake', lang)}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                // HISTORY TAB
                <>
                    {history.length === 0 ? (
                        <div className="text-center py-20 opacity-70 text-gray-500 dark:text-gray-400">
                            <div className="text-4xl mb-4 grayscale">🕰️</div>
                            <p className="font-mono">NO RECENT HISTORY</p>
                        </div>
                    ) : (
                        <div className="grid gap-6 pb-20">
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono uppercase tracking-widest mb-2 border-b border-gray-300 dark:border-terminal-gray pb-2">Last 3 Exams</div>
                            {history.map((exam) => (
                                <div key={exam.id} className="bg-gray-50 dark:bg-black border border-gray-300 dark:border-terminal-gray p-4 shadow-inner opacity-90 hover:opacity-100 transition-opacity">
                                    <div className="flex justify-between items-center mb-3">
                                        <div>
                                            <h4 className="font-bold text-md text-gray-700 dark:text-terminal-light">{exam.title}</h4>
                                            <p className="text-[10px] text-gray-500 font-mono uppercase">{new Date(exam.date).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded text-xs font-bold border border-orange-200 dark:border-orange-800">
                                            HISTORY
                                        </div>
                                    </div>
                                    <button onClick={() => handleLoadExam(exam)} className="w-full py-2 bg-gray-200 hover:bg-gray-300 dark:bg-terminal-gray dark:hover:bg-terminal-dimGreen dark:text-terminal-green font-bold uppercase tracking-wider text-xs transition-colors rounded">
                                        RETAKE NOW
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
