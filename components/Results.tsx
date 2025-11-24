

import React, { useState, useEffect } from 'react';
import { Question, UserAnswer, QuestionType, LeaderboardEntry, UILanguage } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeWindow } from './CodeWindow';
import { GraphRenderer } from './GraphRenderer'; // Import GraphRenderer
import { generateExamPDF } from '../utils/pdfGenerator';
import { saveQuestion, removeQuestion, isQuestionSaved, saveFullExam } from '../services/library';
import { sanitizeInput } from '../utils/security';
import { t } from '../utils/translations';
import { gradeCodingAnswer, gradeShortAnswer } from '../services/gemini'; // Import grading services

interface ResultsProps {
  questions: Question[];
  answers: UserAnswer[];
  onRestart: () => void;
  onRetake: () => void;
  onGenerateRemediation: (wrongIds: string[]) => void;
  isFullWidth: boolean;
  autoHideFooter?: boolean;
  lang: UILanguage;
}

const getTopicResources = (topicRaw: string) => {
  const topic = topicRaw.toLowerCase().trim();
  // Hardcoded curated list for common topics
  const RESOURCES: Record<string, { video: string, read: string }> = {
    'pointers': { video: 'https://www.youtube.com/results?search_query=pointers+in+c%2B%2B+explained', read: 'https://www.geeksforgeeks.org/pointers-in-c-cpp/' },
    'recursion': { video: 'https://www.youtube.com/results?search_query=recursion+explained+computer+science', read: 'https://www.freecodecamp.org/news/recursion-in-programming-explained/' },
    'loops': { video: 'https://www.youtube.com/results?search_query=loops+in+programming+tutorial', read: 'https://www.w3schools.com/cpp/cpp_for_loop.asp' },
    'arrays': { video: 'https://www.youtube.com/results?search_query=arrays+data+structure', read: 'https://www.programiz.com/cpp-programming/arrays' },
    'oop': { video: 'https://www.youtube.com/results?search_query=object+oriented+programming+concepts', read: 'https://www.educative.io/blog/object-oriented-programming' },
  };

  if (RESOURCES[topic]) return RESOURCES[topic];

  // Smart Fallback
  let searchSuffix = " explanation";
  let readSuffix = " guide concepts";
  
  // Basic language detection for search query
  if (topic.match(/[\u0600-\u06FF]/)) {
       searchSuffix = " شرح";
       readSuffix = " مفاهيم";
  }

  return {
    video: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + searchSuffix)}`,
    read: `https://www.google.com/search?q=${encodeURIComponent(topic + readSuffix)}`
  };
};

export const Results: React.FC<ResultsProps> = ({ questions, answers, onRestart, onRetake, onGenerateRemediation, isFullWidth, autoHideFooter = true, lang }) => {
  const [userName, setUserName] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [showWeakPoints, setShowWeakPoints] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savedQuestions, setSavedQuestions] = useState<Record<string, boolean>>({});
  const [examSaved, setExamSaved] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(true);

  // State to hold processed results and grading status
  const [finalResults, setFinalResults] = useState<any[]>([]);
  const [gradingStatus, setGradingStatus] = useState<Record<string, boolean>>({});

  // Effect for Post-Exam AI Grading
  useEffect(() => {
    // 1. Initial Processing (Standard MCQ and Tracing are graded instantly)
    const initialProcessed = questions.map(q => {
      const ua = answers.find(a => a.questionId === q.id);
      let isCorrect: boolean | undefined = undefined;
      let feedback = q.explanation;

      if (!ua) {
        return { 
          question: q, 
          isCorrect: false, 
          answer: null, 
          feedback: `${t('no_answer_provided', lang)}\n\n**${t('analysis', lang)}:**\n${q.explanation}` 
        };
      }

      if (q.type === QuestionType.MCQ) {
        if (q.options && q.options.length > 0) {
            isCorrect = ua.answer === q.correctOptionIndex;
        } else {
            // Short Answer - Handled in step 2 or using stored result
            if (ua.isCorrect !== undefined) {
                isCorrect = ua.isCorrect;
                feedback = ua.feedback || feedback;
            }
        }
      } else if (q.type === QuestionType.TRACING) {
        isCorrect = String(ua.answer).trim().toLowerCase() === String(q.tracingOutput || "").trim().toLowerCase();
      } else if (q.type === QuestionType.CODING) {
        // If it was already graded in 2-way mode, use that result
        if (ua.isCorrect !== undefined) {
          isCorrect = ua.isCorrect;
          feedback = ua.feedback || feedback;
        }
      }

      return { question: q, isCorrect, answer: ua.answer, feedback };
    });
    setFinalResults(initialProcessed);

    // 2. Identify and Grade Ungraded Questions (Coding OR Short Answer)
    const toGrade = initialProcessed.filter(p => {
        const isCoding = p.question.type === QuestionType.CODING;
        const isShortAnswer = p.question.type === QuestionType.MCQ && (!p.question.options || p.question.options.length === 0);
        
        return (isCoding || isShortAnswer) && p.answer && p.isCorrect === undefined;
    });

    if (toGrade.length > 0) {
      const newStatus: Record<string, boolean> = {};
      toGrade.forEach(item => newStatus[item.question.id] = true);
      setGradingStatus(newStatus);

      const gradePromises = toGrade.map(async item => {
        let result = { isCorrect: false, feedback: "Grading Error" };
        
        // Pass 'lang' for correct feedback language
        if (item.question.type === QuestionType.CODING) {
             result = await gradeCodingAnswer(item.question, String(item.answer), lang);
        } else {
             result = await gradeShortAnswer(item.question, String(item.answer), lang);
        }

        return {
          ...item,
          isCorrect: result.isCorrect,
          feedback: result.feedback,
        };
      });

      Promise.all(gradePromises).then(gradedItems => {
        setFinalResults(currentResults => {
          const updatedResults = [...currentResults];
          gradedItems.forEach(gradedItem => {
            const index = updatedResults.findIndex(r => r.question.id === gradedItem.question.id);
            if (index !== -1) {
              updatedResults[index] = gradedItem;
            }
          });
          return updatedResults;
        });
        setGradingStatus({}); // Clear grading status
      });
    }
  }, [questions, answers, lang]); // Added lang as dependency to refresh feedback language

  useEffect(() => {
    if (!autoHideFooter) { setIsFooterVisible(true); return; }
    const timer = setTimeout(() => { setIsFooterVisible(false); }, 2000);
    return () => clearTimeout(timer);
  }, [autoHideFooter]);

  const handleMouseEnterFooter = () => { if (autoHideFooter) setIsFooterVisible(true); };
  const handleMouseLeaveFooter = () => { if (autoHideFooter) setIsFooterVisible(false); };
  
  // Calculate score based on finalResults
  const correctCount = finalResults.filter(r => r.isCorrect).length;
  const wrongIds = finalResults.filter(r => !r.isCorrect).map(r => r.question.id);
  const wrongTopics: Record<string, number> = finalResults
    .filter(r => !r.isCorrect)
    .reduce((acc, r) => {
        const topic = r.question.topic || 'General';
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
    }, {});

  const score = finalResults.length > 0 ? Math.round((correctCount / finalResults.length) * 100) : 0;
  const getLetterGrade = (s: number) => s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F';
  const grade = getLetterGrade(score);
  const isFailure = grade === 'F';
  const isPerfect = score === 100;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const validation = sanitizeInput(val, 20);
      if (!validation.isValid) { setNameError(validation.error || "Invalid characters"); return; }
      setNameError(null); setUserName(validation.sanitizedValue);
  };

  const handlePublish = () => {
    if (!userName.trim() || nameError) return;
    const entry: LeaderboardEntry = { name: userName.trim(), score, date: new Date().toISOString(), isElite: isPerfect };
    const stored = localStorage.getItem('exam_leaderboard');
    let scores: LeaderboardEntry[] = stored ? JSON.parse(stored) : [];
    scores.push(entry);
    localStorage.setItem('exam_leaderboard', JSON.stringify(scores));
    setIsPublished(true);
  };

  const handleDownloadPDF = () => { generateExamPDF(questions, score, grade, userName); };
  
  const handleSaveExam = () => {
      saveFullExam(questions);
      setExamSaved(true);
      setTimeout(() => setExamSaved(false), 3000);
  };

  const toggleSave = (q: Question) => {
      const currentlySaved = isQuestionSaved(q.id);
      if (currentlySaved) {
          removeQuestion(q.id);
      } else {
          saveQuestion(q);
      }
      setSavedQuestions(prev => ({...prev, [q.id]: !currentlySaved}));
  };

  return (
    <div className={`pb-28 transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-4xl mx-auto'}`}>
      
      {isFailure && (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-20 dark:opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-red-500/20 animate-pulse"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600 font-black text-[6rem] md:text-[20rem] -rotate-12 select-none opacity-10 whitespace-nowrap">FAILED</div>
          </div>
      )}

      <div className="text-center mb-8 md:mb-12 border-b border-gray-300 dark:border-terminal-dimGreen pb-8 relative z-10">
        
        {isFailure ? (
             <div className="bg-terminal-alert text-white py-2 font-bold tracking-[0.2em] md:tracking-[0.5em] uppercase mb-8 animate-pulse text-sm md:text-base">⚠ {t('critical_failure', lang)} ⚠</div>
        ) : isPerfect ? (
             <div className="bg-yellow-500 text-black py-2 font-bold tracking-[0.2em] md:tracking-[0.5em] uppercase mb-8 animate-pulse text-sm md:text-base">★ {t('perfection', lang)} ★</div>
        ) : (
            <h2 className="text-2xl md:text-4xl font-bold mb-6 text-gray-800 dark:text-terminal-light">{t('assessment_complete', lang)}</h2>
        )}

        <div className="flex items-center justify-center gap-6 mb-6 relative">
            <div className="text-center">
                <div className={`text-5xl md:text-6xl font-mono mb-1 ${isFailure ? 'animate-bounce text-terminal-alert' : score >= 70 ? "text-terminal-green" : "text-terminal-alert"}`}>{score}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('final_score', lang)}</div>
            </div>
            <div className="h-12 md:h-16 w-px bg-gray-300 dark:bg-gray-700"></div>
            <div className="text-center relative">
                <div className={`text-5xl md:text-6xl font-mono font-bold mb-1 ${isFailure ? 'text-terminal-alert' : 'text-blue-500 dark:text-terminal-light'}`}>{grade}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('grade', lang)}</div>
            </div>
        </div>

        <div className="md:hidden mb-6 flex flex-col items-center gap-3 w-full px-4">
             {!isPublished && !isFailure && (
                 <div className="flex gap-2 w-full max-w-sm">
                    <input type="text" placeholder={t('agent_name', lang)} value={userName} onChange={handleNameChange} maxLength={20} className="bg-gray-100 dark:bg-terminal-black border border-gray-400 dark:border-terminal-gray p-3 text-sm font-mono outline-none focus:border-terminal-green flex-grow rounded-sm dark:text-terminal-green"/>
                    <button onClick={handlePublish} disabled={!userName || !!nameError} className="px-4 py-2 bg-terminal-green text-terminal-black font-bold hover:bg-terminal-dimGreen disabled:opacity-50 transition-colors text-xs rounded-sm">{t('publish', lang)}</button>
                </div>
             )}
             <button onClick={handleSaveExam} className="w-full max-w-sm px-4 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 font-bold transition-colors text-xs uppercase tracking-wider">{examSaved ? `✓ ${t('saved', lang)}` : t('save_full_exam', lang)}</button>
        </div>
        
        {wrongIds.length > 0 && (
            <button onClick={() => setShowWeakPoints(!showWeakPoints)} className="text-xs font-bold uppercase tracking-widest underline text-blue-500 dark:text-terminal-green hover:text-blue-400 p-2">{showWeakPoints ? t('hide_analysis', lang) : t('view_weak_points', lang)}</button>
        )}
        
        {showWeakPoints && wrongIds.length > 0 && (
            <div className="mt-8 max-w-3xl mx-auto animate-fade-in">
                <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="text-terminal-alert text-xl">⚠</span>
                    <h4 className="font-bold text-gray-800 dark:text-terminal-light text-sm uppercase tracking-wider text-center">{t('areas_improvement', lang)}</h4>
                    <span className="text-terminal-alert text-xl">⚠</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(wrongTopics).map(([topic, count]) => {
                        const resources = getTopicResources(topic);
                        return (
                            <div key={topic} className="bg-white dark:bg-terminal-black p-4 rounded border border-l-4 border-gray-200 dark:border-terminal-gray border-l-terminal-alert shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <svg className="w-16 h-16 text-terminal-alert" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" /></svg>
                                </div>
                                
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-3">
                                        <h5 className="font-bold text-lg dark:text-terminal-light capitalize">{topic}</h5>
                                        <span className="bg-red-100 dark:bg-terminal-alert text-red-800 dark:text-white text-xs font-bold px-2 py-1 rounded">
                                            {count} {t('failed', lang)}
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-2 mt-4">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Recommended Training:</p>
                                        <div className="flex gap-2">
                                            <a 
                                                href={resources.video} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                                                <span>{lang === 'ar' ? 'شاهد الشرح' : 'WATCH TUTORIAL'}</span>
                                            </a>
                                            <a 
                                                href={resources.read} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-terminal-green dark:text-black dark:hover:bg-terminal-dimGreen text-white text-xs font-bold rounded transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                                <span>{lang === 'ar' ? 'اقرأ الدليل' : 'READ GUIDE'}</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      <div className="space-y-8 mb-12 relative z-10">
        {finalResults.map((item, idx) => {
          const hasCodeBlockInText = item.question.text.includes('```');
          let displayText = item.question.text;
          if (item.question.codeSnippet && !hasCodeBlockInText && displayText.includes(item.question.codeSnippet)) {
              displayText = displayText.replace(item.question.codeSnippet, '').trim();
          }

          return (
            <div key={item.question.id} className={`p-4 md:p-6 border-l-4 rtl:border-l-0 rtl:border-r-4 ${gradingStatus[item.question.id] ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' : item.isCorrect ? 'border-terminal-green bg-green-50 dark:bg-terminal-green/5' : 'border-terminal-alert bg-red-50 dark:bg-terminal-alert/10'} bg-white dark:bg-terminal-black shadow-md rounded-r-lg rtl:rounded-r-none rtl:rounded-l-lg relative`}>
                <button onClick={() => toggleSave(item.question)} className={`absolute top-2 right-2 md:top-4 md:right-4 rtl:right-auto rtl:left-4 p-2 transition-colors hover:scale-110 ${isQuestionSaved(item.question.id) ? 'text-terminal-alert' : 'text-gray-300 dark:text-terminal-gray hover:text-terminal-alert'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                </button>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-terminal-gray pr-8 rtl:pr-0 rtl:pl-8">
                    <h3 className="font-bold text-lg dark:text-terminal-light">{t('question', lang)} {idx + 1}</h3>
                    {gradingStatus[item.question.id] ? (
                         <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-500 dark:text-black animate-pulse">GRADING...</span>
                    ) : (
                         <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.isCorrect ? 'bg-green-100 text-green-800 dark:bg-terminal-green dark:text-black' : 'bg-red-100 text-red-800 dark:bg-terminal-alert dark:text-white'}`}>{item.isCorrect ? t('passed', lang) : t('failed', lang)}</span>
                    )}
                </div>
                <div className="mb-6 text-base md:text-lg font-medium text-gray-800 dark:text-terminal-light"><MarkdownRenderer content={displayText} /></div>
                
                {/* Graph Renderer for Results */}
                {item.question.graphConfig && (
                    <div className="mb-6">
                         <div className="text-xs font-bold text-gray-500 dark:text-terminal-green mb-2 uppercase tracking-wide">Graph Data:</div>
                         <GraphRenderer config={item.question.graphConfig} />
                    </div>
                )}

                {!item.question.graphConfig && item.question.visual && (
                    <div className="mb-6">
                        <img 
                            src={`data:image/png;base64,${item.question.visual}`} 
                            alt="Visual" 
                            className="max-h-40 rounded border border-gray-300 dark:border-terminal-gray" 
                        />
                    </div>
                )}

                {item.question.codeSnippet && !hasCodeBlockInText && (
                    <div dir="ltr" className="mb-6 text-left">
                        <CodeWindow code={item.question.codeSnippet} />
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="bg-gray-100 dark:bg-[#0c0c0c] p-4 rounded border border-gray-200 dark:border-terminal-gray">
                        <span className="block text-xs opacity-50 font-bold mb-2 uppercase tracking-wider dark:text-terminal-green">{t('your_input', lang)}</span>
                        <div className="font-mono break-words whitespace-pre-wrap text-gray-700 dark:text-terminal-light">
                             {item.question.type === QuestionType.MCQ ? (item.question.options && item.question.options.length > 0 && item.answer !== null ? <MarkdownRenderer content={item.question.options[item.answer as number]} /> : String(item.answer || 'No Answer')) : String(item.answer || 'No Answer')}
                        </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-[#0c0c0c] p-4 rounded border border-blue-100 dark:border-terminal-gray">
                        <span className="block text-xs opacity-50 font-bold mb-2 uppercase tracking-wider text-blue-800 dark:text-terminal-green">{t('analysis', lang)}</span>
                        {gradingStatus[item.question.id] ? (
                            <div className="animate-pulse text-gray-500">AI analysis in progress...</div>
                        ) : (
                            <MarkdownRenderer content={item.feedback} />
                        )}
                    </div>
                </div>
            </div>
          )
        })}
      </div>

      {autoHideFooter && <div className="hidden md:block fixed bottom-0 left-0 w-full h-6 z-40 bg-transparent cursor-crosshair" onMouseEnter={handleMouseEnterFooter} />}
      
      <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-terminal-black border-t border-gray-300 dark:border-terminal-green gap-4 justify-center items-center shadow-[0_-5px_20px_rgba(0,0,0,0.2)] z-50 transition-transform duration-500 ease-in-out hidden md:flex xl:flex-row ${autoHideFooter ? (isFooterVisible ? 'md:translate-y-0' : 'md:translate-y-full') : ''}`} onMouseLeave={handleMouseLeaveFooter} onMouseEnter={handleMouseEnterFooter}>
        {!isPublished ? (
            isFailure ? <div className="text-terminal-alert font-bold border border-terminal-alert p-3 bg-red-50 dark:bg-terminal-alert/20 text-center w-full xl:w-auto text-sm tracking-widest">✖ {t('system_locked', lang)}</div> :
             <div className="flex gap-2 w-full xl:w-auto">
                <input type="text" placeholder={t('enter_agent_name', lang)} value={userName} onChange={handleNameChange} maxLength={20} className="bg-gray-100 dark:bg-terminal-black border border-gray-400 dark:border-terminal-gray p-2 font-mono outline-none focus:border-terminal-green flex-grow xl:w-48 dark:text-terminal-green"/>
                <button onClick={handlePublish} disabled={!userName || !!nameError} className="px-4 py-2 bg-terminal-green text-terminal-black font-bold hover:bg-terminal-dimGreen disabled:opacity-50 transition-colors">{t('publish', lang)}</button>
             </div>
        ) : <div className="text-terminal-green font-bold px-4 py-2 border border-terminal-green bg-green-50 dark:bg-terminal-green/20 rounded w-full xl:w-auto text-center">✓ {t('published', lang)}: {userName}</div>}

        <div className="flex gap-2 w-full xl:w-auto justify-center">
            <button onClick={handleSaveExam} className="px-4 py-2 border border-purple-400 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-bold transition-colors">{examSaved ? `✓ ${t('saved', lang)}` : `💾 ${t('save', lang)}`}</button>
            <button onClick={handleDownloadPDF} className="px-4 py-2 border border-orange-400 dark:border-orange-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 font-bold transition-colors">{t('pdf_report', lang)}</button>
            <button onClick={onRetake} className="px-4 py-2 border border-blue-400 dark:border-terminal-green text-blue-600 dark:text-terminal-green hover:bg-blue-50 dark:hover:bg-terminal-green/20 font-bold transition-colors">{t('retake', lang)}</button>
            <button onClick={onRestart} className="px-4 py-2 border border-gray-400 dark:border-terminal-gray hover:bg-gray-200 dark:hover:bg-terminal-gray/50 font-bold transition-colors dark:text-terminal-light">{t('restart', lang)}</button>
            {wrongIds.length > 0 && <button onClick={() => onGenerateRemediation(wrongIds)} className="px-6 py-2 bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-lg transition-all">{t('remediate', lang)} ({wrongIds.length})</button>}
        </div>
      </div>
    </div>
  );
};