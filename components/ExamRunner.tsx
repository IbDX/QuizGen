import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Question, UserAnswer, ExamSettings, ExamMode, QuestionType, UILanguage } from '../types';
import { gradeCodingAnswer, gradeShortAnswer } from '../services/gemini';
import { saveQuestion, isQuestionSaved, removeQuestion } from '../services/library';
import { CodeWindow } from './CodeWindow';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GraphRenderer } from './GraphRenderer';
import { DiagramRenderer } from './DiagramRenderer';
import { validateCodeInput } from '../utils/security';
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

// --- SUB-COMPONENT: Slide to Submit ---
const SlideToSubmit = ({ onConfirm, lang, disabled }: { onConfirm: () => void, lang: UILanguage, disabled: boolean }) => {
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const maxDrag = useRef(0);
    const threshold = 0.9; // 90% to trigger

    useEffect(() => {
        if (containerRef.current) {
            maxDrag.current = containerRef.current.clientWidth - 56; // Width minus handle width
        }
    }, []);

    const handleStart = (clientX: number) => {
        if (disabled) return;
        setIsDragging(true);
    };

    const handleMove = (clientX: number) => {
        if (!isDragging || disabled) return;
        if (!containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const offsetX = clientX - rect.left - 28; // Center handle
        const clamped = Math.max(0, Math.min(offsetX, maxDrag.current));
        setDragX(clamped);
    };

    const handleEnd = () => {
        if (!isDragging || disabled) return;
        setIsDragging(false);
        if (dragX > maxDrag.current * threshold) {
            setDragX(maxDrag.current);
            onConfirm();
        } else {
            setDragX(0); // Snap back
        }
    };

    return (
        <div 
            className={`relative h-14 bg-gray-200 dark:bg-terminal-gray rounded-full overflow-hidden select-none touch-none transition-opacity ${disabled ? 'opacity-50' : 'opacity-100'}`}
            ref={containerRef}
            onMouseMove={(e) => handleMove(e.clientX)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchMove={(e) => handleMove(e.touches[0].clientX)}
            onTouchEnd={handleEnd}
        >
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest z-0 pointer-events-none">
                {t('submit', lang)} &gt;&gt;&gt;
            </div>
            <div 
                className="absolute top-0 bottom-0 left-0 bg-terminal-green/20 z-0 transition-all duration-75" 
                style={{ width: `${dragX + 28}px` }}
            ></div>
            <div 
                className="absolute top-1 left-1 bottom-1 w-12 h-12 bg-white dark:bg-terminal-green rounded-full shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
                style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                onMouseDown={(e) => handleStart(e.clientX)}
                onTouchStart={(e) => handleStart(e.touches[0].clientX)}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-800 dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
            </div>
        </div>
    );
};

// --- OPTIMIZATION: Memoized Question Panel ---
interface QuestionPanelProps {
    q: Question;
    idx: number;
    total: number;
    answer: string | number;
    onAnswer: (val: string | number) => void;
    showFeedback: boolean;
    feedbackContent: string;
    isCorrect?: boolean;
    isTwoWay: boolean;
    isGrading: boolean;
    savedState: boolean;
    onToggleSave: () => void;
    lang: UILanguage;
    inputError: string | null;
}

const QuestionPanel: React.FC<QuestionPanelProps> = React.memo(({
    q, idx, total, answer, onAnswer, showFeedback, feedbackContent, isCorrect,
    isTwoWay, isGrading, savedState, onToggleSave, lang, inputError
}) => {
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    const isStandardMCQ = q.type === QuestionType.MCQ && q.options && q.options.length > 0;
    const isSnippetInText = q.codeSnippet && q.text.includes('```');

    return (
        <div className="pb-32 md:pb-10"> {/* Extra padding for bottom fixed dock on mobile */}
            {enlargedImage && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-fade-in" 
                    onClick={() => setEnlargedImage(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Enlarged Image View"
                >
                    <img src={enlargedImage} alt="Visual Detail" className="max-w-full max-h-full object-contain rounded border border-gray-700" />
                    <button className="absolute top-4 right-4 text-white text-2xl font-bold p-4 bg-black/50 rounded-full" aria-label="Close">✕</button>
                </div>
            )}

            <div className="bg-white dark:bg-terminal-black border-b border-gray-200 dark:border-terminal-gray/20 p-4 md:p-8">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-xs text-blue-600 dark:text-terminal-green font-mono uppercase tracking-widest font-bold">
                        {t('question', lang)} <span className="text-lg">{toArabicNumerals(idx + 1)}</span><span className="text-gray-400">/{toArabicNumerals(total)}</span>
                    </span>
                    <button 
                        onClick={onToggleSave} 
                        className={`p-3 -m-3 transition-colors ${savedState ? 'text-red-500' : 'text-gray-300 dark:text-gray-600 hover:text-red-400'}`}
                        aria-label={savedState ? "Unsave Question" : "Save Question for Later"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
                
                <div className="text-base md:text-xl font-medium leading-relaxed text-gray-800 dark:text-terminal-light mb-6" id={`q-text-${q.id}`}>
                   <MarkdownRenderer content={q.text} />
                </div>

                {q.graphConfig && <div className="mb-6"><GraphRenderer config={q.graphConfig} /></div>}
                {q.diagramConfig && <div className="mb-6"><DiagramRenderer code={q.diagramConfig.code} /></div>}
                {!q.graphConfig && !q.diagramConfig && q.visual && (
                    <div className="mb-6 rounded-lg border border-gray-200 dark:border-terminal-gray overflow-hidden bg-gray-50 dark:bg-black" onClick={() => setEnlargedImage(`data:image/png;base64,${q.visual}`)}>
                        <img src={`data:image/png;base64,${q.visual}`} alt="Question Visual" className="max-h-64 w-full object-contain" />
                        <div className="text-center text-[10px] text-gray-400 py-1 uppercase tracking-wider">Tap to zoom</div>
                    </div>
                )}

                {q.codeSnippet && !isSnippetInText && (
                  <div dir="ltr" className="w-full text-left mb-6 text-sm"><CodeWindow code={q.codeSnippet!} /></div>
                )}
            </div>

            <div className="p-4 md:p-8">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-terminal-green uppercase tracking-widest mb-3 ml-1">Input Buffer</h4>
                
                {isStandardMCQ ? (
                    <div className="space-y-3" role="radiogroup" aria-labelledby={`q-text-${q.id}`}>
                    {q.options!.map((opt, optIdx) => (
                        <label 
                            key={optIdx} 
                            className={`
                                flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] touch-manipulation min-h-[60px]
                                ${answer === optIdx 
                                    ? 'border-blue-500 dark:border-terminal-green bg-blue-50 dark:bg-terminal-green/10' 
                                    : 'border-gray-200 dark:border-terminal-gray hover:border-gray-300 dark:hover:border-terminal-dimGreen bg-white dark:bg-terminal-black'
                                }
                            `}
                        >
                            <div className={`w-6 h-6 rounded-full border-2 mr-4 rtl:mr-0 rtl:ml-4 flex items-center justify-center flex-shrink-0 transition-colors ${answer === optIdx ? 'border-blue-500 dark:border-terminal-green bg-blue-500 dark:bg-terminal-green' : 'border-gray-300 dark:border-gray-600'}`}>
                                    {answer === optIdx && <div className="w-2 h-2 bg-white dark:bg-black rounded-full"></div>}
                            </div>
                            <input 
                                type="radio" 
                                name={`q-${q.id}`} 
                                checked={answer === optIdx} 
                                onChange={() => onAnswer(optIdx)} 
                                className="sr-only" 
                                disabled={showFeedback && isTwoWay} 
                            />
                            <span className="text-sm font-medium dark:text-terminal-light w-full"><MarkdownRenderer content={opt} /></span>
                        </label>
                    ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {q.type === QuestionType.CODING ? (
                            <div className="border-2 border-gray-300 dark:border-terminal-green/30 rounded-lg overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-terminal-green bg-[#1e1e1e]">
                                <Editor
                                    value={String(answer)}
                                    onValueChange={code => onAnswer(code)}
                                    highlight={code => Prism.highlight(code, Prism.languages.javascript || Prism.languages.clike, 'javascript')}
                                    padding={15}
                                    style={{ fontFamily: 'Fira Code, monospace', fontSize: 14, minHeight: '200px' }}
                                    disabled={showFeedback && isTwoWay}
                                    className="text-gray-200"
                                    textareaId={`code-input-${q.id}`}
                                />
                                <label htmlFor={`code-input-${q.id}`} className="sr-only">Code Answer</label>
                            </div>
                        ) : (
                            <textarea 
                                value={String(answer)} 
                                onChange={(e) => onAnswer(e.target.value)}
                                className="w-full bg-white dark:bg-[#0c0c0c] border-2 border-gray-300 dark:border-terminal-green/30 p-4 font-mono focus:border-blue-500 dark:focus:border-terminal-green outline-none text-base rounded-lg dark:text-terminal-light min-h-[160px] shadow-sm transition-colors"
                                disabled={showFeedback && isTwoWay}
                                placeholder="Type your answer here..."
                                aria-label="Short Answer Input"
                            />
                        )}
                    </div>
                )}

                {showFeedback && (
                    <div role="alert" className={`mt-6 p-5 rounded-lg border-l-4 animate-fade-in ${isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                        <h4 className={`font-bold mb-2 text-sm tracking-widest uppercase flex items-center gap-2 ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            <span>{isCorrect ? '✓' : '✕'}</span>
                            {isCorrect ? "Correct" : "Incorrect"}
                        </h4>
                        <div className="text-sm dark:text-gray-300">
                            <MarkdownRenderer content={feedbackContent} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export const ExamRunner: React.FC<ExamRunnerProps> = ({ questions, settings, onComplete, isFullWidth, lang }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map());
  const [timeLeft, setTimeLeft] = useState(settings.timeLimitMinutes * 60);
  const [isGrading, setIsGrading] = useState(false);
  const [savedState, setSavedState] = useState<boolean>(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [currentFeedback, setCurrentFeedback] = useState<string>("");

  const currentQ = questions[currentIndex];
  const isOneWay = settings.mode === ExamMode.ONE_WAY;
  const isTwoWay = !isOneWay;
  const isLastQuestion = currentIndex === questions.length - 1;

  // --- SWIPE LOGIC ---
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
      // Disable swipe if touching a code block to allow horizontal scrolling
      const target = e.target as HTMLElement;
      if (target.tagName === 'PRE' || target.tagName === 'CODE' || target.closest('pre') || target.closest('.prism-editor-wrapper')) {
          touchStart.current = null;
          return;
      }
      touchEnd.current = null;
      touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
      if (touchStart.current === null) return;
      touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) return;
      const distance = touchStart.current - touchEnd.current;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;

      if (isLeftSwipe && !isLastQuestion && !isGrading) {
          nextQuestion();
      } else if (isRightSwipe && currentIndex > 0 && !(isGrading && !isTwoWay)) { // Allow going back unless strictly locked? Usually one-way allows back unless submitted.
          prevQuestion();
      }
  };

  useEffect(() => {
      if (currentQ) {
        setSavedState(isQuestionSaved(currentQ.id));
        setInputError(null);
      }
  }, [currentQ?.id]);

  useEffect(() => {
    if (settings.timeLimitMinutes > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onComplete(Array.from(answersRef.current.values()));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [settings.timeLimitMinutes, onComplete]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleFinish = useCallback(() => {
    if (inputError || isGrading) return;
    onComplete(Array.from(answersRef.current.values()));
  }, [inputError, isGrading, onComplete]);

  const handleToggleSave = useCallback(() => {
      if (savedState) { removeQuestion(currentQ.id); setSavedState(false); } 
      else { saveQuestion(currentQ); setSavedState(true); }
  }, [savedState, currentQ]);

  const handleAnswer = useCallback((value: string | number) => {
    let validatedValue = value;
    setInputError(null);
    if (currentQ.type === QuestionType.CODING) {
        const validation = validateCodeInput(String(value));
        if (!validation.isValid) {
            setInputError(validation.error || "Invalid Input");
            if (validation.sanitizedValue) validatedValue = validation.sanitizedValue;
        }
    }
    setAnswers(prev => {
      const newMap = new Map(prev);
      newMap.set(currentQ.id, { questionId: currentQ.id, answer: validatedValue });
      return newMap;
    });
  }, [currentQ]);

  const checkAnswerTwoWay = useCallback(async () => {
    if (inputError) return;
    setIsGrading(true);
    const userAnswer = answersRef.current.get(currentQ.id);
    if (!userAnswer) {
        setCurrentFeedback(`${t('no_answer_provided', lang)}\n\n**${t('analysis', lang)}:**\n${currentQ.explanation}`);
        setShowFeedback(true);
        setIsGrading(false);
        return;
    }

    let feedback = "";
    let isCorrect = false;
    const isStandardMCQ = currentQ.type === QuestionType.MCQ && currentQ.options && currentQ.options.length > 0;

    if (isStandardMCQ) {
        isCorrect = userAnswer.answer === currentQ.correctOptionIndex;
        const correctText = currentQ.options![currentQ.correctOptionIndex!] || "Unknown";
        feedback = isCorrect ? "Correct!" : `Incorrect. Correct: ${correctText}\n\n${currentQ.explanation}`;
    } else if (currentQ.type === QuestionType.TRACING) {
        isCorrect = String(userAnswer.answer).trim().toLowerCase() === (currentQ.tracingOutput || "").trim().toLowerCase();
        feedback = isCorrect ? "Correct!" : `Incorrect. Expected: ${currentQ.tracingOutput}\n\n${currentQ.explanation}`;
    } else {
        const result = currentQ.type === QuestionType.CODING 
            ? await gradeCodingAnswer(currentQ, String(userAnswer.answer), lang)
            : await gradeShortAnswer(currentQ, String(userAnswer.answer), lang);
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
  }, [currentQ, inputError, lang]);

  const nextQuestion = useCallback(() => { setShowFeedback(false); setInputError(null); if (currentIndex < questions.length - 1) { setCurrentIndex(prev => prev + 1); scrollToTop(); } }, [currentIndex, questions.length, scrollToTop]);
  const prevQuestion = useCallback(() => { setShowFeedback(false); setInputError(null); if (currentIndex > 0) { setCurrentIndex(prev => prev - 1); scrollToTop(); } }, [currentIndex, scrollToTop]);
  const jumpToQuestion = useCallback((index: number) => { if (!isOneWay && !isGrading) { setShowFeedback(false); setInputError(null); setCurrentIndex(index); scrollToTop(); setIsNavOpen(false); } }, [isOneWay, isGrading, scrollToTop]);

  if (!currentQ) return <div className="p-8 text-center text-red-500 font-mono">ERROR: LOADING FAULT</div>;

  const currentAnswer = answers.get(currentQ.id)?.answer ?? "";
  const progressPercentage = Math.round((answers.size / questions.length) * 100);
  
  return (
    <div 
        className={`flex flex-col h-full min-h-screen transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-5xl mx-auto'} bg-gray-100 dark:bg-[#050505]`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
      <div ref={topRef} className="scroll-mt-32 outline-none" tabIndex={-1}></div>

      {/* TOP HEADER: Progress & Timer */}
      <div className="sticky top-16 md:top-[64px] z-30 bg-white/90 dark:bg-[#0c0c0c]/90 backdrop-blur-md border-b border-gray-200 dark:border-terminal-green/30 shadow-sm transition-all">
          <div className="w-full bg-gray-200 dark:bg-terminal-gray h-1">
            <div className="bg-blue-600 dark:bg-terminal-green h-full transition-all duration-300 ease-out" style={{ width: `${progressPercentage}%` }}></div>
          </div>
          
          <div className="flex justify-between items-center px-4 py-2">
                <button 
                    onClick={() => setIsNavOpen(!isNavOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-terminal-gray hover:bg-gray-200 border border-gray-300 dark:border-terminal-gray transition-colors text-xs font-bold text-gray-700 dark:text-terminal-light"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span>Q {toArabicNumerals(currentIndex + 1)}</span>
                </button>

                <div className={`text-sm font-mono font-bold ${settings.timeLimitMinutes > 0 && timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-gray-700 dark:text-terminal-green'}`} role="timer" aria-live={timeLeft < 60 ? "assertive" : "off"}>
                    {settings.timeLimitMinutes > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : "∞"}
                </div>
          </div>

          {/* Collapsible Navigation Drawer */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out border-b border-gray-200 dark:border-terminal-green/20 ${isNavOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-4 flex flex-wrap gap-2 justify-center bg-gray-50 dark:bg-[#0a0a0a]">
                {questions.map((q, idx) => (
                    <button
                        key={idx}
                        onClick={() => jumpToQuestion(idx)}
                        disabled={isOneWay || isGrading}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border transition-all 
                            ${idx === currentIndex 
                                ? 'bg-blue-600 dark:bg-terminal-green text-white dark:text-black border-blue-600 dark:border-terminal-green shadow-md scale-110' 
                                : answers.has(q.id) 
                                    ? 'bg-blue-100 dark:bg-terminal-dimGreen/30 text-blue-800 dark:text-terminal-green border-blue-200 dark:border-terminal-dimGreen' 
                                    : 'bg-white dark:bg-transparent text-gray-500 dark:text-gray-400 border-gray-300 dark:border-terminal-gray'
                            }`}
                    >
                        {toArabicNumerals(idx + 1)}
                    </button>
                ))}
              </div>
          </div>
      </div>

      {/* QUESTION CONTENT */}
      <QuestionPanel 
          q={currentQ}
          idx={currentIndex}
          total={questions.length}
          answer={currentAnswer}
          onAnswer={handleAnswer}
          showFeedback={showFeedback}
          feedbackContent={currentFeedback}
          isCorrect={answers.get(currentQ.id)?.isCorrect}
          isTwoWay={!isOneWay}
          isGrading={isGrading}
          savedState={savedState}
          onToggleSave={handleToggleSave}
          lang={lang}
          inputError={inputError}
      />

      {/* FIXED BOTTOM ACTION DOCK (Mobile First) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/95 dark:bg-[#0c0c0c]/95 backdrop-blur-md border-t border-gray-200 dark:border-terminal-green/30 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <div className={`max-w-5xl mx-auto flex items-center justify-between gap-4 transition-all ${isFullWidth ? 'max-w-none' : ''}`}>
              
              {/* Prev Button */}
              <button 
                  onClick={prevQuestion} 
                  disabled={currentIndex === 0 || (!isTwoWay && isGrading)} 
                  className="h-12 w-12 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-terminal-gray dark:hover:bg-gray-800 text-gray-600 dark:text-terminal-green border border-gray-200 dark:border-gray-700 disabled:opacity-30 transition-all active:scale-95"
                  aria-label="Previous"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>

              {/* Center Action Area (Check or Submit Slider or Next Status) */}
              <div className="flex-grow max-w-sm">
                  {isLastQuestion ? (
                      <SlideToSubmit 
                          onConfirm={handleFinish} 
                          lang={lang} 
                          disabled={!!inputError || isGrading} 
                      />
                  ) : (
                      isTwoWay && !showFeedback ? (
                          <button 
                              onClick={checkAnswerTwoWay} 
                              disabled={isGrading || !!inputError} 
                              className="w-full h-12 bg-blue-600 dark:bg-terminal-green text-white dark:text-black font-bold uppercase tracking-widest rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                          >
                              {isGrading ? <span className="animate-spin">↻</span> : <span>✓ {t('check', lang)}</span>}
                          </button>
                      ) : (
                          <div className="h-12 flex items-center justify-center text-xs text-gray-400 font-mono uppercase tracking-widest border border-dashed border-gray-300 dark:border-terminal-gray rounded-xl select-none">
                              Swipe to Navigate
                          </div>
                      )
                  )}
              </div>

              {/* Next Button */}
              <button 
                  onClick={nextQuestion} 
                  disabled={isLastQuestion || isGrading} 
                  className={`h-12 w-12 flex items-center justify-center rounded-xl border disabled:opacity-30 transition-all active:scale-95 ${isLastQuestion ? 'bg-gray-100 border-gray-200 text-gray-300' : 'bg-blue-600 dark:bg-terminal-green text-white dark:text-black border-transparent shadow-md'}`}
                  aria-label="Next"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </button>
          </div>
      </div>
    </div>
  );
};