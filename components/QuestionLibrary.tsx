
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Question, QuestionType, SavedExam, UILanguage } from '../types';
import { getLibrary, removeQuestion, getSavedExams, removeExam, importSavedExam, triggerExamDownload } from '../services/library';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeWindow } from './CodeWindow';
import { GraphRenderer } from './GraphRenderer'; // Import GraphRenderer
import { DiagramRenderer } from './DiagramRenderer'; // Import DiagramRenderer
import { t } from '../utils/translations';

interface QuestionLibraryProps {
    isFullWidth: boolean;
    onLoadExam?: (exam: SavedExam) => void;
    lang?: UILanguage;
}

export const QuestionLibrary: React.FC<QuestionLibraryProps> = ({ isFullWidth, onLoadExam, lang = 'en' }) => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [exams, setExams] = useState<SavedExam[]>([]);
    const [filter, setFilter] = useState<string>('ALL');
    const [activeTab, setActiveTab] = useState<'QUESTIONS' | 'EXAMS'>('QUESTIONS');
    const [isImporting, setIsImporting] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setQuestions(getLibrary());
        setExams(getSavedExams());
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
        if (onLoadExam) {
            onLoadExam(e);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const content = await file.text();
            const success = await importSavedExam(content);
            if (success) {
                setExams(getSavedExams());
                alert(t('import_success', lang));
                setActiveTab('EXAMS'); 
            } else {
                alert(t('import_failed', lang) + " (Invalid Format or Schema)");
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

    // Calculate unique types dynamically from the loaded questions
    const availableFilters = useMemo(() => {
        const types = new Set(questions.map(q => q.type));
        const typeList = Array.from(types).sort();
        return ['ALL', ...typeList];
    }, [questions]);

    const filteredQuestions = filter === 'ALL' 
        ? questions 
        : questions.filter(q => q.type === filter);

    return (
        <div className={`mx-auto transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-4xl'}`}>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".zplus,.json" 
                className="hidden" 
            />

            <div className="flex flex-col md:flex-row items-center justify-between mb-8 border-b border-gray-300 dark:border-gray-700 pb-4 gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">📚</span>
                        {t('library', lang)}
                    </h2>
                    
                    {/* IMPORT BUTTON */}
                    <button 
                        onClick={handleImportClick}
                        disabled={isImporting}
                        className={`flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded border border-gray-300 dark:border-gray-600 transition-colors ${isImporting ? 'opacity-50 cursor-wait' : ''}`}
                        title="Import Exam File (.zplus)"
                    >
                        {isImporting ? (
                            <span className="animate-spin">↻</span>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        )}
                        <span className="hidden sm:inline">{t('import_exam', lang)}</span>
                    </button>
                </div>
                
                {/* TAB SWITCHER */}
                <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded">
                    <button
                        onClick={() => setActiveTab('QUESTIONS')}
                        className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'QUESTIONS' ? 'bg-white dark:bg-black shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}
                    >
                        {t('saved_questions', lang)} ({questions.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('EXAMS')}
                        className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'EXAMS' ? 'bg-white dark:bg-black shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}
                    >
                        {t('saved_exams', lang)} ({exams.length})
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            {activeTab === 'QUESTIONS' ? (
                <>
                    {/* Filters */}
                    <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                        {availableFilters.map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-sm font-bold border whitespace-nowrap rounded-sm transition-colors ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent border-gray-400 dark:border-gray-600 hover:border-blue-400 dark:text-gray-300'}`}
                            >
                                {f === 'ALL' ? (lang === 'ar' ? 'الكل' : 'ALL') : f.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {questions.length === 0 ? (
                        <div className="text-center py-20 opacity-50">
                            <div className="text-4xl mb-4">📂</div>
                            <p>{t('library_empty', lang)}</p>
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
                                    <div key={q.id} className="p-6 border-l-4 rtl:border-l-0 rtl:border-r-4 border-blue-500 bg-white dark:bg-gray-900 shadow-lg relative group">
                                         <button 
                                            onClick={() => handleDeleteQuestion(q.id)}
                                            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Remove from Library"
                                         >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                         </button>
            
                                         <div className="mb-4">
                                            <span className="text-xs font-bold uppercase bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                                {q.type} • {q.topic}
                                            </span>
                                         </div>
            
                                         <div className="mb-6 text-lg">
                                            <MarkdownRenderer content={displayText} />
                                         </div>

                                         {q.graphConfig && (
                                            <div className="mb-6">
                                                <GraphRenderer config={q.graphConfig} />
                                            </div>
                                         )}

                                         {q.diagramConfig && (
                                            <div className="mb-6">
                                                <DiagramRenderer code={q.diagramConfig.code} />
                                            </div>
                                         )}

                                         {!q.graphConfig && !q.diagramConfig && q.visual && (
                                            <div className="mb-6">
                                                <img 
                                                    src={`data:image/png;base64,${q.visual}`} 
                                                    alt="Saved Visual" 
                                                    className="max-h-40 rounded border border-gray-300 dark:border-terminal-gray" 
                                                />
                                            </div>
                                         )}
            
                                         {q.codeSnippet && !hasCodeBlockInText && (
                                             <div dir="ltr" className="text-left">
                                                 <CodeWindow code={q.codeSnippet} />
                                             </div>
                                         )}

                                        {(q.type === QuestionType.CODING || q.type === QuestionType.TRACING) && q.expectedOutput && (
                                            <div className="my-6" dir="ltr">
                                                <div className="bg-[#252526] px-4 py-2 border-b border-black flex items-center rounded-t-lg">
                                                    <span className="text-xs text-gray-400 font-mono uppercase">Expected Output</span>
                                                </div>
                                                <pre className="!m-0 !p-4 !bg-[#1e1e1e] !text-sm overflow-x-auto custom-scrollbar border border-t-0 border-gray-700 rounded-b-lg">
                                                    <code className="text-gray-200 font-mono leading-relaxed whitespace-pre-wrap">
                                                        {q.expectedOutput}
                                                    </code>
                                                </pre>
                                            </div>
                                         )}
            
                                         <div className="bg-blue-50 dark:bg-[#0c0c0c] p-4 rounded mt-4 border border-blue-100 dark:border-gray-800">
                                            <h4 className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 mb-2">{t('analysis', lang)}</h4>
                                            <div className="text-sm">
                                                {q.type === QuestionType.MCQ && q.options && q.correctOptionIndex !== undefined && (
                                                    <div className="mb-2 font-bold">
                                                        Correct Answer: {q.options[q.correctOptionIndex].replace(/\*\*/g, '')}
                                                    </div>
                                                )}
                                                {q.type === QuestionType.TRACING && (
                                                    <div className="mb-2 font-bold font-mono">
                                                        Expected Output: {q.tracingOutput}
                                                    </div>
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
            ) : (
                <>
                    {/* EXAMS LIST */}
                    {exams.length === 0 ? (
                        <div className="text-center py-20 opacity-50">
                            <div className="text-4xl mb-4">💾</div>
                            <p>{t('no_saved_exams', lang)}</p>
                        </div>
                    ) : (
                        <div className="grid gap-6 pb-20">
                            {exams.map((exam) => (
                                <div key={exam.id} className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 p-6 shadow-md hover:border-purple-500 transition-colors relative group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{exam.title}</h3>
                                            <p className="text-xs text-gray-500 font-mono">{new Date(exam.date).toLocaleString()}</p>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                             <button 
                                                onClick={() => handleExportExam(exam)}
                                                className="text-gray-400 hover:text-blue-500 p-1"
                                                title={t('export_exam', lang)}
                                             >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteExam(exam.id)}
                                                className="text-gray-400 hover:text-red-500 p-1"
                                                title="Delete Exam"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 mb-6 text-sm">
                                        <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded font-bold">
                                            {exam.questions.length} Questions
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => handleLoadExam(exam)}
                                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase tracking-widest text-sm transition-colors"
                                    >
                                        {t('load_retake', lang)}
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
