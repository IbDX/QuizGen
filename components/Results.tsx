
import React, { useState } from 'react';
import { Question, UserAnswer, QuestionType, LeaderboardEntry } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeWindow } from './CodeWindow';
import { generateExamPDF } from '../utils/pdfGenerator';
import { saveQuestion, removeQuestion, isQuestionSaved } from '../services/library';
import { sanitizeInput } from '../utils/security';

interface ResultsProps {
  questions: Question[];
  answers: UserAnswer[];
  onRestart: () => void;
  onRetake: () => void;
  onGenerateRemediation: (wrongIds: string[]) => void;
  isFullWidth: boolean;
}

export const Results: React.FC<ResultsProps> = ({ questions, answers, onRestart, onRetake, onGenerateRemediation, isFullWidth }) => {
  const [userName, setUserName] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [showWeakPoints, setShowWeakPoints] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savedQuestions, setSavedQuestions] = useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      questions.forEach(q => { initial[q.id] = isQuestionSaved(q.id); });
      return initial;
  });
  
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
        date: new Date().toISOString()
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
      <div className="text-center mb-12 border-b border-gray-300 dark:border-gray-800 pb-8">
        <h2 className="text-4xl font-bold mb-6">ASSESSMENT COMPLETE</h2>
        <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
                <div className="text-6xl font-mono mb-1">
                    <span className={score >= 70 ? "text-green-500" : "text-red-500"}>{score}%</span>
                </div>
                <div className="text-sm text-gray-500">FINAL SCORE</div>
            </div>
            <div className="h-16 w-px bg-gray-300 dark:bg-gray-700"></div>
            <div className="text-center">
                <div className={`text-6xl font-mono font-bold mb-1 ${['A+','A','A-','B+','B'].includes(grade) ? 'text-blue-500' : ['C+','C','C-'].includes(grade) ? 'text-yellow-500' : 'text-red-600'}`}>
                    {grade}
                </div>
                <div className="text-sm text-gray-500">GRADE</div>
            </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
            {correctCount} / {questions.length} CORRECT
        </p>
        
        {wrongIds.length > 0 && (
            <button 
                onClick={() => setShowWeakPoints(!showWeakPoints)}
                className="text-xs font-bold uppercase tracking-widest underline text-blue-500 hover:text-blue-400"
            >
                {showWeakPoints ? 'HIDE ANALYSIS' : 'VIEW WEAK POINTS'}
            </button>
        )}
        
        {showWeakPoints && wrongIds.length > 0 && (
            <div className="mt-6 max-w-md mx-auto bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 p-4 rounded">
                <h4 className="font-bold text-red-600 dark:text-red-400 mb-2 text-sm uppercase">Areas for Improvement</h4>
                <ul className="text-sm space-y-1">
                    {Object.entries(wrongTopics).map(([topic, count]) => (
                        <li key={topic} className="flex justify-between">
                            <span>{topic}</span>
                            <span className="font-bold">{count} failed</span>
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>

      <div className="space-y-8 mb-12">
        {processedAnswers.map((item, idx) => (
          <div key={item.question.id} className={`p-6 border-l-4 ${item.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10'} bg-white dark:bg-gray-900 shadow-md rounded-r-lg relative`}>
             <button 
                onClick={() => toggleSave(item.question)}
                className={`absolute top-4 right-4 p-1 transition-colors hover:scale-110 ${savedQuestions[item.question.id] ? 'text-red-500' : 'text-gray-300 dark:text-gray-700 hover:text-red-400'}`}
                title={savedQuestions[item.question.id] ? "Remove from Library" : "Save to Library"}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
            </button>

            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-800 pr-8">
              <div className="flex flex-col">
                 <h3 className="font-bold text-lg">Question {idx + 1}</h3>
                 <span className="text-xs opacity-50 uppercase text-gray-500">{item.question.type} • {item.question.topic}</span>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${item.isCorrect ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                {item.isCorrect ? 'PASSED' : 'FAILED'}
              </span>
            </div>
            
            <div className="mb-6 text-lg font-medium text-gray-800 dark:text-gray-200">
                <MarkdownRenderer content={item.question.text} />
            </div>

            {/* RENDER CODE SNIPPET IF AVAILABLE */}
            {item.question.codeSnippet && (
                <div className="mb-6">
                    <CodeWindow code={item.question.codeSnippet} />
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="bg-gray-100 dark:bg-black p-4 rounded border border-gray-200 dark:border-gray-800">
                    <span className="block text-xs opacity-50 font-bold mb-2 uppercase tracking-wider">Your Input</span>
                    <div className="font-mono break-all whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                        {item.question.type === QuestionType.MCQ 
                            ? (item.question.options && item.answer !== null ? 
                                <MarkdownRenderer content={item.question.options[item.answer as number]} /> : 'None')
                            : String(item.answer || 'No Answer')
                        }
                    </div>
                </div>
                <div className="bg-blue-50 dark:bg-[#0c0c0c] p-4 rounded border border-blue-100 dark:border-gray-800">
                    <span className="block text-xs opacity-50 font-bold mb-2 uppercase tracking-wider text-blue-800 dark:text-blue-400">Analysis / Solution</span>
                    <MarkdownRenderer content={item.feedback} />
                </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-black border-t border-gray-300 dark:border-terminal-green flex flex-col xl:flex-row gap-4 justify-center items-center shadow-[0_-5px_20px_rgba(0,0,0,0.2)] z-50">
        
        {!isPublished ? (
             <div className="flex flex-col w-full xl:w-auto">
                <div className="flex gap-2 w-full xl:w-auto">
                    <input 
                        type="text" 
                        placeholder="ENTER_AGENT_NAME" 
                        value={userName}
                        onChange={handleNameChange}
                        maxLength={20}
                        className={`bg-gray-100 dark:bg-gray-900 border ${nameError ? 'border-red-500' : 'border-gray-400'} p-2 font-mono outline-none focus:border-blue-500 flex-grow xl:w-48`}
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
        ) : (
            <div className="text-green-600 dark:text-green-400 font-bold px-4 py-2 border border-green-500 bg-green-50 dark:bg-green-900/20 rounded">
                ✓ PUBLISHED: {userName}
            </div>
        )}

        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-center">
            <button 
                onClick={handleDownloadPDF}
                className="px-4 py-2 border border-orange-400 dark:border-orange-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 font-bold transition-colors flex items-center gap-2"
            >
                <span>PDF REPORT</span>
            </button>

            <button 
                onClick={onRetake}
                className="px-4 py-2 border border-blue-400 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold transition-colors"
            >
                RETAKE EXAM
            </button>

            <button 
                onClick={onRestart}
                className="px-4 py-2 border border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-800 font-bold transition-colors"
            >
                RESTART SYSTEM
            </button>
            
            {wrongIds.length > 0 && (
                <button 
                    onClick={() => onGenerateRemediation(wrongIds)}
                    className="px-6 py-2 bg-purple-600 text-white font-bold hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-500/30 transition-all hover:-translate-y-0.5"
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
