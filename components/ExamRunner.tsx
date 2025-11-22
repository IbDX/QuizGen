import React, { useState, useEffect, useRef } from 'react';
import { Question, UserAnswer, ExamSettings, ExamMode, QuestionType } from '../types';
import { gradeCodingAnswer } from '../services/gemini';
import { CodeWindow } from './CodeWindow';
import { MarkdownRenderer } from './MarkdownRenderer';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';

interface ExamRunnerProps {
  questions: Question[];
  settings: ExamSettings;
  onComplete: (answers: UserAnswer[]) => void;
  isFullWidth: boolean;
}

export const ExamRunner: React.FC<ExamRunnerProps> = ({ questions, settings, onComplete, isFullWidth }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map());
  const [timeLeft, setTimeLeft] = useState(settings.timeLimitMinutes * 60);
  const [isGrading, setIsGrading] = useState(false);
  
  // Ref to track answers for timer closure
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // For Two Way Mode
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [currentFeedback, setCurrentFeedback] = useState<string>("");

  useEffect(() => {
    if (settings.timeLimitMinutes > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Use the ref current value to submit the latest answers
            onComplete(Array.from(answersRef.current.values()));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [settings.timeLimitMinutes, onComplete]);

  const handleFinish = () => {
    onComplete(Array.from(answers.values()));
  };

  const currentQ = questions[currentIndex];

  const handleAnswer = (value: string | number) => {
    setAnswers(prev => {
      const newMap = new Map(prev);
      newMap.set(currentQ.id, {
        questionId: currentQ.id,
        answer: value
      });
      return newMap;
    });
  };

  const checkAnswerTwoWay = async () => {
    setIsGrading(true);
    const userAnswer = answers.get(currentQ.id);
    
    if (!userAnswer) {
        // Show explanation even if no answer
        setCurrentFeedback(`No answer provided.\n\n**Analysis/Solution:**\n${currentQ.explanation}`);
        setShowFeedback(true);
        setIsGrading(false);
        return;
    }

    let feedback = "";
    let isCorrect = false;

    if (currentQ.type === QuestionType.MCQ) {
      isCorrect = userAnswer.answer === currentQ.correctOptionIndex;
      feedback = isCorrect ? "Correct!" : `Incorrect.\n${currentQ.explanation}`;
    } else if (currentQ.type === QuestionType.TRACING) {
      // Simple string match for tracing, normalized
      const userTxt = String(userAnswer.answer).trim().toLowerCase();
      const correctTxt = (currentQ.tracingOutput || "").trim().toLowerCase();
      isCorrect = userTxt === correctTxt;
      feedback = isCorrect ? "Correct!" : `Incorrect. Expected: \`${currentQ.tracingOutput}\`\n\n${currentQ.explanation}`;
    } else if (currentQ.type === QuestionType.CODING) {
      const result = await gradeCodingAnswer(currentQ, String(userAnswer.answer));
      isCorrect = result.isCorrect;
      feedback = result.feedback;
    }

    // Update answer with correctness
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
    setShowFeedback(false);
    setCurrentFeedback("");
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };
  
  const prevQuestion = () => {
    setShowFeedback(false);
    setCurrentFeedback("");
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const jumpToQuestion = (index: number) => {
    setShowFeedback(false);
    setCurrentFeedback("");
    setCurrentIndex(index);
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getAnswerValue = () => answers.get(currentQ.id)?.answer ?? "";

  return (
    <div className={`flex flex-col h-full transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-5xl mx-auto'}`}>
      {/* HUD */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 p-4 border border-gray-300 dark:border-terminal-dimGreen bg-white dark:bg-gray-900 shadow-sm gap-4">
         {/* Question Navigation Bar */}
         <div className="flex flex-wrap gap-2 justify-center">
            {questions.map((_, idx) => {
                const isAnswered = answers.has(questions[idx].id);
                const isCurrent = idx === currentIndex;
                return (
                    <button
                        key={idx}
                        onClick={() => jumpToQuestion(idx)}
                        className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all
                            ${isCurrent 
                                ? 'bg-blue-600 text-white border-blue-600 scale-110 shadow-lg' 
                                : isAnswered 
                                    ? 'bg-gray-200 dark:bg-terminal-dimGreen text-gray-700 dark:text-black border-gray-300 dark:border-terminal-green' 
                                    : 'bg-transparent text-gray-400 border-gray-300 dark:border-gray-700 hover:border-blue-400'
                            }
                        `}
                    >
                        {idx + 1}
                    </button>
                )
            })}
         </div>

        <div className={`text-xl font-mono whitespace-nowrap ${timeLeft < 60 ? 'text-red-500 animate-pulse' : ''}`}>
           TIME: {formatTime(timeLeft)}
        </div>
      </div>

      {/* Question Card */}
      <div className="flex-grow border border-gray-300 dark:border-terminal-green p-6 md:p-8 bg-white dark:bg-black relative overflow-hidden shadow-xl">
        <span className="absolute top-0 right-0 text-[10px] font-bold uppercase tracking-widest bg-gray-200 dark:bg-terminal-dimGreen text-black px-3 py-1">
            {currentQ.type}
        </span>
        
        <div className="mb-6">
             <span className="text-sm text-gray-500 dark:text-gray-400 font-mono block mb-2">QUESTION {currentIndex + 1}</span>
             <div className="text-xl md:text-2xl font-bold leading-relaxed text-gray-800 dark:text-gray-100">
               <MarkdownRenderer content={currentQ.text} className="inline-block" />
             </div>
        </div>

        {currentQ.codeSnippet && (
          <CodeWindow code={currentQ.codeSnippet} />
        )}

        {/* Inputs based on type */}
        <div className="mt-8 mb-8">
          {currentQ.type === QuestionType.MCQ && currentQ.options && (
            <div className="space-y-3">
              {currentQ.options.map((opt, idx) => (
                <label 
                  key={idx}
                  className={`flex items-center p-4 border cursor-pointer transition-colors group relative
                    ${getAnswerValue() === idx 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' 
                        : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
                    }
                  `}
                >
                   {/* Custom Radio UI */}
                  <div className={`
                        w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center flex-shrink-0 transition-colors
                        ${getAnswerValue() === idx 
                            ? 'border-blue-500' 
                            : 'border-gray-400 dark:border-gray-600 group-hover:border-blue-400'
                        }
                  `}>
                        {getAnswerValue() === idx && <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>}
                  </div>

                  <input 
                    type="radio" 
                    name={`q-${currentQ.id}`} 
                    checked={getAnswerValue() === idx} 
                    onChange={() => handleAnswer(idx)}
                    className="hidden"
                    disabled={showFeedback && settings.mode === ExamMode.TWO_WAY}
                  />
                  <span className="text-sm md:text-base">
                      <MarkdownRenderer content={opt} />
                  </span>
                </label>
              ))}
            </div>
          )}

          {currentQ.type === QuestionType.TRACING && (
             <div className="space-y-2">
                <label className="text-sm font-bold opacity-70 font-mono">> OUTPUT_TERMINAL:</label>
                <input 
                  type="text" 
                  value={getAnswerValue() as string} 
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="Type output..."
                  className="w-full bg-gray-50 dark:bg-[#0c0c0c] border border-gray-300 dark:border-gray-600 p-4 font-mono focus:border-blue-500 outline-none text-lg"
                  disabled={showFeedback && settings.mode === ExamMode.TWO_WAY}
                />
             </div>
          )}

          {currentQ.type === QuestionType.CODING && (
            <div className="space-y-2 border border-gray-300 dark:border-gray-700">
               <div className="bg-gray-200 dark:bg-gray-800 px-2 py-1 text-xs font-bold">EDITOR</div>
               <div className="min-h-[200px] bg-gray-50 dark:bg-[#0c0c0c]">
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
                    disabled={showFeedback && settings.mode === ExamMode.TWO_WAY}
                  />
               </div>
            </div>
          )}
        </div>

        {/* Two Way Feedback Area */}
        {showFeedback && (
            <div className={`mb-6 p-6 border-l-4 animate-fade-in ${answers.get(currentQ.id)?.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10'}`}>
                <h4 className={`font-bold mb-3 text-lg ${answers.get(currentQ.id)?.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {answers.get(currentQ.id)?.isCorrect ? "✓ CORRECT" : "✕ INCORRECT"}
                </h4>
                <MarkdownRenderer content={currentFeedback} />
            </div>
        )}

      </div>

      {/* Navigation Footer */}
      <div className="mt-6 flex justify-between gap-4">
        <button 
          onClick={prevQuestion} 
          disabled={currentIndex === 0}
          className="px-6 py-3 border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-800 font-bold text-sm"
        >
          &lt; PREV
        </button>

        <div className="flex gap-4">
            {settings.mode === ExamMode.TWO_WAY && !showFeedback && (
                <button
                    onClick={checkAnswerTwoWay}
                    disabled={isGrading}
                    className="px-6 py-3 bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-500/30 text-sm"
                >
                    {isGrading ? 'VALIDATING...' : 'CHECK ANSWER'}
                </button>
            )}

            {currentIndex === questions.length - 1 ? (
            <button 
                onClick={handleFinish}
                className="px-8 py-3 bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-500/30 text-sm tracking-wider"
            >
                SUBMIT EXAM
            </button>
            ) : (
            <button 
                onClick={nextQuestion}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-800 font-bold text-sm"
            >
                NEXT &gt;
            </button>
            )}
        </div>
      </div>
    </div>
  );
};