
import React, { useState, useEffect, useRef } from 'react';
import { Question, UserAnswer, ExamSettings, ExamMode, QuestionType, UILanguage } from '../types';
import { gradeCodingAnswer, gradeShortAnswer } from '../services/gemini';
import { saveQuestion, isQuestionSaved, removeQuestion } from '../services/library';
import { CodeWindow } from './CodeWindow';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GraphRenderer } from './GraphRenderer'; 
import { DiagramRenderer } from './DiagramRenderer'; 
import { validateCodeInput, sanitizeInput } from '../utils/security';
import { monitor } from '../services/monitor'; // Import monitor
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import { t, toArabicNumerals } from '../utils/translations';

interface ExamRunnerProps {
  questions: Question[];
  settings: ExamSettings;
  onComplete: (answers: UserAnswer[]) => void;
  isFullWidth: boolean;
  lang: UILanguage;
}

// OPTIMIZATION: Separated Timer Component with ARIA Live Region
const ExamTimer = React.memo(({ timeLimitMinutes, onTimeout, lang }: { timeLimitMinutes: number, onTimeout: () => void, lang: UILanguage }) => {
    const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);

    useEffect(() => {
        if (timeLimitMinutes <= 0) return;
        
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLimitMinutes, onTimeout]);

    if (timeLimitMinutes <= 0) return <span className="text-terminal-green text-xl font-mono" aria-label="Unlimited Time">∞</span>;

    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // Use polite aria-live so it doesn't interrupt screen reader constantly, but updates are available
    return (
        <div className="flex items-center gap-2" role="timer" aria-live="off">
            <span className={`text-xl font-mono whitespace-nowrap ${timeLeft < 60 ? 'text-terminal-alert animate-pulse' : 'text-terminal-green'}`}>
                <span className="sr-only">{t('time_remaining', lang)}</span>
                {timeStr}
            </span>
        </div>
    );
});

export const ExamRunner: React.FC<ExamRunnerProps> = ({ questions, settings, onComplete, isFullWidth, lang }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map());
  const [isGrading, setIsGrading] = useState(false);
  const [savedState, setSavedState] = useState<boolean>(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false); // New state for submit safety
  
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  
  // Mobile UX: Toggle between Viewing Content (Code/Graph) and Input
  const [mobileTab, setMobileTab] = useState<'CONTENT' | 'INPUT'>('CONTENT');

  const topRef = useRef<HTMLDivElement>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [currentFeedback, setCurrentFeedback] = useState<string>("");

  // Swipe Gesture State
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const currentQ = questions[currentIndex];
  const isOneWay = settings.mode === ExamMode.ONE_WAY;
  const isLastQuestion = currentIndex === questions.length - 1;

  useEffect(() => {
      if (currentQ) {
        setSavedState(isQuestionSaved(currentQ.id));
        setInputError(null);
        // Reset mobile tab on question change
        setMobileTab('CONTENT'); 
        setIsConfirmingSubmit(false); // Reset submit state on nav
        monitor.log('INTERACTION', `View Question ${currentIndex + 1}`, 0);
      }
  }, [currentQ?.id]);

  // Keyboard Navigation
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
          
          if (e.key === 'ArrowRight') nextQuestion();
          if (e.key === 'ArrowLeft') prevQuestion();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isGrading]);

  // --- SWIPE HANDLERS ---
  const onTouchStart = (e: React.TouchEvent) => {
      touchEnd.current = null; 
      touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
      touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) return;
      const distance = touchStart.current - touchEnd.current;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;

      if (isLeftSwipe && !isLastQuestion && !isGrading) {
          nextQuestion();
      }
      if (isRightSwipe && currentIndex > 0 && !isGrading) {
          prevQuestion();
      }
  };

  if (!currentQ) {
      return (
        <div className="flex flex-col h-full items-center justify-center p-8">
            <div className="text-terminal-alert font-bold text-xl mb-4" role="alert">⚠️ SYSTEM ERROR: Question Data Unavailable</div>
            <button onClick={() => onComplete([])} className="px-6 py-3 bg-gray-800 text-white font-bold uppercase rounded">{t('cancel_action', lang)}</button>
        </div>
      );
  }

  const scrollToTop = () => {
    if (topRef.current) {
        // Reduced offset for mobile
        const yOffset = window.innerWidth < 768 ? -80 : -120;
        const y = topRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({top: y, behavior: 'smooth'});
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinish = () => {
    if (inputError || isGrading) return;
    
    // Improved Logic: 2-Step Confirmation Button inside the UI instead of window.confirm
    if (!isConfirmingSubmit) {
        setIsConfirmingSubmit(true);
        // Auto-reset confirmation if user hesitates
        setTimeout(() => setIsConfirmingSubmit(false), 3000);
        return;
    }

    monitor.log('INTERACTION', 'User Submitted Exam', 0);
    onComplete(Array.from(answers.values()));
  };

  const handleTimeout = () => {
      monitor.log('INTERACTION', 'Exam Timeout', 0);
      onComplete(Array.from(answersRef.current.values()));
  };

  const handleToggleSave = () => {
      if (savedState) {
          removeQuestion(currentQ.id);
          setSavedState(false);
          monitor.log('STORAGE_USAGE', 'Remove Saved Question');
      } else {
          saveQuestion(currentQ);
          setSavedState(true);
          monitor.log('STORAGE_USAGE', 'Save Question');
      }
  };

  const handleAnswer = (value: string | number) => {
    let validatedValue = value;
    setInputError(null);

    if (currentQ.type === QuestionType.CODING) {
        const validation = validateCodeInput(String(value));
        if (!validation.isValid) {
            setInputError(validation.error || "Invalid Input");
            if (validation.sanitizedValue) validatedValue = validation.sanitizedValue;
        }
    } else if (currentQ.type === QuestionType.TRACING) {
        const validation = sanitizeInput(String(value));
        if (!validation.isValid) {
             setInputError(validation.error || "Invalid Character");
             return;
        }
        validatedValue = validation.sanitizedValue;
    }

    setAnswers(prev => {
      const newMap = new Map(prev);
      newMap.set(currentQ.id, {
        questionId: currentQ.id,
        answer: validatedValue
      });
      return newMap;
    });
  };

  const checkAnswerTwoWay = async () => {
    if (inputError) return;
    setIsGrading(true);
    monitor.log('API_LATENCY', 'Grading Single Answer', 0);
    const userAnswer = answers.get(currentQ.id);
    
    if (!userAnswer) {
        setCurrentFeedback(`${t('no_answer_provided', lang)}\n\n**${t('analysis', lang)}:**\n${currentQ.explanation}`);
        setShowFeedback(true);
        setIsGrading(false);
        return;
    }

    let feedback = "";
    let isCorrect = false;

    const isStandardMCQ = currentQ.type === QuestionType.MCQ && 
                          currentQ.options && 
                          currentQ.options.length > 0;

    if (isStandardMCQ) {
        isCorrect = userAnswer.answer === currentQ.correctOptionIndex;
        const correctText = (currentQ.options && currentQ.correctOptionIndex !== undefined && currentQ.options[currentQ.correctOptionIndex]) 
                            ? currentQ.options[currentQ.correctOptionIndex] 
                            : "Option " + (currentQ.correctOptionIndex || 0 + 1);
        feedback = isCorrect ? "Correct!" : `Incorrect.\n\n**Correct Answer:** ${correctText}\n\n${currentQ.explanation}`;
    } else if (currentQ.type === QuestionType.TRACING) {
        const userTxt = String(userAnswer.answer).trim().toLowerCase();
        const correctTxt = (currentQ.tracingOutput || "").trim().toLowerCase();
        isCorrect = userTxt === correctTxt;
        feedback = isCorrect ? "Correct!" : `Incorrect. Expected: \`${currentQ.tracingOutput}\`\n\n${currentQ.explanation}`;
    } else if (currentQ.type === QuestionType.CODING) {
        const result = await gradeCodingAnswer(currentQ, String(userAnswer.answer), lang);
        isCorrect = result.isCorrect;
        feedback = result.feedback;
    } else {
        const result = await gradeShortAnswer(currentQ, String(userAnswer.answer), lang);
        isCorrect = result.isCorrect;
        feedback = result.feedback;
    }

    setAnswers(prev => {
        const newMap = new Map(prev);
        newMap.set(currentQ.id, { ...userAnswer, isCorrect, feedback });
        return newMap;
    });

    setCurrentFeedback(feedback);
    setShowFeedback(true);
    setIsGrading(false);
  };

  const nextQuestion = () => {
    if (isGrading) return;
    setShowFeedback(false);
    setCurrentFeedback("");
    setInputError(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      scrollToTop();
    }
  };
  
  const prevQuestion = () => {
    if (isGrading) return;
    setShowFeedback(false);
    setCurrentFeedback("");
    setInputError(null);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      scrollToTop();
    }
  };

  const jumpToQuestion = (index: number) => {
    if (isOneWay || isGrading) return;
    setShowFeedback(false);
    setCurrentFeedback("");
    setInputError(null);
    setCurrentIndex(index);
    scrollToTop();
  }

  const getAnswerValue = () => answers.get(currentQ.id)?.answer ?? "";
  const progressPercentage = Math.round((answers.size / questions.length) * 100);
  
  const isStandardMCQ = currentQ.type === QuestionType.MCQ && 
                        currentQ.options && 
                        currentQ.options.length > 0;
  
  const isTextResponse = currentQ.type === QuestionType.SHORT_ANSWER || 
                         (currentQ.type === QuestionType.MCQ && !isStandardMCQ);

  const showCodeSnippet = currentQ.codeSnippet;

  // ARIA: Determine if input area is complex
  const isComplexInput = currentQ.type === QuestionType.CODING || currentQ.type === QuestionType.TRACING;

  return (
    <div 
        className={`flex flex-col h-full transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-5xl mx-auto'}`}
        // Add swipe listeners to the main container
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        role="main"
        aria-label="Exam Interface"
    >
      <div ref={topRef} className="scroll-mt-32"></div>

      {enlargedImage && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" 
            onClick={() => setEnlargedImage(null)}
            role="dialog"
            aria-label="Enlarged Image"
          >
              <img src={enlargedImage} alt="Detailed View" className="max-w-full max-h-full object-contain rounded border border-gray-700" />
              <button 
                className="absolute top-4 right-4 text-white text-2xl font-bold p-4 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                onClick={() => setEnlargedImage(null)}
                aria-label="Close Image"
              >✕</button>
          </div>
      )}

      {/* PROGRESS BAR */}
      <div className="mb-4" role="progressbar" aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100} aria-label="Exam Progress">
        <div className="flex justify-between text-[10px] font-bold font-mono mb-1 text-gray-500 dark:text-gray-400 tracking-widest">
          <span>{t('execution_progress', lang)}</span>
          <span aria-hidden="true">{progressPercentage}% [{answers.size}/{questions.length}]</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-terminal-gray h-1.5 border border-gray-300 dark:border-terminal-gray overflow-hidden">
          <div 
            className="bg-terminal-green h-full transition-all duration-500 ease-out shadow-[0_0_8px_var(--color-term-green)]"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* NAVIGATION BAR & TIMER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 p-4 border border-gray-300 dark:border-terminal-green bg-white dark:bg-terminal-black shadow-sm gap-4">
         <div className="flex flex-wrap gap-2 justify-center rtl:flex-row-reverse" role="navigation" aria-label="Question Navigation">
            {questions.map((_, idx) => {
                const isAnswered = answers.has(questions[idx].id);
                const isCurrent = idx === currentIndex;
                return (
                    <button
                        key={idx}
                        onClick={() => jumpToQuestion(idx)}
                        disabled={isOneWay || isGrading}
                        aria-label={`Question ${idx + 1}${isAnswered ? ', Answered' : ''}${isCurrent ? ', Current' : ''}`}
                        aria-current={isCurrent ? 'step' : undefined}
                        className={`
                            w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs font-bold border transition-all touch-manipulation focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 dark:focus-visible:ring-terminal-green
                            ${isCurrent 
                                ? 'bg-terminal-green text-terminal-black border-terminal-green scale-110 shadow-lg' 
                                : isAnswered 
                                    ? `bg-gray-200 dark:bg-terminal-dimGreen text-gray-700 dark:text-terminal-black border-gray-300 dark:border-terminal-dimGreen ${isOneWay ? 'opacity-50 cursor-not-allowed' : ''}` 
                                    : `bg-transparent text-gray-400 dark:text-terminal-green border-gray-300 dark:border-terminal-gray ${!isOneWay && 'hover:border-terminal-green'}`
                            }
                            ${isOneWay || isGrading ? 'cursor-not-allowed' : ''}
                        `}
                    >
                        {lang === 'ar' ? toArabicNumerals(idx + 1) : idx + 1}
                    </button>
                )
            })}
         </div>

         <ExamTimer timeLimitMinutes={settings.timeLimitMinutes} onTimeout={handleTimeout} lang={lang} />
      </div>

      {/* QUESTION CONTAINER */}
      <div className="flex-grow border border-gray-300 dark:border-terminal-green p-4 md:p-8 bg-white dark:bg-terminal-black relative overflow-hidden shadow-xl flex flex-col transition-colors duration-300">
        
        {/* Question Header */}
        <div className="flex justify-between items-start mb-4 w-full">
            <h2 className="text-sm text-gray-500 dark:text-terminal-green font-mono mt-1 opacity-70" aria-level={2}>
                {t('question', lang)} {currentIndex + 1}
            </h2>

            <div className="flex items-center gap-2">
                <button 
                    onClick={handleToggleSave}
                    className={`transition-colors p-2 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-terminal-green rounded ${savedState ? 'text-terminal-alert' : 'text-gray-300 dark:text-gray-700 hover:text-terminal-alert'}`}
                    title={savedState ? "Remove from Library" : "Save to Library"}
                    aria-label={savedState ? "Remove question from library" : "Save question to library"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-200 dark:bg-terminal-dimGreen text-black dark:text-terminal-light px-2 py-1 rounded-sm whitespace-nowrap" aria-label={`Question Type: ${currentQ.type}`}>
                    {isStandardMCQ ? "MCQ" : currentQ.type}
                </span>
            </div>
        </div>
        
        {/* MOBILE SPLIT VIEW TOGGLE (For Coding/Tracing) */}
        {isComplexInput && (
            <div className="md:hidden flex mb-4 border-b border-gray-200 dark:border-terminal-gray">
                <button 
                    onClick={() => setMobileTab('CONTENT')}
                    className={`flex-1 py-2 text-xs font-bold uppercase ${mobileTab === 'CONTENT' ? 'text-terminal-green border-b-2 border-terminal-green' : 'text-gray-500'}`}
                >
                    Problem
                </button>
                <button 
                    onClick={() => setMobileTab('INPUT')}
                    className={`flex-1 py-2 text-xs font-bold uppercase ${mobileTab === 'INPUT' ? 'text-terminal-green border-b-2 border-terminal-green' : 'text-gray-500'}`}
                >
                    Input / Editor
                </button>
            </div>
        )}

        {/* CONTENT AREA */}
        <div className={`${(isComplexInput && mobileTab === 'INPUT') ? 'hidden md:block' : 'block'}`}>
            <div className="mb-6 relative z-0 flex-grow">
                 <div className="text-base md:text-2xl font-bold leading-relaxed text-gray-800 dark:text-terminal-light break-words">
                   <MarkdownRenderer content={currentQ.text} className="inline-block w-full" />
                 </div>
            </div>

            {currentQ.graphConfig && (
                <div className="mb-8" aria-label="Interactive Graph">
                    <div className="text-xs font-bold text-gray-500 dark:text-terminal-green mb-2 uppercase tracking-wide">Interactive Graph:</div>
                    <GraphRenderer config={currentQ.graphConfig} />
                </div>
            )}

            {currentQ.diagramConfig && (
                <div className="mb-8" aria-label="Diagram">
                     <div className="text-xs font-bold text-gray-500 dark:text-terminal-green mb-2 uppercase tracking-wide">Diagram Structure:</div>
                     <DiagramRenderer code={currentQ.diagramConfig.code} />
                </div>
            )}

            {!currentQ.graphConfig && !currentQ.diagramConfig && currentQ.visual && (
                <div className="mb-8">
                    <div className="text-xs font-bold text-gray-500 dark:text-terminal-green mb-2 uppercase tracking-wide">Attached Visual:</div>
                    <button 
                        className="inline-block rounded border border-gray-300 dark:border-terminal-gray overflow-hidden cursor-zoom-in hover:border-terminal-green transition-colors bg-gray-100 dark:bg-black focus:outline-none focus:ring-2 focus:ring-terminal-green"
                        onClick={() => setEnlargedImage(`data:image/png;base64,${currentQ.visual}`)}
                        aria-label="View enlarged image"
                    >
                        <img 
                            src={`data:image/png;base64,${currentQ.visual}`} 
                            alt="Question Visual" 
                            className="max-h-60 max-w-full object-contain"
                        />
                    </button>
                </div>
            )}

            {showCodeSnippet && (
              <div dir="ltr" className="w-full text-left" aria-label="Code Snippet">
                  <CodeWindow code={currentQ.codeSnippet!} />
              </div>
            )}

            {(currentQ.type === QuestionType.CODING || currentQ.type === QuestionType.TRACING) && currentQ.expectedOutput && (
              <div className="my-8" dir="ltr">
                  <div className="bg-[#252526] px-4 py-2 border-b border-black flex items-center rounded-t-lg">
                      <span className="text-xs text-gray-400 font-mono uppercase">Expected Output</span>
                  </div>
                  <pre className="!m-0 !p-4 !bg-[#1e1e1e] !text-sm overflow-x-auto custom-scrollbar border border-t-0 border-gray-700 rounded-b-lg">
                      <code className="text-gray-200 font-mono leading-relaxed whitespace-pre-wrap">
                          {currentQ.expectedOutput}
                      </code>
                  </pre>
              </div>
            )}
        </div>

        {/* INPUT AREA */}
        <div className={`mt-8 mb-8 ${(isComplexInput && mobileTab === 'CONTENT') ? 'hidden md:block' : 'block'}`} key={currentQ.id}>
          {inputError && (
              <div className="mb-4 p-2 border border-terminal-alert bg-red-100 dark:bg-terminal-alert/10 text-terminal-alert text-xs font-bold flex items-center gap-2 animate-bounce" role="alert">
                  <span>⚠️ {t('security_alert', lang)}:</span>
                  <span>{inputError}</span>
              </div>
          )}

          {isStandardMCQ ? (
            <div className="space-y-3" role="radiogroup" aria-label="Answer Options">
              {currentQ.options!.map((opt, idx) => (
                <label 
                  key={idx}
                  className={`flex items-center p-4 border cursor-pointer transition-colors group relative min-h-[48px] touch-manipulation rounded focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-terminal-green
                    ${getAnswerValue() === idx 
                        ? 'border-terminal-green bg-terminal-green/10 shadow-md' 
                        : 'border-gray-300 dark:border-terminal-gray hover:bg-gray-50 dark:hover:bg-terminal-gray/50'
                    }
                  `}
                >
                  <div className={`
                        w-6 h-6 rounded-full border-2 mr-4 rtl:mr-0 rtl:ml-4 flex items-center justify-center flex-shrink-0 transition-colors
                        ${getAnswerValue() === idx 
                            ? 'border-terminal-green' 
                            : 'border-gray-400 dark:border-gray-600 group-hover:border-terminal-green'
                        }
                  `}>
                        {getAnswerValue() === idx && <div className="w-3 h-3 rounded-full bg-terminal-green"></div>}
                  </div>

                  <input 
                    type="radio" 
                    name={`q-${currentQ.id}`} 
                    checked={getAnswerValue() === idx} 
                    onChange={() => handleAnswer(idx)}
                    className="opacity-0 absolute"
                    disabled={showFeedback && settings.mode === ExamMode.TWO_WAY}
                    aria-label={`Option ${idx + 1}`}
                  />
                  <span className="text-base w-full break-words dark:text-terminal-light">
                      <MarkdownRenderer content={opt} />
                  </span>
                </label>
              ))}
            </div>
          ) : (isTextResponse && (
             <div className="space-y-2">
                <label htmlFor="short-answer-input" className="text-xs text-gray-500 dark:text-terminal-green font-bold mb-1 flex items-center gap-2 uppercase tracking-wider">
                   <span>✎ {t('short_answer', lang)}</span>
                </label>
                <input 
                  id="short-answer-input"
                  type="text" 
                  value={String(getAnswerValue())} 
                  onChange={(e) => handleAnswer(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-terminal-black border border-gray-300 dark:border-terminal-gray p-4 font-mono focus:border-terminal-green outline-none text-base md:text-lg rounded dark:text-terminal-light focus:ring-2 focus:ring-terminal-green"
                  disabled={showFeedback && settings.mode === ExamMode.TWO_WAY}
                  placeholder={lang === 'ar' ? 'اكتب إجابتك هنا...' : 'Type your answer here...'}
                  autoComplete="off"
                />
             </div>
          ))}

          {currentQ.type === QuestionType.TRACING && (
             <div className="space-y-2">
                <label htmlFor="tracing-input" className="text-sm font-bold opacity-70 font-mono dark:text-terminal-green" dir="ltr">&gt; {t('output_terminal', lang)}:</label>
                <textarea 
                  id="tracing-input"
                  value={String(getAnswerValue())} 
                  onChange={(e) => handleAnswer(e.target.value)}
                  maxLength={500}
                  className="w-full bg-gray-50 dark:bg-terminal-black border border-gray-300 dark:border-terminal-gray p-4 font-mono focus:border-terminal-green outline-none text-base md:text-lg dark:text-terminal-light min-h-[80px] resize-y focus:ring-2 focus:ring-terminal-green"
                  disabled={showFeedback && settings.mode === ExamMode.TWO_WAY}
                  dir="ltr" 
                />
             </div>
          )}

          {currentQ.type === QuestionType.CODING && (
            <div className="space-y-2 border border-gray-300 dark:border-terminal-gray" role="application" aria-label="Code Editor">
               <div className="bg-gray-200 dark:bg-terminal-gray px-2 py-1 text-xs font-bold flex justify-between dark:text-terminal-light">
                   <span>{t('editor', lang)}</span>
                   <span className="text-[10px] opacity-70">{t('max_chars', lang)}</span>
               </div>
               <div className="min-h-[200px] bg-gray-50 dark:bg-terminal-black text-left" dir="ltr">
                 <Editor
                    value={String(getAnswerValue())}
                    onValueChange={code => handleAnswer(code)}
                    highlight={code => Prism.highlight(code, Prism.languages.javascript || Prism.languages.clike, 'javascript')}
                    padding={10}
                    style={{
                      fontFamily: '"Fira code", "Fira Mono", monospace',
                      fontSize: 14,
                      minHeight: '200px'
                    }}
                    textareaId="code-editor-textarea"
                    disabled={showFeedback && settings.mode === ExamMode.TWO_WAY}
                  />
                  <label htmlFor="code-editor-textarea" className="sr-only">Code Editor Input</label>
               </div>
            </div>
          )}
        </div>

        {showFeedback && (
            <div className={`mb-6 p-4 md:p-6 border-l-4 animate-fade-in ${answers.get(currentQ.id)?.isCorrect ? 'border-terminal-green bg-terminal-green/10' : 'border-terminal-alert bg-terminal-alert/10'}`} role="status">
                <h4 className={`font-bold mb-3 text-lg ${answers.get(currentQ.id)?.isCorrect ? 'text-terminal-green' : 'text-terminal-alert'}`}>
                    {answers.get(currentQ.id)?.isCorrect ? "✓ CORRECT" : "✕ INCORRECT"}
                </h4>
                <MarkdownRenderer content={currentFeedback} />
            </div>
        )}

        {/* BOTTOM NAVIGATION */}
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-terminal-gray flex flex-row rtl:flex-row-reverse items-center justify-between">
             <button 
                onClick={prevQuestion} 
                disabled={currentIndex === 0 || isOneWay || isGrading}
                className={`
                    flex items-center justify-center p-4 rounded-full transition-all group active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-terminal-green
                    ${currentIndex === 0 || isOneWay || isGrading
                        ? 'opacity-30 cursor-not-allowed text-gray-400' 
                        : 'text-terminal-green hover:bg-terminal-green/10 cursor-pointer'
                    }
                `}
                title={t('prev', lang)}
                aria-label={t('prev', lang)}
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 group-hover:-translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
             </button>

             <div className="flex-grow flex justify-center px-4 gap-3">
                 {settings.mode === ExamMode.TWO_WAY && !showFeedback && (
                    <button
                        onClick={checkAnswerTwoWay}
                        disabled={isGrading || !!inputError}
                        className="px-8 py-3 bg-terminal-green text-terminal-black font-bold hover:bg-terminal-dimGreen disabled:opacity-50 shadow text-sm uppercase rounded transition-colors whitespace-nowrap min-w-[120px]"
                    >
                        {isGrading ? t('validating', lang) : t('check', lang)}
                    </button>
                 )}

                 {isLastQuestion && (
                    <button 
                        onClick={handleFinish}
                        disabled={!!inputError || isGrading}
                        className={`
                            px-8 py-3 font-bold shadow text-sm tracking-wider disabled:opacity-50 uppercase rounded transition-all whitespace-nowrap min-w-[120px]
                            ${isConfirmingSubmit 
                                ? 'bg-terminal-alert text-white animate-pulse' 
                                : 'bg-terminal-green text-terminal-black hover:bg-terminal-dimGreen'
                            }
                        `}
                        aria-label="Submit Exam"
                    >
                        {isConfirmingSubmit ? "CONFIRM?" : t('submit', lang)}
                    </button>
                 )}
             </div>

             <button 
                onClick={nextQuestion}
                disabled={isLastQuestion || isGrading} 
                className={`
                    flex items-center justify-center p-4 rounded-full transition-all group active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-terminal-green
                    ${isLastQuestion || isGrading
                        ? 'opacity-0 pointer-events-none' 
                        : 'text-terminal-green hover:bg-terminal-green/10 cursor-pointer'
                    }
                `}
                title={t('next', lang)}
                aria-label={t('next', lang)}
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 group-hover:translate-x-1 rtl:group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
             </button>
        </div>

      </div>
    </div>
  );
};
