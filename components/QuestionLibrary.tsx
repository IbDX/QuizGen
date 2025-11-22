import React, { useState, useEffect } from 'react';
import { Question, QuestionType } from '../types';
import { getLibrary, removeQuestion } from '../services/library';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeWindow } from './CodeWindow';

interface QuestionLibraryProps {
    isFullWidth: boolean;
}

export const QuestionLibrary: React.FC<QuestionLibraryProps> = ({ isFullWidth }) => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [filter, setFilter] = useState<string>('ALL');

    useEffect(() => {
        setQuestions(getLibrary());
    }, []);

    const handleDelete = (id: string) => {
        removeQuestion(id);
        setQuestions(prev => prev.filter(q => q.id !== id));
    };

    const filteredQuestions = filter === 'ALL' 
        ? questions 
        : questions.filter(q => q.type === filter);

    return (
        <div className={`mx-auto transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-4xl'}`}>
            <div className="flex items-center justify-between mb-8 border-b border-gray-300 dark:border-palette-accent pb-4">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-palette-text">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">📚</span>
                    QUESTION LIBRARY
                </h2>
                <div className="text-sm font-mono bg-gray-200 dark:bg-palette-header dark:text-palette-text px-3 py-1 rounded">
                    SAVED: {questions.length}
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-8">
                {['ALL', 'MCQ', 'TRACING', 'CODING'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 text-sm font-bold border ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent border-gray-400 dark:border-palette-accent hover:border-blue-400 dark:text-palette-text'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {questions.length === 0 ? (
                <div className="text-center py-20 opacity-50 dark:text-palette-text">
                    <div className="text-4xl mb-4">📂</div>
                    <p>LIBRARY IS EMPTY</p>
                    <p className="text-sm">Save questions during an exam to verify them here.</p>
                </div>
            ) : (
                <div className="space-y-8 pb-20">
                    {filteredQuestions.map((q, idx) => (
                        <div key={q.id} className="p-6 border-l-4 border-blue-500 bg-white dark:bg-palette-header shadow-lg relative group text-gray-900 dark:text-palette-text">
                             <button 
                                onClick={() => handleDelete(q.id)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                                title="Remove from Library"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                             </button>

                             <div className="mb-4">
                                <span className="text-xs font-bold uppercase bg-gray-100 dark:bg-palette-deep px-2 py-1 rounded text-gray-600 dark:text-palette-text">
                                    {q.type} • {q.topic}
                                </span>
                             </div>

                             <div className="mb-6 text-lg">
                                <MarkdownRenderer content={q.text} />
                             </div>

                             {q.codeSnippet && (
                                 <CodeWindow code={q.codeSnippet} />
                             )}

                             <div className="bg-blue-50 dark:bg-palette-deep p-4 rounded mt-4 border border-blue-100 dark:border-palette-accent">
                                <h4 className="text-xs font-bold uppercase text-blue-600 dark:text-palette-text mb-2">Analysis / Solution</h4>
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
                    ))}
                </div>
            )}
        </div>
    );
};