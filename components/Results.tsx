
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Question, UserAnswer, QuestionType, UILanguage, LeaderboardEntry, UserProfile } from '../types';
import { t } from '../utils/translations';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeWindow } from './CodeWindow';
import { GraphRenderer } from './GraphRenderer';
import { DiagramRenderer } from './DiagramRenderer';
import { saveFullExam, triggerExamDownload } from '../services/library';
import { gradeCodingAnswer, gradeShortAnswer } from '../services/gemini';
import { gamification } from '../services/gamification';
import { LevelUpOverlay } from './LevelUpOverlay';

interface ResultsProps {
    questions: Question[];
    answers: UserAnswer[];
    onRestart: () => void;
    onRetake: () => void;
    onGenerateRemediation: (ids: string[]) => void;
    onDownloadPDF: () => void;
    isFullWidth: boolean;
    autoHideFooter: boolean;
    lang: UILanguage;
    onQuotaError: () => void;
    userProfile?: UserProfile;
    onUpdateProfile?: (p: UserProfile) => void;
}

// OPTIMIZATION: Memoized Result Item
const ResultItem = React.memo(({ q, ua, lang, realIndex, viewMode }: { q: Question, ua?: UserAnswer, lang: UILanguage, realIndex: number, viewMode: 'ERRORS_ONLY' | 'ALL' }) => {
    let isCorrect = false;
    let userAnswerDisplay = t('no_answer_provided', lang);
    let statusClass = 'border-gray-300 dark:border-gray-700 opacity-50'; 

    if (ua) {
        userAnswerDisplay = String(ua.answer);
        if (q.type === QuestionType.MCQ && typeof ua.answer === 'number' && q.options && q.options.length > 0) {
            userAnswerDisplay = q.options[ua.answer] || String(ua.answer);
        }

        if(ua.isCorrect !== undefined) {
            isCorrect = ua.isCorrect;
        } else if (q.type === QuestionType.MCQ && typeof ua.answer === 'number') {
            if(ua.answer === q.correctOptionIndex) isCorrect = true;
        } else if (q.type === QuestionType.TRACING) {
            if(String(ua.answer).trim().toLowerCase() === String(q.tracingOutput||"").trim().toLowerCase()) isCorrect = true;
        }
        
        statusClass = isCorrect 
            ? 'border-green-500 bg-green-50 dark:bg-green-900/10' 
            : 'border-red-500 bg-red-50 dark:bg-red-900/10';
    } else {
        statusClass = 'border-red-500 bg-red-50 dark:bg-red-900/10';
    }

    return (
        <div className={`border-l-4 p-6 bg-white dark:bg-terminal-black shadow-md ${statusClass} transition-all`}>
            <div className="flex justify-between items-start mb-4">
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                    {isCorrect ? t('passed', lang) : t('failed', lang)}
                </span>
                <span className="text-xs font-mono text-gray-500">#{realIndex + 1} [{q.type}] {q.topic && `• ${q.topic}`}</span>
            </div>

            <div className="mb-4 text-gray-800 dark:text-gray-200">
                <MarkdownRenderer content={q.text} />
            </div>

            {q.graphConfig && <div className="mb-4 opacity-80 pointer-events-none scale-90 origin-left"><GraphRenderer config={q.graphConfig} /></div>}
            {q.diagramConfig && <div className="mb-4 opacity-80 pointer-events-none scale-90 origin-left"><DiagramRenderer code={q.diagramConfig.code} /></div>}
            {q.visual && <img src={`data:image/png;base64,${q.visual}`} className="max-h-32 border rounded mb-4" alt="Visual" />}
            {q.codeSnippet && <div className="mb-4 opacity-80 text-xs"><CodeWindow code={q.codeSnippet} /></div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div>
                    <h4 className="font-bold text-gray-500 text-xs uppercase mb-1">{t('your_input', lang)}:</h4>
                    <div className={`font-mono p-2 rounded border bg-white dark:bg-black ${isCorrect ? 'border-green-200' : 'border-red-200'}`}>
                        <MarkdownRenderer content={userAnswerDisplay} />
                    </div>
                </div>
                
                {(!isCorrect || viewMode === 'ALL') && (
                    <div>
                        <h4 className="font-bold text-gray-500 text-xs uppercase mb-1">{t('analysis', lang)}:</h4>
                        <div className="text-gray-600 dark:text-gray-300">
                            {q.type === QuestionType.MCQ && q.options && q.options.length > 0 && q.correctOptionIndex !== undefined && q.options[q.correctOptionIndex] && (
                                <MarkdownRenderer 
                                    content={`**Correct:** ${q.options[q.correctOptionIndex]}`} 
                                    className="!text-green-700 dark:!text-green-500 mb-1"
                                />
                            )}
                            {q.type === QuestionType.TRACING && (
                                <MarkdownRenderer 
                                    content={`**Expected:** ${q.tracingOutput}`} 
                                    className="!text-green-700 dark:!text-green-500 mb-1"
                                />
                            )}
                            <MarkdownRenderer content={q.explanation} />
                            {ua?.feedback && (
                                <div className="mt-2 pt-2 border-t border-dashed border-gray-300 text-xs italic opacity-80">
                                    AI Feedback: {ua.feedback}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export const Results: React.FC<ResultsProps> = ({ 
    questions, answers, onRestart, onRetake, onGenerateRemediation, onDownloadPDF, isFullWidth, autoHideFooter, lang, onQuotaError,
    userProfile, onUpdateProfile
}) => {
  // Grading State
  const [isGradingPhase, setIsGradingPhase] = useState(true);
  const [gradingProgress, setGradingProgress] = useState({ current: 0, total: 0 });
  const [finalAnswers, setFinalAnswers] = useState<UserAnswer[]>([]);
  
  // Results State
  const [score, setScore] = useState(0);
  const [isElite, setIsElite] = useState(false);
  const [viewMode, setViewMode] = useState<'ERRORS_ONLY' | 'ALL'>('ERRORS_ONLY'); 
  const [savedToLeaderboard, setSavedToLeaderboard] = useState(false);
  const [wrongQuestionIds, setWrongQuestionIds] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Gamification Reward State
  const [rewards, setRewards] = useState<any>(null);
  const [showRewards, setShowRewards] = useState(false);
  const [processedRewards, setProcessedRewards] = useState(false);

  // Helper to determine if a question requires AI grading
  const isSubjectiveQuestion = (q: Question) => {
      // 1. Coding is always subjective
      if (q.type === QuestionType.CODING) return true;
      // 2. Explicit Short Answer
      if (q.type === QuestionType.SHORT_ANSWER) return true;
      // 3. "Fake MCQ" -> Type is MCQ but has no options (Text Input)
      if (q.type === QuestionType.MCQ && (!q.options || q.options.length === 0)) return true;
      
      return false;
  };

  // 1. Post-Processing Grading Loop
  useEffect(() => {
      const runGrading = async () => {
          // Identify questions needing AI grading that haven't been graded yet
          const pendingGrading = questions.filter(q => {
              const ua = answers.find(a => a.questionId === q.id);
              // Must have an answer provided to grade
              if (!ua) return false; 
              // Skip if already graded (e.g. Two-Way mode check)
              if (ua.isCorrect !== undefined) return false;
              
              // Check if it's a type that needs AI
              return isSubjectiveQuestion(q);
          });

          if (pendingGrading.length === 0) {
              setFinalAnswers(answers);
              setIsGradingPhase(false);
              return;
          }

          setGradingProgress({ current: 0, total: pendingGrading.length });
          const updatedAnswers = [...answers];

          for (let i = 0; i < pendingGrading.length; i++) {
              const q = pendingGrading[i];
              const uaIndex = updatedAnswers.findIndex(a => a.questionId === q.id);
              const ua = updatedAnswers[uaIndex];

              // Skip empty answers locally to save API calls
              if (!String(ua.answer).trim()) {
                  updatedAnswers[uaIndex] = { ...ua, isCorrect: false, feedback: t('no_answer_provided', lang) };
              } else {
                  try {
                      let result;
                      if (q.type === QuestionType.CODING) {
                          result = await gradeCodingAnswer(q, String(ua.answer), lang);
                      } else {
                          // Handles Short Answer AND Fake MCQs
                          result = await gradeShortAnswer(q, String(ua.answer), lang);
                      }
                      updatedAnswers[uaIndex] = { ...ua, isCorrect: result.isCorrect, feedback: result.feedback };
                  } catch (e: any) {
                      console.error("Grading error", e);
                      if (e.message?.includes('429') || e.message?.toLowerCase().includes('quota')) {
                          onQuotaError();
                      }
                      updatedAnswers[uaIndex] = { ...ua, isCorrect: false, feedback: "System Error: Automated grading failed." };
                  }
              }
              
              setGradingProgress({ current: i + 1, total: pendingGrading.length });
          }

          setFinalAnswers(updatedAnswers);
          setIsGradingPhase(false);
      };

      runGrading();
  }, [questions, answers, lang]);

  // 2. Score Calculation (Runs only after grading is complete)
  useEffect(() => {
    if (isGradingPhase) return;

    let correctCount = 0;
    const wrongIds: string[] = [];

    questions.forEach(q => {
        const ua = finalAnswers.find(a => a.questionId === q.id);
        let isCorrect = false;

        if (ua) {
            // Priority: If AI graded it (has isCorrect boolean), trust it.
            if (ua.isCorrect !== undefined) {
                isCorrect = ua.isCorrect;
            } else {
                // Fallback for Deterministic types (Standard MCQ / Tracing)
                if (q.type === QuestionType.MCQ) {
                    if (typeof ua.answer === 'number' && ua.answer === q.correctOptionIndex) {
                        isCorrect = true;
                    }
                } else if (q.type === QuestionType.TRACING) {
                    const userTxt = String(ua.answer).trim().toLowerCase();
                    const correctTxt = String(q.tracingOutput || "").trim().toLowerCase();
                    if (userTxt === correctTxt) isCorrect = true;
                }
            }
        }
        
        if (isCorrect) correctCount++;
        else wrongIds.push(q.id);
    });

    const calculatedScore = Math.round((correctCount / questions.length) * 100);
    setScore(calculatedScore);
    setIsElite(calculatedScore === 100);
    setWrongQuestionIds(wrongIds);
    
    if (calculatedScore === 100) {
        setViewMode('ALL');
    }

    // 3. Process Gamification (Once per load)
    if (!processedRewards && onUpdateProfile) {
        const result = gamification.processExamResult(calculatedScore, questions.length, correctCount);
        onUpdateProfile(result.profile);
        setRewards(result);
        setShowRewards(true);
        setProcessedRewards(true);
    }

    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isGradingPhase, finalAnswers, questions]);

  // --- RENDERING HELPERS ---
  
  const getGrade = (s: number) => {
      if (s >= 97) return 'Z+';
      if (s >= 93) return 'A';
      if (s >= 90) return 'A-';
      if (s >= 87) return 'B+';
      if (s >= 83) return 'B';
      if (s >= 80) return 'B-';
      if (s >= 77) return 'C+';
      if (s >= 73) return 'C';
      if (s >= 70) return 'C-';
      if (s >= 67) return 'D+';
      if (s >= 63) return 'D';
      if (s >= 60) return 'D-';
      return 'F';
  };

  const grade = getGrade(score);
  const passed = score >= 60;
  const canPublish = grade !== 'F';

  const handleSaveScore = () => {
      const agentName = userProfile?.username || "AGENT";
      const newEntry: LeaderboardEntry = {
          name: agentName.slice(0, 10).toUpperCase(),
          score: score,
          date: new Date().toISOString(),
          isElite: isElite
      };
      const stored = localStorage.getItem('exam_leaderboard');
      const leaderboard = stored ? JSON.parse(stored) : [];
      localStorage.setItem('exam_leaderboard', JSON.stringify([...leaderboard, newEntry]));
      setSavedToLeaderboard(true);
  };

  const handleSaveExam = () => {
      saveFullExam(questions, `Exam Result: ${score}% (${new Date().toLocaleDateString()})`);
      setSaveStatus(t('saved', lang));
      setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleDownloadExam = async () => {
      await triggerExamDownload(questions, `Exam_Result_${score}_${Date.now()}`);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const weakTopics = useMemo(() => {
      if (wrongQuestionIds.length === 0) return [];
      const topics = new Set<string>();
      questions.forEach(q => {
          if (wrongQuestionIds.includes(q.id) && q.topic) {
              topics.add(q.topic);
          }
      });
      return Array.from(topics);
  }, [wrongQuestionIds, questions]);

  // Loading Screen for Grading
  if (isGradingPhase) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-fade-in">
              <div className="w-16 h-16 border-4 border-terminal-green border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                  <h2 className="text-xl font-bold font-mono text-terminal-green mb-2">
                      {lang === 'ar' ? 'جاري تقييم الإجابات...' : 'ANALYZING SUBMISSIONS...'}
                  </h2>
                  <p className="text-gray-500 font-mono text-sm">
                      {lang === 'ar' ? 'استخدام الذكاء الاصطناعي لتقدير الأسئلة المقالية والبرمجية.' : 'Using Neural Core to grade coding & short answers.'}
                  </p>
                  <div className="mt-4 bg-gray-200 dark:bg-gray-800 rounded-full h-2 w-64 overflow-hidden mx-auto">
                      <div 
                          className="bg-blue-600 dark:bg-terminal-green h-full transition-all duration-300"
                          style={{ width: `${(gradingProgress.current / (gradingProgress.total || 1)) * 100}%` }}
                      ></div>
                  </div>
                  <p className="mt-2 text-xs font-mono text-gray-400">
                      {gradingProgress.current} / {gradingProgress.total}
                  </p>
              </div>
          </div>
      );
  }

  const displayedQuestions = viewMode === 'ALL' 
      ? questions 
      : questions.filter(q => wrongQuestionIds.includes(q.id));

  return (
    <div className={`mx-auto transition-all duration-300 animate-fade-in pb-12 ${isFullWidth ? 'max-w-none w-full' : 'max-w-4xl'}`}>
        
        {/* REWARDS OVERLAY */}
        {showRewards && rewards && (
            <LevelUpOverlay 
                xpGained={rewards.xpGained}
                streakBonus={rewards.streakBonus}
                leveledUp={rewards.leveledUp}
                newLevel={rewards.profile.level}
                newBadges={rewards.newBadges}
                onClose={() => setShowRewards(false)}
            />
        )}

        {/* HERO SECTION */}
        <div className={`
            relative overflow-hidden rounded-lg shadow-2xl p-8 md:p-12 mb-8 text-center border-b-8
            ${passed 
                ? 'bg-gradient-to-br from-white to-gray-100 dark:from-terminal-black dark:to-[#0a1a0a] border-green-500' 
                : 'bg-gradient-to-br from-white to-gray-100 dark:from-terminal-black dark:to-[#1a0a0a] border-red-500'
            }
        `}>
            {/* ... Hero Content ... */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-400 dark:via-white/20 to-transparent opacity-50"></div>
            
            {grade === 'Z+' && (
                <div className="absolute top-4 right-4 animate-bounce">
                    <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg border border-yellow-200">
                        🏆 Z+ ELITE AGENT
                    </span>
                </div>
            )}

            <h2 className="text-sm font-bold font-mono text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-4">
                {t('assessment_complete', lang)}
            </h2>

            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 mb-8">
                {/* Grade Circle */}
                <div className="relative w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200 dark:text-gray-800" />
                        <circle 
                            cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="8" fill="transparent" 
                            className={`${passed ? 'text-green-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                            strokeDasharray="283"
                            strokeDashoffset={283 - (283 * score) / 100}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className={`text-4xl md:text-5xl font-black ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                             {grade}
                         </span>
                         <span className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-1">{score}%</span>
                    </div>
                </div>

                {/* Text Summary */}
                <div className="text-left space-y-2">
                    <div className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
                        {passed ? (grade === 'Z+' ? t('perfection', lang) : t('passed', lang)) : t('critical_failure', lang)}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                        {passed 
                            ? "System criteria met. Knowledge verification successful. Neural link stable."
                            : "Performance below threshold. Remedial training protocols recommended."
                        }
                    </p>
                </div>
            </div>

            {/* Leaderboard Input */}
            {!savedToLeaderboard && (
                <div className="max-w-sm mx-auto flex gap-2 animate-fade-in-up relative justify-center">
                    {canPublish ? (
                        <button 
                            onClick={handleSaveScore}
                            className="bg-blue-600 dark:bg-terminal-green text-white dark:text-black font-bold px-6 py-3 rounded hover:opacity-90 disabled:opacity-50 transition-all uppercase text-sm shadow-lg w-full"
                        >
                            {t('publish', lang)}
                        </button>
                    ) : (
                        <div className="w-full p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 font-bold text-xs uppercase tracking-wider rounded">
                            🚫 {t('score_too_low', lang)}
                        </div>
                    )}
                </div>
            )}
            {savedToLeaderboard && (
                <div className="text-green-500 font-mono font-bold text-sm tracking-widest animate-pulse">
                     ✓ {t('published', lang)}
                </div>
            )}
        </div>

        {/* TOP ACTIONS GRID (5 Columns) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <button onClick={handleSaveExam} className="p-3 bg-gray-100 dark:bg-[#111] hover:bg-gray-200 dark:hover:bg-[#222] border border-gray-300 dark:border-gray-700 rounded text-gray-700 dark:text-terminal-green font-bold text-[10px] md:text-xs uppercase tracking-wider transition-colors">
                {saveStatus || t('save', lang)}
            </button>
            <button onClick={onDownloadPDF} className="p-3 bg-gray-100 dark:bg-[#111] hover:bg-gray-200 dark:hover:bg-[#222] border border-gray-300 dark:border-gray-700 rounded text-gray-700 dark:text-terminal-green font-bold text-[10px] md:text-xs uppercase tracking-wider transition-colors">
                {t('pdf_report', lang)}
            </button>
            <button onClick={handleDownloadExam} className="p-3 bg-gray-100 dark:bg-[#111] hover:bg-gray-200 dark:hover:bg-[#222] border border-gray-300 dark:border-gray-700 rounded text-gray-700 dark:text-terminal-green font-bold text-[10px] md:text-xs uppercase tracking-wider transition-colors">
                {t('download_zplus', lang)}
            </button>
            <button onClick={onRestart} className="p-3 bg-gray-100 dark:bg-[#111] hover:bg-gray-200 dark:hover:bg-[#222] border border-gray-300 dark:border-gray-700 rounded text-gray-700 dark:text-terminal-green font-bold text-[10px] md:text-xs uppercase tracking-wider transition-colors">
                {t('restart', lang)}
            </button>
            <button onClick={onRetake} className="p-3 bg-blue-50 dark:bg-[#111] hover:bg-blue-100 dark:hover:bg-[#222] border border-blue-200 dark:border-gray-700 rounded text-blue-700 dark:text-terminal-green font-bold text-[10px] md:text-xs uppercase tracking-wider transition-colors">
                {t('retake', lang)}
            </button>
        </div>

        {/* WEAK POINTS SECTION (Dynamic Links) */}
        {weakTopics.length > 0 && (
            <div className="mb-8 border-2 border-red-400 dark:border-red-900 bg-red-50 dark:bg-[#1a0505] p-6 rounded-lg shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h3 className="text-red-700 dark:text-red-500 font-bold text-lg uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span>⚠️</span> {t('weak_point_diagnostics', lang)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {weakTopics.map((topic, i) => (
                        <div key={i} className="bg-white dark:bg-black border border-red-200 dark:border-red-900/50 p-4 rounded flex flex-col gap-3 shadow-sm">
                            <span className="font-bold text-gray-800 dark:text-white uppercase text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                                {topic}
                            </span>
                            <div className="flex gap-2">
                                <a 
                                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(topic + ' tutorial')}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase text-center rounded transition-colors flex items-center justify-center gap-1"
                                >
                                    <span>📺</span> {t('watch_tutorial', lang)}
                                </a>
                                <a 
                                    href={`https://www.google.com/search?q=${encodeURIComponent(topic + ' documentation')}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-300 text-[10px] font-bold uppercase text-center rounded transition-colors flex items-center justify-center gap-1"
                                >
                                    <span>📖</span> {t('read_docs', lang)}
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
                {wrongQuestionIds.length > 0 && (
                    <button 
                        onClick={() => onGenerateRemediation(wrongQuestionIds)}
                        className="mt-6 w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest rounded shadow-md transition-all active:scale-95 text-xs"
                    >
                        {t('remediate', lang)} ({wrongQuestionIds.length})
                    </button>
                )}
            </div>
        )}

        {/* TOGGLE VIEW & LIST */}
        <div className="flex justify-between items-center mb-6 sticky top-20 z-20 bg-gray-200/95 dark:bg-[#151515]/95 backdrop-blur-md p-2 rounded border border-gray-300 dark:border-terminal-gray shadow-md">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 pl-2">
                {viewMode === 'ERRORS_ONLY' ? `${displayedQuestions.length} ISSUES FOUND` : `FULL REPORT (${questions.length} Q)`}
            </span>
            <button 
                onClick={() => setViewMode(prev => prev === 'ALL' ? 'ERRORS_ONLY' : 'ALL')}
                className={`px-4 py-2 rounded text-[10px] font-bold uppercase border transition-colors ${viewMode === 'ALL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent border-gray-400 text-gray-600 dark:text-gray-400 hover:border-gray-600'}`}
            >
                {viewMode === 'ALL' ? t('show_errors_only', lang) : t('show_full_exam', lang)}
            </button>
        </div>

        <div className="space-y-6">
            {displayedQuestions.map((q) => {
                const realIndex = questions.findIndex(orig => orig.id === q.id);
                const ua = finalAnswers.find(a => a.questionId === q.id);
                
                return <ResultItem key={q.id} q={q} ua={ua} lang={lang} realIndex={realIndex} viewMode={viewMode} />;
            })}
        </div>

        {/* Scroll To Top Button (Fixed Bottom Left) */}
        <button 
            onClick={scrollToTop}
            className={`fixed bottom-6 left-6 z-50 p-3 bg-gray-800 text-white dark:bg-terminal-green dark:text-black rounded-full shadow-lg hover:scale-110 transition-all duration-300 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
            title="Scroll to Top"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
        </button>
    </div>
  );
};
