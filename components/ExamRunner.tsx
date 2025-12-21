
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

// --- OPTIMIZATION: Memoized Question Panel ---
// This component isolates the heavy rendering (MathJax, Graphs, Code Editors) 
// from the parent ExamRunner which updates every second due to the timer.
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
    onCheck: () => void;
    onSubmit: () => void;
    onNext: () => void;
    onPrev: () => void;
    isLast: boolean;
    isFirst: boolean;
    lang: UILanguage;
    inputError: string | null;
}

const QuestionPanel: React.FC<QuestionPanelProps> = React.memo(({
    q, idx, total, answer, onAnswer, showFeedback, feedbackContent, isCorrect,
    isTwoWay, isGrading, savedState, onToggleSave, onCheck, onSubmit, onNext, onPrev, isLast, isFirst, lang, inputError
}) => {
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    const isStandardMCQ = q.type === QuestionType.MCQ && q.options && q.options.length > 0;
    const isSnippetInText = q.codeSnippet && q.text.includes('```');

    return (
        <div className="flex-grow border border-gray-300 dark:border-terminal-green p-4 md:p-10 bg-white dark:bg-terminal-black relative overflow-hidden shadow-xl flex flex-col transition-colors duration-300 min-h-[500px]">
            {enlargedImage && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" 
                    onClick={() => setEnlargedImage(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Enlarged Image View"
                >
                    <img src={enlargedImage} alt="Visual Detail" className="max-w-full max-h-full object-contain rounded border border-gray-700" />
                    <button className="absolute top-4 right-4 text-white text-2xl font-bold p-2 hover:text-red-500" aria-label="Close Image">✕</button>
                </div>
            )}

            <div className="flex justify-between items-start mb-6">
                <span className="text-xs text-gray-400 dark:text-terminal-green/50 font-mono uppercase tracking-widest">{t('question', lang)} {idx + 1}</span>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onToggleSave} 
                        className={`transition-transform hover:scale-125 ${savedState ? 'text-red-500' : 'text-gray-300 dark:text-gray-700 hover:text-red-400'}`}
                        aria-label={savedState ? "Unsave Question" : "Save Question for Later"}
                        title={savedState ? "Unsave" : "Save"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-100 dark:bg-terminal-dimGreen text-black px-2 py-1 rounded-sm">{isStandardMCQ ? "MCQ" : q.type}</span>
                </div>
            </div>
            
            <div className="mb-8">
                 <div className="text-lg md:text-2xl font-bold leading-relaxed text-gray-800 dark:text-terminal-light" id={`q-text-${q.id}`}>
                   <MarkdownRenderer content={q.text} className="w-full" />
                 </div>
            </div>

            {q.graphConfig && <div className="mb-10"><GraphRenderer config={q.graphConfig} /></div>}
            {q.diagramConfig && <div className="mb-10"><DiagramRenderer code={q.diagramConfig.code} /></div>}
            {!q.graphConfig && !q.diagramConfig && q.visual && (
                <div className="mb-10 inline-block rounded border border-gray-300 dark:border-terminal-gray overflow-hidden cursor-zoom-in bg-gray-50 dark:bg-black" onClick={() => setEnlargedImage(`data:image/png;base64,${q.visual}`)}>
                    <img src={`data:image/png;base64,${q.visual}`} alt="Question Visual" className="max-h-64 object-contain" />
                </div>
            )}

            {q.codeSnippet && !isSnippetInText && (
              <div dir="ltr" className="w-full text-left mb-10"><CodeWindow code={q.codeSnippet!} /></div>
            )}

            <div className="mt-auto pt-8 border-t border-gray-200 dark:border-terminal-gray/20">
              <div className="mb-6">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-terminal-green uppercase tracking-widest mb-3">Response Buffer:</h4>
                {isStandardMCQ ? (
                    <div className="space-y-3" role="radiogroup" aria-labelledby={`q-text-${q.id}`}>
                    {q.options!.map((opt, optIdx) => (
                        <label 
                            key={optIdx} 
                            className={`flex items-center p-4 border rounded cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-terminal-green ${answer === optIdx ? 'border-terminal-green bg-terminal-green/5 shadow-inner' : 'border-gray-300 dark:border-terminal-gray hover:bg-gray-50 dark:hover:bg-terminal-gray/20'}`}
                        >
                            <div className={`w-5 h-5 rounded-full border-2 mr-4 rtl:mr-0 rtl:ml-4 flex items-center justify-center flex-shrink-0 transition-colors ${answer === optIdx ? 'border-terminal-green bg-terminal-green' : 'border-gray-400'}`}>
                                    {answer === optIdx && <div className="w-1.5 h-1.5 bg-black rounded-full"></div>}
                            </div>
                            {/* WCAG FIX: Use sr-only instead of hidden to allow keyboard focus */}
                            <input 
                                type="radio" 
                                name={`q-${q.id}`} 
                                checked={answer === optIdx} 
                                onChange={() => onAnswer(optIdx)} 
                                className="sr-only" 
                                disabled={showFeedback && isTwoWay} 
                            />
                            <span className="text-sm md:text-base font-medium dark:text-terminal-light"><MarkdownRenderer content={opt} /></span>
                        </label>
                    ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {q.type === QuestionType.CODING ? (
                            <div className="border-2 border-gray-300 dark:border-terminal-green/30 rounded overflow-hidden shadow-inner focus-within:ring-2 focus-within:ring-terminal-green">
                                <div className="bg-gray-100 dark:bg-[#151515] p-2 text-[10px] font-bold border-b dark:border-terminal-green/20 text-gray-500 dark:text-terminal-green/60 uppercase">Input Terminal</div>
                                <Editor
                                    value={String(answer)}
                                    onValueChange={code => onAnswer(code)}
                                    highlight={code => Prism.highlight(code, Prism.languages.javascript || Prism.languages.clike, 'javascript')}
                                    padding={15}
                                    style={{ fontFamily: 'Fira Code, monospace', fontSize: 13, minHeight: '180px', backgroundColor: 'transparent' }}
                                    disabled={showFeedback && isTwoWay}
                                    className="dark:text-terminal-light"
                                    textareaId={`code-input-${q.id}`}
                                />
                                <label htmlFor={`code-input-${q.id}`} className="sr-only">Code Answer</label>
                            </div>
                        ) : (
                            <textarea 
                                value={String(answer)} 
                                onChange={(e) => onAnswer(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-[#0c0c0c] border-2 border-gray-300 dark:border-terminal-green/30 p-4 font-mono focus:border-blue-500 dark:focus:border-terminal-green outline-none text-base md:text-lg rounded dark:text-terminal-light min-h-[140px] shadow-inner transition-colors"
                                disabled={showFeedback && isTwoWay}
                                placeholder="..."
                                aria-label="Short Answer Input"
                            />
                        )}
                    </div>
                )}
              </div>

              {showFeedback && (
                  <div role="alert" className={`mb-8 p-5 border-l-4 animate-fade-in ${isCorrect ? 'border-green-500 bg-green-500/5' : 'border-red-500 bg-red-500/5'}`}>
                      <h4 className={`font-bold mb-3 text-sm tracking-widest ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                          {isCorrect ? "✓ LOGIC VERIFIED" : "✕ LOGIC FAULT"}
                      </h4>
                      <MarkdownRenderer content={feedbackContent} />
                  </div>
              )}

              <div className="pt-6 border-t border-gray-200 dark:border-terminal-gray/30 flex items-center justify-between gap-4">
                   <button 
                        onClick={onPrev} 
                        disabled={isFirst || !isTwoWay && isGrading} 
                        className="p-3 rounded-full text-terminal-green hover:bg-terminal-green/10 disabled:opacity-0 transition-all active:scale-90"
                        aria-label="Previous Question"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                   </button>

                   <div className="flex gap-3">
                       {isTwoWay && !showFeedback && (
                          <button onClick={onCheck} disabled={isGrading || !!inputError} className="px-10 py-3 bg-terminal-green text-black font-bold hover:bg-terminal-dimGreen disabled:opacity-50 uppercase text-xs tracking-widest rounded transition-all shadow-lg active:scale-95">
                              {isGrading ? "Verifying..." : t('check', lang)}
                          </button>
                       )}
                       {isLast && (
                          <button onClick={onSubmit} disabled={!!inputError || isGrading} className="px-10 py-3 bg-terminal-green text-black font-bold hover:bg-terminal-dimGreen uppercase text-xs tracking-widest rounded shadow-lg active:scale-95">
                              {t('submit', lang)}
                          </button>
                       )}
                   </div>

                   <button 
                        onClick={onNext} 
                        disabled={isLast || isGrading} 
                        className="p-3 rounded-full text-terminal-green hover:bg-terminal-green/10 disabled:opacity-0 transition-all active:scale-90"
                        aria-label="Next Question"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                   </button>
              </div>
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

  const topRef = useRef<HTMLDivElement>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [currentFeedback, setCurrentFeedback] = useState<string>("");

  const currentQ = questions[currentIndex];
  const isOneWay = settings.mode === ExamMode.ONE_WAY;
  const isLastQuestion = currentIndex === questions.length - 1;

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
    if (topRef.current) {
        const yOffset = -120;
        const y = topRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({top: y, behavior: 'smooth'});
        topRef.current.focus(); // Set focus to top
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
  const jumpToQuestion = useCallback((index: number) => { if (!isOneWay && !isGrading) { setShowFeedback(false); setInputError(null); setCurrentIndex(index); scrollToTop(); } }, [isOneWay, isGrading, scrollToTop]);

  if (!currentQ) return <div className="p-8 text-center text-red-500 font-mono">ERROR: LOADING FAULT</div>;

  const currentAnswer = answers.get(currentQ.id)?.answer ?? "";
  const progressPercentage = Math.round((answers.size / questions.length) * 100);
  
  return (
    <div className={`flex flex-col h-full transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-5xl mx-auto'}`}>
      <div ref={topRef} className="scroll-mt-32 outline-none" tabIndex={-1}></div>

      {/* HEADER SECTION (Updates frequently due to timer) */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] font-bold font-mono mb-1 text-gray-500 dark:text-gray-400 tracking-widest uppercase">
          <span>Deployment Progress</span>
          <span>{progressPercentage}% [{answers.size}/{questions.length}]</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-terminal-gray h-1 border border-gray-300 dark:border-terminal-gray overflow-hidden">
          <div className="bg-terminal-green h-full transition-all duration-500 ease-out shadow-[0_0_8px_#00ff41]" style={{ width: `${progressPercentage}%` }}></div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 p-3 border border-gray-300 dark:border-terminal-green bg-white dark:bg-terminal-black shadow-sm gap-4 sticky top-[64px] z-20 backdrop-blur-sm">
         <div className="flex flex-wrap gap-1.5 justify-center rtl:flex-row-reverse" role="navigation" aria-label="Question Navigation">
            {questions.map((q, idx) => (
                <button
                    key={idx}
                    onClick={() => jumpToQuestion(idx)}
                    disabled={isOneWay || isGrading}
                    aria-label={`Go to Question ${idx + 1}`}
                    aria-current={idx === currentIndex ? 'true' : undefined}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${idx === currentIndex ? 'bg-terminal-green text-black border-terminal-green scale-110 shadow-lg' : answers.has(q.id) ? 'bg-gray-200 dark:bg-terminal-dimGreen text-black border-terminal-dimGreen' : 'bg-transparent text-gray-400 dark:text-terminal-green border-gray-300 dark:border-terminal-gray hover:border-terminal-green'}`}
                >
                    {lang === 'ar' ? toArabicNumerals(idx + 1) : idx + 1}
                </button>
            ))}
         </div>
        <div className={`text-lg font-mono ${settings.timeLimitMinutes > 0 && timeLeft < 60 ? 'text-terminal-alert animate-pulse' : 'text-terminal-green'}`} role="timer" aria-live={timeLeft < 60 ? "assertive" : "off"}>
           {t('time_remaining', lang)}: {settings.timeLimitMinutes > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : "∞"}
        </div>
      </div>

      {/* MEMOIZED QUESTION PANEL (Stable props prevent re-render on timer tick) */}
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
          onCheck={checkAnswerTwoWay}
          onSubmit={handleFinish}
          onNext={nextQuestion}
          onPrev={prevQuestion}
          isLast={isLastQuestion}
          isFirst={currentIndex === 0}
          lang={lang}
          inputError={inputError}
      />
    </div>
  );
};
