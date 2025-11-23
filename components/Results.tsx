import React, { useState, useEffect } from 'react';
import { Question, UserAnswer, QuestionType, LeaderboardEntry } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeWindow } from './CodeWindow';
import { generateExamPDF } from '../utils/pdfGenerator';
import { saveQuestion, removeQuestion, isQuestionSaved, saveFullExam } from '../services/library';
import { sanitizeInput } from '../utils/security';

interface ResultsProps {
  questions: Question[];
  answers: UserAnswer[];
  onRestart: () => void;
  onRetake: () => void;
  onGenerateRemediation: (wrongIds: string[]) => void;
  isFullWidth: boolean;
  autoHideFooter?: boolean;
}

const getTopicResources = (topicRaw: string) => {
  const topic = topicRaw.toLowerCase().trim();
  const RESOURCES: Record<string, { video: string, read: string }> = {
    'pointers': { video: 'https://www.youtube.com/watch?v=DTxHyVn0ODg', read: 'https://www.geeksforgeeks.org/pointers-in-c-cpp/' },
    'recursion': { video: 'https://www.youtube.com/watch?v=IJDJ0kBx2LM', read: 'https://www.freecodecamp.org/news/recursion-in-programming-explained/' },
  };
  return {
    video: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " programming tutorial")}`,
    read: `https://www.google.com/search?q=${encodeURIComponent(topic + " programming guide")}`
  };
};

export const Results: React.FC<ResultsProps> = ({ questions, answers, onRestart, onRetake, onGenerateRemediation, isFullWidth, autoHideFooter = true }) => {
  const [userName, setUserName] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [showWeakPoints, setShowWeakPoints] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savedQuestions, setSavedQuestions] = useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      questions.forEach(q => { initial[q.id] = isQuestionSaved(q.id); });
      return initial;
  });
  
  const [examSaved, setExamSaved] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(true);

  useEffect(() => {
    if (!autoHideFooter) { setIsFooterVisible(true); return; }
    const timer = setTimeout(() => { setIsFooterVisible(false); }, 2000);
    return () => clearTimeout(timer);
  }, [autoHideFooter]);

  const handleMouseEnterFooter = () => { if (autoHideFooter) setIsFooterVisible(true); };
  const handleMouseLeaveFooter = () => { if (autoHideFooter) setIsFooterVisible(false); };
  
  let correctCount = 0;
  const wrongIds: string[] = [];
  const wrongTopics: Record<string, number> = {};

  const processedAnswers = questions.map(q => {
    const ua = answers.find(a => a.questionId === q.id);
    let isCorrect = false;
    let feedback = q.explanation;

    if (!ua) {
        wrongIds.push(q.id);
        const topic = q.topic || 'General';
        wrongTopics[topic] = (wrongTopics[topic] || 0) + 1;
        return { question: q, isCorrect: false, answer: null, feedback: "No answer provided.\n\n**Analysis:**\n" + q.explanation };
    }

    if (q.type === QuestionType.MCQ) {
        isCorrect = ua.answer === q.correctOptionIndex;
    } else if (q.type === QuestionType.TRACING) {
        isCorrect = String(ua.answer).trim().toLowerCase() === String(q.tracingOutput || "").trim().toLowerCase();
    } else if (q.type === QuestionType.CODING) {
        if (ua.isCorrect !== undefined) isCorrect = ua.isCorrect;
        if (ua.feedback) feedback = ua.feedback;
    }

    if (isCorrect) correctCount++;
    else {
        wrongIds.push(q.id);
        const topic = q.topic || 'General';
        wrongTopics[topic] = (wrongTopics[topic] || 0) + 1;
    }

    return { question: q, isCorrect, answer: ua.answer, feedback };
  });

  const score = Math.round((correctCount / questions.length) * 100);
  const getLetterGrade = (score: number) => {
    if (score >= 90) return 'A'; if (score >= 80) return 'B'; if (score >= 70) return 'C'; if (score >= 60) return 'D'; return 'F';
  };
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
    const entry: LeaderboardEntry = { name: userName.trim(), score: score, date: new Date().toISOString(), isElite: isPerfect };
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
      if (savedQuestions[q.id]) {
          removeQuestion(q.id);
          setSavedQuestions(prev => ({...prev, [q.id]: false}));
      } else {
          saveQuestion(q);
          setSavedQuestions(prev => ({...prev, [q.id]: true}));
      }
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
             <div className="bg-terminal-alert text-white py-2 font-bold tracking-[0.2em] md:tracking-[0.5em] uppercase mb-8 animate-pulse text-sm md:text-base">⚠ CRITICAL SYSTEM FAILURE ⚠</div>
        ) : isPerfect ? (
             <div className="bg-yellow-500 text-black py-2 font-bold tracking-[0.2em] md:tracking-[0.5em] uppercase mb-8 animate-pulse text-sm md:text-base">★ PERFECTION ACHIEVED ★</div>
        ) : (
            <h2 className="text-2xl md:text-4xl font-bold mb-6 text-gray-800 dark:text-terminal-light">ASSESSMENT COMPLETE</h2>
        )}

        <div className="flex items-center justify-center gap-6 mb-6 relative">
            <div className="text-center">
                <div className={`text-5xl md:text-6xl font-mono mb-1 ${isFailure ? 'animate-bounce text-terminal-alert' : score >= 70 ? "text-terminal-green" : "text-terminal-alert"}`}>{score}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">FINAL SCORE</div>
            </div>
            <div className="h-12 md:h-16 w-px bg-gray-300 dark:bg-gray-700"></div>
            <div className="text-center relative">
                <div className={`text-5xl md:text-6xl font-mono font-bold mb-1 ${isFailure ? 'text-terminal-alert' : 'text-blue-500 dark:text-terminal-light'}`}>{grade}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">GRADE</div>
            </div>
        </div>

        <div className="md:hidden mb-6 flex flex-col items-center gap-3 w-full px-4">
             {!isPublished && !isFailure && (
                 <div className="flex gap-2 w-full max-w-sm">
                    <input type="text" placeholder="AGENT_NAME" value={userName} onChange={handleNameChange} maxLength={20} className="bg-gray-100 dark:bg-terminal-black border border-gray-400 dark:border-terminal-gray p-3 text-sm font-mono outline-none focus:border-terminal-green flex-grow rounded-sm dark:text-terminal-green"/>
                    <button onClick={handlePublish} disabled={!userName || !!nameError} className="px-4 py-2 bg-terminal-green text-terminal-black font-bold hover:bg-terminal-dimGreen disabled:opacity-50 transition-colors text-xs rounded-sm">SAVE</button>
                </div>
             )}
             <button onClick={handleSaveExam} className="w-full max-w-sm px-4 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 font-bold transition-colors text-xs uppercase tracking-wider">{examSaved ? '✓ EXAM SAVED' : 'SAVE FULL EXAM'}</button>
        </div>
        
        {wrongIds.length > 0 && (
            <button onClick={() => setShowWeakPoints(!showWeakPoints)} className="text-xs font-bold uppercase tracking-widest underline text-blue-500 dark:text-terminal-green hover:text-blue-400 p-2">{showWeakPoints ? 'HIDE ANALYSIS' : 'VIEW WEAK POINTS'}</button>
        )}
        
        {showWeakPoints && wrongIds.length > 0 && (
            <div className="mt-6 max-w-2xl mx-auto bg-red-50 dark:bg-terminal-alert/10 border border-red-200 dark:border-terminal-alert p-4 md:p-6 rounded animate-fade-in">
                <h4 className="font-bold text-red-600 dark:text-terminal-alert mb-4 text-sm uppercase tracking-wider text-center">Areas for Improvement</h4>
                <div className="space-y-3">
                    {Object.entries(wrongTopics).map(([topic, count]) => (
                        <div key={topic} className="flex justify-between bg-white dark:bg-terminal-black p-3 rounded border border-gray-200 dark:border-terminal-gray shadow-sm gap-2">
                            <div className="flex items-center gap-3">
                                <span className="bg-red-100 dark:bg-terminal-alert text-red-800 dark:text-black text-xs font-bold px-2 py-1 rounded-full">{count} missed</span>
                                <span className="font-mono font-bold text-sm dark:text-terminal-light">{topic}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      <div className="space-y-8 mb-12 relative z-10">
        {processedAnswers.map((item, idx) => {
          const hasCodeBlockInText = item.question.text.includes('```');
          let displayText = item.question.text;
          if (item.question.codeSnippet && !hasCodeBlockInText && displayText.includes(item.question.codeSnippet)) {
              displayText = displayText.replace(item.question.codeSnippet, '').trim();
          }

          return (
            <div key={item.question.id} className={`p-4 md:p-6 border-l-4 ${item.isCorrect ? 'border-terminal-green bg-green-50 dark:bg-terminal-green/5' : 'border-terminal-alert bg-red-50 dark:bg-terminal-alert/10'} bg-white dark:bg-terminal-black shadow-md rounded-r-lg relative`}>
                <button onClick={() => toggleSave(item.question)} className={`absolute top-2 right-2 md:top-4 md:right-4 p-2 transition-colors hover:scale-110 ${savedQuestions[item.question.id] ? 'text-terminal-alert' : 'text-gray-300 dark:text-terminal-gray hover:text-terminal-alert'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                </button>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-terminal-gray pr-8">
                    <h3 className="font-bold text-lg dark:text-terminal-light">Question {idx + 1}</h3>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.isCorrect ? 'bg-green-100 text-green-800 dark:bg-terminal-green dark:text-black' : 'bg-red-100 text-red-800 dark:bg-terminal-alert dark:text-white'}`}>{item.isCorrect ? 'PASSED' : 'FAILED'}</span>
                </div>
                <div className="mb-6 text-base md:text-lg font-medium text-gray-800 dark:text-terminal-light"><MarkdownRenderer content={displayText} /></div>
                {item.question.codeSnippet && !hasCodeBlockInText && <div className="mb-6"><CodeWindow code={item.question.codeSnippet} /></div>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="bg-gray-100 dark:bg-[#0c0c0c] p-4 rounded border border-gray-200 dark:border-terminal-gray">
                        <span className="block text-xs opacity-50 font-bold mb-2 uppercase tracking-wider dark:text-terminal-green">Your Input</span>
                        <div className="font-mono break-words whitespace-pre-wrap text-gray-700 dark:text-terminal-light">
                             {item.question.type === QuestionType.MCQ ? (item.question.options && item.answer !== null ? <MarkdownRenderer content={item.question.options[item.answer as number]} /> : 'None') : String(item.answer || 'No Answer')}
                        </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-[#0c0c0c] p-4 rounded border border-blue-100 dark:border-terminal-gray">
                        <span className="block text-xs opacity-50 font-bold mb-2 uppercase tracking-wider text-blue-800 dark:text-terminal-green">Analysis</span>
                        <MarkdownRenderer content={item.feedback} />
                    </div>
                </div>
            </div>
          )
        })}
      </div>

      {autoHideFooter && <div className="hidden md:block fixed bottom-0 left-0 w-full h-6 z-40 bg-transparent cursor-crosshair" onMouseEnter={handleMouseEnterFooter} />}
      
      <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-terminal-black border-t border-gray-300 dark:border-terminal-green gap-4 justify-center items-center shadow-[0_-5px_20px_rgba(0,0,0,0.2)] z-50 transition-transform duration-500 ease-in-out hidden md:flex xl:flex-row ${autoHideFooter ? (isFooterVisible ? 'md:translate-y-0' : 'md:translate-y-full') : ''}`} onMouseLeave={handleMouseLeaveFooter} onMouseEnter={handleMouseEnterFooter}>
        {!isPublished ? (
            isFailure ? <div className="text-terminal-alert font-bold border border-terminal-alert p-3 bg-red-50 dark:bg-terminal-alert/20 text-center w-full xl:w-auto text-sm tracking-widest">✖ SYSTEM LOCKED: PUBLISHING DISABLED</div> :
             <div className="flex gap-2 w-full xl:w-auto">
                <input type="text" placeholder="ENTER_AGENT_NAME" value={userName} onChange={handleNameChange} maxLength={20} className="bg-gray-100 dark:bg-terminal-black border border-gray-400 dark:border-terminal-gray p-2 font-mono outline-none focus:border-terminal-green flex-grow xl:w-48 dark:text-terminal-green"/>
                <button onClick={handlePublish} disabled={!userName || !!nameError} className="px-4 py-2 bg-terminal-green text-terminal-black font-bold hover:bg-terminal-dimGreen disabled:opacity-50 transition-colors">PUBLISH</button>
             </div>
        ) : <div className="text-terminal-green font-bold px-4 py-2 border border-terminal-green bg-green-50 dark:bg-terminal-green/20 rounded w-full xl:w-auto text-center">✓ PUBLISHED: {userName}</div>}

        <div className="flex gap-2 w-full xl:w-auto justify-center">
            <button onClick={handleSaveExam} className="px-4 py-2 border border-purple-400 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-bold transition-colors">{examSaved ? '✓ SAVED' : '💾 SAVE EXAM'}</button>
            <button onClick={handleDownloadPDF} className="px-4 py-2 border border-orange-400 dark:border-orange-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 font-bold transition-colors">PDF REPORT</button>
            <button onClick={onRetake} className="px-4 py-2 border border-blue-400 dark:border-terminal-green text-blue-600 dark:text-terminal-green hover:bg-blue-50 dark:hover:bg-terminal-green/20 font-bold transition-colors">RETAKE</button>
            <button onClick={onRestart} className="px-4 py-2 border border-gray-400 dark:border-terminal-gray hover:bg-gray-200 dark:hover:bg-terminal-gray/50 font-bold transition-colors dark:text-terminal-light">RESTART</button>
            {wrongIds.length > 0 && <button onClick={() => onGenerateRemediation(wrongIds)} className="px-6 py-2 bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-lg transition-all">REMEDIATE ({wrongIds.length})</button>}
        </div>
      </div>
    </div>
  );
};