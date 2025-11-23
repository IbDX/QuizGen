

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

// --- RESOURCE MAPPING HELPER ---
const getTopicResources = (topicRaw: string) => {
  const topic = topicRaw.toLowerCase().trim();
  
  // Curated list of high-quality resources for common CS concepts
  const RESOURCES: Record<string, { video: string, read: string }> = {
    'pointers': {
      video: 'https://www.youtube.com/watch?v=DTxHyVn0ODg', // The Cherno (C++ Pointers)
      read: 'https://www.geeksforgeeks.org/pointers-in-c-cpp/'
    },
    'recursion': {
      video: 'https://www.youtube.com/watch?v=IJDJ0kBx2LM', // Computerphile
      read: 'https://www.freecodecamp.org/news/recursion-in-programming-explained/'
    },
    'arrays': {
      video: 'https://www.youtube.com/watch?v=1ivjaVE_M0Q',
      read: 'https://www.w3schools.com/cpp/cpp_arrays.asp'
    },
    'loops': {
      video: 'https://www.youtube.com/watch?v=s9y2a1t9a10',
      read: 'https://www.programiz.com/cpp-programming/for-loop'
    },
    'object oriented programming': {
      video: 'https://www.youtube.com/watch?v=pTB0EiLXUC8', // Mosh
      read: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/Object-oriented_programming'
    },
    'oop': {
      video: 'https://www.youtube.com/watch?v=pTB0EiLXUC8',
      read: 'https://www.geeksforgeeks.org/object-oriented-programming-in-cpp/'
    },
    'dynamic memory': {
      video: 'https://www.youtube.com/watch?v=_8-ht2AKyH4',
      read: 'https://learn.microsoft.com/en-us/cpp/cpp/memory-management-in-cpp'
    },
    'time complexity': {
      video: 'https://www.youtube.com/watch?v=D6xkbGLQesk',
      read: 'https://www.bigocheatsheet.com/'
    },
    'big o': {
      video: 'https://www.youtube.com/watch?v=D6xkbGLQesk',
      read: 'https://www.bigocheatsheet.com/'
    }
  };

  // Check for exact match or partial match
  for (const key in RESOURCES) {
    if (topic.includes(key)) {
      return RESOURCES[key];
    }
  }

  // Fallback: Generate Smart Search URLs
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

  // Footer Visibility State
  const [isFooterVisible, setIsFooterVisible] = useState(true);

  // Footer Auto-Hide Logic
  useEffect(() => {
    if (!autoHideFooter) {
        setIsFooterVisible(true);
        return;
    }

    const timer = setTimeout(() => {
        setIsFooterVisible(false);
    }, 2000); // Hide after 2 seconds of inactivity
    return () => clearTimeout(timer);
  }, [autoHideFooter]);

  const handleMouseEnterFooter = () => {
    if (autoHideFooter) setIsFooterVisible(true);
  };

  const handleMouseLeaveFooter = () => {
    if (autoHideFooter) {
        setIsFooterVisible(false);
    }
  };
  
  // Helper to calculate score
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
        // Include explanation even if no answer
        return { question: q, isCorrect: false, answer: null, feedback: "No answer provided.\n\n**Analysis:**\n" + q.explanation };
    }

    if (q.type === QuestionType.MCQ) {
        isCorrect = ua.answer === q.correctOptionIndex;
    } else if (q.type === QuestionType.TRACING) {
        isCorrect = String(ua.answer).trim().toLowerCase() === String(q.tracingOutput || "").trim().toLowerCase();
    } else if (q.type === QuestionType.CODING) {
        if (ua.isCorrect !== undefined) {
            isCorrect = ua.isCorrect;
            feedback = ua.feedback || feedback;
        } else {
            isCorrect = false; 
            feedback = "Pending AI Grading or manual review. \n\n" + q.explanation;
        }
    }

    if (isCorrect) {
        correctCount++;
    } else {
        wrongIds.push(q.id);
        const topic = q.topic || 'General';
        wrongTopics[topic] = (wrongTopics[topic] || 0) + 1;
    }

    return { question: q, isCorrect, answer: ua.answer, feedback };
  });

  const score = Math.round((correctCount / questions.length) * 100);

  const getLetterGrade = (score: number) => {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 60) return 'D';
    return 'F';
  };

  const grade = getLetterGrade(score);
  const isFailure = grade === 'F';
  const isPerfect = score === 100;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const validation = sanitizeInput(val, 20); // Max 20 chars for name
      
      if (!validation.isValid) {
          setNameError(validation.error || "Invalid characters");
          return;
      }
      setNameError(null);
      setUserName(validation.sanitizedValue);
  };

  const handlePublish = () => {
    if (!userName.trim() || nameError) return;
    
    // Save to Leaderboard
    const entry: LeaderboardEntry = {
        name: userName.trim(),
        score: score,
        date: new Date().toISOString(),
        isElite: isPerfect // Save Z+ Badge status
    };

    const stored = localStorage.getItem('exam_leaderboard');
    let scores: LeaderboardEntry[] = stored ? JSON.parse(stored) : [];
    scores.push(entry);
    localStorage.setItem('exam_leaderboard', JSON.stringify(scores));

    setIsPublished(true);
  };

  const handleDownloadPDF = () => {
      generateExamPDF(questions, score, grade, userName);
  };
  
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
      
      {/* FAILURE ANIMATION OVERLAY */}
      {isFailure && (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-20 dark:opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-red-500/20 animate-pulse"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600 font-black text-[6rem] md:text-[20rem] -rotate-12 select-none opacity-10 whitespace-nowrap">
                  FAILED
              </div>
          </div>
      )}

      <div className="text-center mb-8 md:mb-12 border-b border-gray-300 dark:border-gray-800 pb-8 relative z-10">
        
        {/* Header Banner */}
        {isFailure ? (
             <div className="bg-red-600 text-white py-2 font-bold tracking-[0.2em] md:tracking-[0.5em] uppercase mb-8 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.6)] text-sm md:text-base">
                 ⚠ CRITICAL SYSTEM FAILURE ⚠
             </div>
        ) : isPerfect ? (
             <div className="bg-yellow-500 text-black py-2 font-bold tracking-[0.2em] md:tracking-[0.5em] uppercase mb-8 shadow-[0_0_20px_rgba(234,179,8,0.6)] animate-pulse text-sm md:text-base">
                 ★ PERFECTION ACHIEVED ★
             </div>
        ) : (
            <h2 className="text-2xl md:text-4xl font-bold mb-6">ASSESSMENT COMPLETE</h2>
        )}

        <div className="flex items-center justify-center gap-6 mb-6 relative">
            <div className="text-center">
                <div className={`text-5xl md:text-6xl font-mono mb-1 ${isFailure ? 'animate-bounce text-red-600' : score >= 70 ? "text-green-500" : "text-red-500"}`}>
                    {score}%
                </div>
                <div className="text-sm text-gray-500">FINAL SCORE</div>
            </div>
            <div className="h-12 md:h-16 w-px bg-gray-300 dark:bg-gray-700"></div>
            <div className="text-center relative">
                <div className={`text-5xl md:text-6xl font-mono font-bold mb-1 ${['A+','A','A-','B+','B'].includes(grade) ? 'text-blue-500' : ['C+','C','C-'].includes(grade) ? 'text-yellow-500' : 'text-red-600'}`}>
                    {grade}
                </div>
                <div className="text-sm text-gray-500">GRADE</div>
                
                {/* Z+ ELITE BADGE FOR FULL MARKS */}
                {isPerfect && (
                    <div className="absolute -top-6 -right-16 md:-right-24 rotate-12 animate-fade-in">
                        <div className="relative flex items-center justify-center w-16 h-16 bg-black border-2 border-yellow-400 rounded-full shadow-[0_0_15px_rgba(250,204,21,0.8)] group overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-yellow-600/50 to-transparent animate-spin-slow"></div>
                            <span className="relative z-10 font-bold text-yellow-400 italic font-mono text-xl">Z+</span>
                            <div className="absolute bottom-1 text-[6px] text-yellow-200 uppercase tracking-widest">Elite</div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Mobile-Only Publishing Section (Since Footer is hidden on mobile) */}
        <div className="md:hidden mb-6 flex flex-col items-center gap-3 w-full px-4">
             {!isPublished && !isFailure && (
                 <div className="flex gap-2 w-full max-w-sm">
                    <input 
                        type="text" 
                        placeholder="AGENT_NAME" 
                        value={userName}
                        onChange={handleNameChange}
                        maxLength={20}
                        className={`bg-gray-100 dark:bg-gray-900 border ${nameError ? 'border-red-500' : 'border-gray-400'} p-3 text-sm font-mono outline-none focus:border-blue-500 flex-grow rounded-sm`}
                    />
                    <button 
                        onClick={handlePublish}
                        disabled={!userName || !!nameError}
                        className="px-4 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors text-xs rounded-sm"
                    >
                        SAVE
                    </button>
                </div>
             )}
             {isPublished && (
                 <div className="text-green-600 dark:text-green-400 font-bold text-xs uppercase tracking-wider">
                     ✓ Result Archived: {userName}
                 </div>
             )}
             {isFailure && (
                 <div className="text-red-500 font-bold text-xs uppercase tracking-wider">
                     Publishing Locked (Failure)
                 </div>
             )}
             
             {/* Mobile Save Exam */}
             <button
                onClick={handleSaveExam}
                className="w-full max-w-sm px-4 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-bold transition-colors text-xs uppercase tracking-wider"
             >
                {examSaved ? '✓ EXAM SAVED TO LIBRARY' : 'SAVE FULL EXAM'}
             </button>
        </div>
        
        <p className="text-gray-500 dark:text-gray-400 mb-4">
            {correctCount} / {questions.length} CORRECT
        </p>
        
        {wrongIds.length > 0 && (
            <button 
                onClick={() => setShowWeakPoints(!showWeakPoints)}
                className="text-xs font-bold uppercase tracking-widest underline text-blue-500 hover:text-blue-400 p-2"
            >
                {showWeakPoints ? 'HIDE ANALYSIS' : 'VIEW WEAK POINTS'}
            </button>
        )}
        
        {showWeakPoints && wrongIds.length > 0 && (
            <div className="mt-6 max-w-2xl mx-auto bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 p-4 md:p-6 rounded animate-fade-in">
                <h4 className="font-bold text-red-600 dark:text-red-400 mb-4 text-sm uppercase tracking-wider text-center">
                    Areas for Improvement & Resources
                </h4>
                <div className="space-y-3">
                    {Object.entries(wrongTopics).map(([topic, count]) => {
                        const resources = getTopicResources(topic);
                        return (
                            <div key={topic} className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-black p-3 rounded border border-gray-200 dark:border-gray-800 shadow-sm gap-2">
                                <div className="flex items-center gap-3">
                                    <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs font-bold px-2 py-1 rounded-full">
                                        {count} missed
                                    </span>
                                    <span className="font-mono font-bold text-sm">{topic}</span>
                                </div>
                                <div className="flex gap-2 text-xs font-bold w-full md:w-auto mt-2 md:mt-0">
                                    <a 
                                        href={resources.video} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 md:flex-none justify-center flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                        WATCH
                                    </a>
                                    <a 
                                        href={resources.read} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 md:flex-none justify-center flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                                        </svg>
                                        READ
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      <div className="space-y-8 mb-12 relative z-10">
        {processedAnswers.map((item, idx) => {
          const hasCodeBlockInText = item.question.text.includes('```');
          let displayText = item.question.text;
          // Remove duplicate code from text if it's not in a markdown block
          if (item.question.codeSnippet && !hasCodeBlockInText && displayText.includes(item.question.codeSnippet)) {
              displayText = displayText.replace(item.question.codeSnippet, '').trim();
          }

          return (
            <div key={item.question.id} className={`p-4 md:p-6 border-l-4 ${item.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10'} bg-white dark:bg-gray-900 shadow-md rounded-r-lg relative`}>
                <button 
                    onClick={() => toggleSave(item.question)}
                    className={`absolute top-2 right-2 md:top-4 md:right-4 p-2 transition-colors hover:scale-110 ${savedQuestions[item.question.id] ? 'text-red-500' : 'text-gray-300 dark:text-gray-700 hover:text-red-400'}`}
                    title={savedQuestions[item.question.id] ? "Remove from Library" : "Save to Library"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                </button>

                <div className="flex justify-between items-start md:items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-800 pr-8">
                <div className="flex flex-col">
                    <h3 className="font-bold text-lg">Question {idx + 1}</h3>
                    <span className="text-xs opacity-50 uppercase text-gray-500">{item.question.type} • {item.question.topic}</span>
                </div>
                <span className={`text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 rounded-full ${item.isCorrect ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                    {item.isCorrect ? 'PASSED' : 'FAILED'}
                </span>
                </div>
                
                <div className="mb-6 text-base md:text-lg font-medium text-gray-800 dark:text-gray-200">
                    <MarkdownRenderer content={displayText} />
                </div>

                {/* RENDER CODE SNIPPET ONLY IF NOT ALREADY IN TEXT */}
                {item.question.codeSnippet && !hasCodeBlockInText && (
                    <div className="mb-6">
                        <CodeWindow code={item.question.codeSnippet} />
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="bg-gray-100 dark:bg-black p-4 rounded border border-gray-200 dark:border-gray-800 overflow-hidden">
                        <span className="block text-xs opacity-50 font-bold mb-2 uppercase tracking-wider">Your Input</span>
                        {item.question.type === QuestionType.CODING ? (
                             <div className="mt-2">
                                 {/* Strip markdown block symbols if user typed them, to avoid double-rendering or raw backticks in prism */}
                                 <CodeWindow code={String(item.answer || '').replace(/^```[a-z]*\n?|```$/g, '')} title="User Submission" />
                             </div>
                        ) : (
                            <div className="font-mono break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                {item.question.type === QuestionType.MCQ 
                                    ? (item.question.options && item.answer !== null ? 
                                        <MarkdownRenderer content={item.question.options[item.answer as number]} /> : 'None')
                                    : String(item.answer || 'No Answer')
                                }
                            </div>
                        )}
                    </div>
                    <div className="bg-blue-50 dark:bg-[#0c0c0c] p-4 rounded border border-blue-100 dark:border-gray-800 overflow-hidden">
                        <span className="block text-xs opacity-50 font-bold mb-2 uppercase tracking-wider text-blue-800 dark:text-blue-400">Analysis / Solution</span>
                        <MarkdownRenderer content={item.feedback} />
                    </div>
                </div>
            </div>
          )
        })}
      </div>

      {/* Sensor Strip - Invisible area at bottom to trigger footer when hidden - DESKTOP ONLY */}
      {autoHideFooter && (
          <div 
            className="hidden md:block fixed bottom-0 left-0 w-full h-6 z-40 bg-transparent cursor-crosshair"
            onMouseEnter={handleMouseEnterFooter}
          />
      )}
      
      {/* Visual Cue for Hidden Footer - DESKTOP ONLY */}
      {autoHideFooter && (
        <div 
            className={`hidden md:flex fixed bottom-0 left-1/2 -translate-x-1/2 z-40 transition-all duration-700 ease-in-out pointer-events-none flex-col items-center ${isFooterVisible ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}
        >
            <div className="text-[8px] font-bold text-gray-400 dark:text-terminal-green/50 mb-0.5 tracking-[0.2em] uppercase opacity-70">
               ACTIONS
            </div>
            <div className="w-32 h-1.5 bg-gray-400/50 dark:bg-terminal-green/30 rounded-t-full shadow-[0_0_10px_rgba(0,255,65,0.2)] backdrop-blur-sm animate-pulse"></div>
        </div>
      )}

      <div 
        className={`
            fixed bottom-0 left-0 right-0 
            p-4 bg-white dark:bg-black border-t border-gray-300 dark:border-terminal-green 
            gap-4 justify-center items-center 
            shadow-[0_-5px_20px_rgba(0,0,0,0.2)] z-50 
            transition-transform duration-500 ease-in-out
            translate-y-0
            hidden md:flex xl:flex-row
            ${autoHideFooter ? (isFooterVisible ? 'md:translate-y-0' : 'md:translate-y-full') : ''}
        `}
        onMouseLeave={handleMouseLeaveFooter}
        onMouseEnter={handleMouseEnterFooter}
      >
        
        {!isPublished ? (
            isFailure ? (
               <div className="text-red-500 font-bold border border-red-500 p-3 bg-red-50 dark:bg-red-900/20 text-center w-full xl:w-auto text-sm tracking-widest">
                   ✖ SYSTEM LOCKED: PUBLISHING DISABLED DUE TO FAILURE
               </div>
            ) : (
             <div className="flex flex-col w-full xl:w-auto">
                <div className="flex gap-2 w-full xl:w-auto">
                    <input 
                        type="text" 
                        placeholder="ENTER_AGENT_NAME" 
                        value={userName}
                        onChange={handleNameChange}
                        maxLength={20}
                        className={`bg-gray-100 dark:bg-gray-900 border ${nameError ? 'border-red-500' : 'border-gray-400'} p-3 md:p-2 font-mono outline-none focus:border-blue-500 flex-grow xl:w-48`}
                    />
                    <button 
                        onClick={handlePublish}
                        disabled={!userName || !!nameError}
                        className="px-4 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        PUBLISH
                    </button>
                </div>
                {nameError && <span className="text-[10px] text-red-500 mt-1 font-bold">{nameError}</span>}
             </div>
            )
        ) : (
            <div className="text-green-600 dark:text-green-400 font-bold px-4 py-2 border border-green-500 bg-green-50 dark:bg-green-900/20 rounded w-full xl:w-auto text-center">
                ✓ PUBLISHED: {userName}
            </div>
        )}

        <div className="flex flex-col md:flex-row flex-wrap gap-2 w-full xl:w-auto justify-center">
            
            {/* SAVE FULL EXAM BUTTON */}
            <button 
                onClick={handleSaveExam}
                className={`px-4 py-4 md:py-2 border font-bold transition-all flex items-center justify-center gap-2 w-full md:w-auto
                    ${examSaved 
                        ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                        : 'border-purple-400 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                    }
                `}
            >
                {examSaved ? (
                    <><span>✓</span> EXAM SAVED</>
                ) : (
                    <><span>💾</span> SAVE FULL EXAM</>
                )}
            </button>

            <button 
                onClick={handleDownloadPDF}
                className="px-4 py-4 md:py-2 border border-orange-400 dark:border-orange-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 font-bold transition-colors flex items-center justify-center gap-2 w-full md:w-auto"
            >
                <span>PDF REPORT</span>
            </button>

            <button 
                onClick={onRetake}
                className="px-4 py-4 md:py-2 border border-blue-400 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold transition-colors w-full md:w-auto"
            >
                RETAKE EXAM
            </button>

            <button 
                onClick={onRestart}
                className="px-4 py-4 md:py-2 border border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-800 font-bold transition-colors w-full md:w-auto"
            >
                RESTART SYSTEM
            </button>
            
            {wrongIds.length > 0 && (
                <button 
                    onClick={() => onGenerateRemediation(wrongIds)}
                    className="px-6 py-4 md:py-2 bg-purple-600 text-white font-bold hover:bg-purple-700 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 transition-all hover:-translate-y-0.5 w-full md:w-auto"
                >
                    <span>REMEDIATE WEAKNESS</span>
                    <span className="bg-white text-purple-600 text-xs font-bold px-1.5 py-0.5 rounded-full">{wrongIds.length}</span>
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
