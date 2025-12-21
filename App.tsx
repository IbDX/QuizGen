
import React, { useState, useEffect } from 'react';
import { Layout, MobileAction, SystemStatus } from './components/Layout';
import { FileUpload } from './components/FileUpload';
import { ExamConfig } from './components/ExamConfig';
import { ExamBuilder } from './components/ExamBuilder';
import { ExamRunner } from './components/ExamRunner';
import { ExamReadyScreen } from './components/ExamReadyScreen';
import { Results } from './components/Results';
import { Leaderboard } from './components/Leaderboard';
import { QuestionLibrary } from './components/QuestionLibrary';
import { LoadingScreen } from './components/LoadingScreen';
import { ConfirmModal } from './components/ConfirmModal'; 
import { SettingsView } from './components/SettingsView';
import { ProfileModal } from './components/GamificationUI';
import { AppState, Question, ExamSettings, UserAnswer, QuestionType, ExamMode, QuestionFormatPreference, UILanguage, SavedExam, ThemeOption, UserProfile } from './types';
import { generateExam, generateExamFromWrongAnswers } from './services/gemini';
import { generateExamPDF } from './utils/pdfGenerator';
import { t } from './utils/translations';
import { saveToHistory } from './services/library';
import { monitor } from './services/monitor';
import { gamification } from './services/gamification';

const FONT_OPTIONS = [
    { name: 'Fira Code', value: "'Fira Code', monospace" },
    { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
    { name: 'Roboto Mono', value: "'Roboto Mono', monospace" },
    { name: 'Cairo (Arabic)', value: "'Cairo', sans-serif" },
    { name: 'Courier New', value: "'Courier New', Courier, monospace" },
];

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('UPLOAD');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [uploadedFiles, setUploadedFiles] = useState<Array<{base64: string; mime: string; name: string; hash: string}>>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<ExamSettings | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isFullWidth, setIsFullWidth] = useState(true); 
  const [preloadedExamTitle, setPreloadedExamTitle] = useState<string | undefined>(undefined);
  
  const [autoHideFooter, setAutoHideFooter] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<UILanguage>('en');
  
  // Visual Settings State (Lifted from Layout)
  const [theme, setTheme] = useState<ThemeOption>('dark');
  const [fontSize, setFontSize] = useState(16);
  const [useCustomCursor, setUseCustomCursor] = useState(true);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [autoHideHeader, setAutoHideHeader] = useState(false);
  const [enableBackgroundAnim, setEnableBackgroundAnim] = useState(false);

  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('ONLINE');
  
  // Gamification State
  const [userProfile, setUserProfile] = useState<UserProfile>(gamification.getProfile());

  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Global Interaction Tracking for Performance Monitor
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const label = target.innerText?.slice(0, 20) || target.tagName;
        monitor.log('INTERACTION', `Click: ${label}`);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Effect: Apply Theme Classes
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'theme-palestine', 'theme-cyberpunk', 'theme-synthwave');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else if (theme === 'palestine') document.documentElement.classList.add('dark', 'theme-palestine');
    else if (theme === 'cyberpunk') document.documentElement.classList.add('dark', 'theme-cyberpunk');
    else if (theme === 'synthwave') document.documentElement.classList.add('dark', 'theme-synthwave');
  }, [theme]);

  // Effect: Apply Font Settings
  useEffect(() => { document.documentElement.style.fontSize = `${fontSize}px`; }, [fontSize]);
  useEffect(() => { document.body.style.fontFamily = fontFamily; }, [fontFamily]);

  useEffect(() => {
    document.documentElement.dir = uiLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (appState === 'EXAM') {
        const message = t('exit_exam_warning_body', uiLanguage);
        event.preventDefault();
        event.returnValue = message; 
        return message; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [appState, uiLanguage]);

  const confirmAndNavigate = (navigationAction: () => void) => {
    if (appState === 'EXAM' || appState === 'BUILDER') {
      setConfirmModalState({
        isOpen: true,
        title: t('exit_exam_warning_title', uiLanguage),
        message: t('exit_exam_warning_body', uiLanguage),
        onConfirm: () => {
          navigationAction();
          setConfirmModalState({ ...confirmModalState, isOpen: false });
        },
      });
    } else {
      navigationAction();
    }
  };
  
  const handleCancelExit = () => {
      setConfirmModalState({ ...confirmModalState, isOpen: false });
  };

  const handleQuotaError = () => {
      setSystemStatus('QUOTA_LIMIT');
  };

  const handleFilesAccepted = (files: Array<{base64: string; mime: string; name: string; hash: string}>) => {
    const uniqueBatch: typeof files = [];
    const seenHashes = new Set<string>();
    const duplicates: string[] = [];

    files.forEach(f => {
        if (seenHashes.has(f.hash)) {
            duplicates.push(f.name);
        } else {
            seenHashes.add(f.hash);
            uniqueBatch.push(f);
        }
    });

    if (duplicates.length > 0) {
        setDuplicateFiles(duplicates);
    }

    setUploadedFiles(uniqueBatch);
    setPreloadedExamTitle(undefined);
    setAppState('CONFIG');
  };

  const handleAppendFiles = (newFiles: Array<{base64: string; mime: string; name: string; hash: string}>) => {
    setUploadedFiles(prev => {
      const existingHashes = new Set(prev.map(f => f.hash));
      const duplicateNames: string[] = [];
      
      const uniqueNewFiles = newFiles.filter(f => {
        if (existingHashes.has(f.hash)) {
          duplicateNames.push(f.name);
          return false;
        }
        return true;
      });

      if (duplicateNames.length > 0) {
        setDuplicateFiles(duplicateNames);
      }

      return [...prev, ...uniqueNewFiles];
    });
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setUploadedFiles(prev => {
      const updated = prev.filter((_, index) => index !== indexToRemove);
      if (updated.length === 0) {
        setAppState('UPLOAD');
      }
      return updated;
    });
  };

  const handleDemoLoad = () => {
      const content = `
# Z+ SYSTEM DIAGNOSTIC EVALUATION
# TARGET: MULTI-DISCIPLINARY ANALYSIS

## SECTION 1: C++ (TRACING)
Q1. Determine the exact output of the following pointer arithmetic code.
\`\`\`cpp
#include <iostream>
using namespace std;
int main() {
    int arr[] = {10, 20, 30};
    int *p = arr;
    p++;
    cout << *p << " " << p[-1];
    return 0;
}
\`\`\`

## SECTION 2: JAVASCRIPT (MCQ)
Q2. What is the result of the following loose equality check?
\`\`\`javascript
console.log(0 == '0');
\`\`\`
A. true
B. false
C. undefined
D. NaN

## SECTION 3: PYTHON (CODING)
Q3. Write a Python function \`merge_dicts(d1, d2)\` that merges two dictionaries. If a key appears in both, sum their values.
Example: d1={'a':10}, d2={'a':5, 'b':2} -> result={'a':15, 'b':2}

## SECTION 4: MATHEMATICS (GRAPH VISUALIZATION)
Q4. Visualize the intersection of a parabola and a line.
Plot the functions:
1. $f(x) = x^2 - 2$
2. $g(x) = x + 1$
Determine the visual intersection points in the domain [-3, 3].

## SECTION 5: SOFTWARE ENGINEERING (ARCHITECTURE DIAGRAM)
Q5. Design a "Authentication System" flow using a Sequence Diagram.
- User sends credentials to LoginController.
- LoginController validates with AuthService.
- AuthService checks Database.
- Database returns Result.
      `;
      const base64 = btoa(content);
      const demoFile = {
          base64: base64,
          mime: 'text/plain',
          name: 'diagnostic_demo.txt',
          hash: 'DEMO_HASH_V2_MULTI'
      };
      handleFilesAccepted([demoFile]);
  };
  
  const handleStartBuilder = () => {
      setAppState('BUILDER');
  };
  
  const handleBuilderExamGenerated = (generatedQuestions: Question[], builderSettings: Partial<ExamSettings>, title?: string) => {
      setQuestions(generatedQuestions);
      setSettings({
          timeLimitMinutes: builderSettings.timeLimitMinutes || 0,
          mode: builderSettings.mode || ExamMode.ONE_WAY,
          formatPreference: QuestionFormatPreference.MIXED,
          outputLanguage: 'en',
      });
      if (title) setPreloadedExamTitle(title);
      setAppState('EXAM');
  };

  const handleStartExam = async (examSettings: ExamSettings) => {
    setSettings(examSettings);
    setSystemStatus('ONLINE'); 

    if (preloadedExamTitle) {
        setAppState('EXAM');
        return;
    }

    if (uploadedFiles.length === 0) return;
    setAppState('GENERATING');
    setLoadingMsg(uiLanguage === 'ar' 
        ? `جاري التحليل... ${uploadedFiles.length} ملفات...` 
        : `ESTABLISHING NEURAL LINK... ANALYZING ${uploadedFiles.length} SOURCE DOCUMENT(S)...`
    );

    try {
      const filePayloads = uploadedFiles.map(f => ({ base64: f.base64, mimeType: f.mime }));
      
      const minDelayPromise = new Promise(resolve => setTimeout(resolve, 15000));
      const generationPromise = generateExam(
          filePayloads, 
          examSettings.formatPreference, 
          examSettings.outputLanguage, 
          examSettings.instructions
      );

      const [_, generatedQuestions] = await Promise.all([
          minDelayPromise,
          generationPromise
      ]);
      
      if (generatedQuestions.length === 0) throw new Error("No questions generated");
      
      setQuestions(generatedQuestions);
      setAppState('EXAM_READY');

    } catch (e: any) {
      console.error(e);
      const isQuota = 
          e.message === "429_RATE_LIMIT" || 
          e.message?.includes('429') || 
          e.message?.toLowerCase().includes('quota') ||
          e.message?.toLowerCase().includes('resource_exhausted') ||
          e.status === 429 ||
          e.code === 429;

      if (isQuota) {
          handleQuotaError();
          alert(uiLanguage === 'ar' 
              ? "⚠️ النظام مشغول جداً (تجاوز الحصة). يرجى الانتظار دقيقة والمحاولة لاحقاً." 
              : "⚠️ HIGH TRAFFIC: System quota exceeded. Please wait 1 minute and try again.");
      } else {
          alert('Failed to generate exam. Please try different files or simpler instructions.');
      }
      setAppState('CONFIG');
    }
  };

  const handleExamComplete = (answers: UserAnswer[]) => {
    setUserAnswers(answers);
    const title = preloadedExamTitle || `Auto-Saved Exam ${new Date().toLocaleTimeString()}`;
    saveToHistory(questions, title);
    setAppState('RESULTS');
  };

  const handleRestart = () => {
    setAppState('UPLOAD');
    setUploadedFiles([]);
    setQuestions([]);
    setSettings(null);
    setUserAnswers([]);
    setIsLibraryOpen(false);
    setIsSettingsOpen(false);
    setPreloadedExamTitle(undefined);
    setSystemStatus('ONLINE');
  };

  const handleRetake = () => {
    setUserAnswers([]);
    setAppState('EXAM');
  };
  
  const handleLoadSavedExam = (exam: SavedExam) => {
      setQuestions(exam.questions);
      setPreloadedExamTitle(exam.title);
      setUploadedFiles([]);
      setUserAnswers([]);
      setIsLibraryOpen(false);
      setAppState('CONFIG');
  };

  const handleRemediation = async (wrongIds: string[]) => {
    setAppState('GENERATING');
    setSystemStatus('ONLINE');
    setLoadingMsg(uiLanguage === 'ar' ? 'تحليل نقاط الضعف...' : 'ANALYZING FAILURE POINTS... GENERATING TACTICAL REMEDIATION EXAM...');
    try {
      const newQuestions = await generateExamFromWrongAnswers(questions, wrongIds);
      setQuestions(newQuestions);
      setUserAnswers([]);
      setPreloadedExamTitle(undefined);
      setAppState('EXAM');
    } catch (e: any) {
       console.error(e);
       const isQuota = 
            e.message?.includes('429') || 
            e.message?.toLowerCase().includes('quota') ||
            e.message?.toLowerCase().includes('resource_exhausted') ||
            e.status === 429;

       if (isQuota) {
           handleQuotaError();
       }
       alert('Failed to generate remediation exam.');
       setAppState('RESULTS');
    }
  };

  const handleDownloadPDF = () => {
     let correctCount = 0;
     const calculatedAnswers = questions.map(q => {
        const ua = userAnswers.find(a => a.questionId === q.id);
        let isCorrect = false;
        if (ua) {
            if (q.type === QuestionType.MCQ) isCorrect = ua.answer === q.correctOptionIndex;
            else if (q.type === QuestionType.TRACING) isCorrect = String(ua.answer).trim().toLowerCase() === String(q.tracingOutput || "").trim().toLowerCase();
            else if (q.type === QuestionType.CODING) isCorrect = !!ua.isCorrect;
        }
        if(isCorrect) correctCount++;
        return isCorrect;
     });
     const score = Math.round((correctCount / questions.length) * 100);
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
     generateExamPDF(questions, score, getGrade(score), userProfile.username);
  };
  
  const handleToggleLibrary = () => {
      if (!isLibraryOpen) setIsSettingsOpen(false); // Close settings if opening lib
      setIsLibraryOpen(prev => !prev);
  };

  const handleToggleSettings = () => {
      if (!isSettingsOpen) setIsLibraryOpen(false); // Close lib if opening settings
      setIsSettingsOpen(prev => !prev);
  };

  const getMobileActions = (): MobileAction[] => {
      if (appState === 'UPLOAD') {
          return [
              { label: "AI EXAM BUILDER", onClick: handleStartBuilder, variant: 'primary' },
              { label: t('load_demo', uiLanguage), onClick: handleDemoLoad, variant: 'default' }
          ];
      }
      if (appState === 'BUILDER') {
           return [
              { label: t('cancel_action', uiLanguage), onClick: () => confirmAndNavigate(handleRestart), variant: 'warning' }
           ];
      }
      if (appState === 'RESULTS') {
          const wrongIds = questions.filter(q => {
             const ua = userAnswers.find(a => a.questionId === q.id);
             if (!ua) return true;
             if (q.type === QuestionType.MCQ) return ua.answer !== q.correctOptionIndex;
             if (q.type === QuestionType.TRACING) return String(ua.answer).trim().toLowerCase() === String(q.tracingOutput || "").trim().toLowerCase();
             if (q.type === QuestionType.CODING) return !ua.isCorrect;
             return true;
          }).map(q => q.id);

          const actions: MobileAction[] = [
             { label: t('pdf_report', uiLanguage), onClick: handleDownloadPDF, variant: 'warning' },
             { label: t('retake', uiLanguage), onClick: handleRetake, variant: 'primary' },
             { label: t('restart', uiLanguage), onClick: handleRestart, variant: 'default' }
          ];

          if (wrongIds.length > 0) {
              actions.unshift({ 
                  label: `${t('remediate', uiLanguage)} (${wrongIds.length})`, 
                  onClick: () => handleRemediation(wrongIds),
                  variant: 'purple'
              });
          }
          return actions;
      }
      return [];
  };

  return (
    <Layout 
      onHome={() => confirmAndNavigate(handleRestart)}
      onToggleLibrary={handleToggleLibrary}
      isLibraryOpen={isLibraryOpen}
      onToggleSettings={handleToggleSettings}
      isSettingsOpen={isSettingsOpen}
      isFullWidth={isFullWidth} 
      onToggleFullWidth={() => setIsFullWidth(!isFullWidth)}
      autoHideFooter={autoHideFooter}
      onToggleAutoHideFooter={() => setAutoHideFooter(!autoHideFooter)}
      mobileActions={getMobileActions()}
      uiLanguage={uiLanguage}
      onSetUiLanguage={setUiLanguage}
      forceStaticHeader={appState === 'UPLOAD'}
      systemStatus={systemStatus}
      // Visual Props
      theme={theme}
      autoHideHeader={autoHideHeader}
      enableBackgroundAnim={enableBackgroundAnim}
      useCustomCursor={useCustomCursor}
      // Gamification Props
      userProfile={userProfile}
      onOpenProfile={() => setIsProfileOpen(true)}
    >
      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onCancel={handleCancelExit}
        lang={uiLanguage}
      />

      {isProfileOpen && (
          <ProfileModal 
            profile={userProfile} 
            onClose={() => setIsProfileOpen(false)} 
            onUpdate={setUserProfile}
          />
      )}

      {duplicateFiles.length > 0 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white dark:bg-gray-900 border-2 border-red-500 p-6 max-w-md w-full shadow-[0_0_30px_rgba(239,68,68,0.4)] relative">
                  <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <h3 className="font-bold text-xl uppercase tracking-wider">File Conflict</h3>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-4 font-mono text-sm leading-relaxed">
                      The following files are already present in the system or were duplicated in your selection and have been skipped:
                  </p>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 mb-6 max-h-40 overflow-y-auto custom-scrollbar">
                      <ul className="space-y-1">
                          {duplicateFiles.map((name, i) => (
                              <li key={i} className="text-red-600 dark:text-red-400 text-xs font-mono font-bold flex items-center gap-2">
                                  <span>•</span>
                                  <span className="truncate">{name}</span>
                              </li>
                          ))}
                      </ul>
                  </div>
                  <button onClick={() => setDuplicateFiles([])} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest transition-colors">
                      ACKNOWLEDGE
                  </button>
              </div>
          </div>
      )}

      {isLibraryOpen && (
          <QuestionLibrary 
            isFullWidth={isFullWidth} 
            onLoadExam={handleLoadSavedExam} 
            lang={uiLanguage}
          />
      )}

      {isSettingsOpen && (
          <SettingsView
              isFullWidth={isFullWidth}
              onToggleFullWidth={() => setIsFullWidth(!isFullWidth)}
              theme={theme}
              setTheme={setTheme}
              uiLanguage={uiLanguage}
              setUiLanguage={setUiLanguage}
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
              fontSize={fontSize}
              setFontSize={setFontSize}
              autoHideHeader={autoHideHeader}
              setAutoHideHeader={setAutoHideHeader}
              enableBackgroundAnim={enableBackgroundAnim}
              setEnableBackgroundAnim={setEnableBackgroundAnim}
              useCustomCursor={useCustomCursor}
              setUseCustomCursor={setUseCustomCursor}
              onClose={() => setIsSettingsOpen(false)}
              userProfile={userProfile}
          />
      )}

      <div className={isLibraryOpen || isSettingsOpen ? 'hidden' : ''}>
          {appState === 'UPLOAD' && (
            <>
              <FileUpload 
                onFilesAccepted={handleFilesAccepted} 
                onLoadDemo={handleDemoLoad}
                onStartBuilder={handleStartBuilder}
                isFullWidth={isFullWidth}
                lang={uiLanguage}
                isActive={appState === 'UPLOAD'}
              />
              <Leaderboard lang={uiLanguage}/>
            </>
          )}

          {appState === 'CONFIG' && (uploadedFiles.length > 0 || preloadedExamTitle) && (
            <ExamConfig 
                onStart={handleStartExam} 
                onRemoveFile={handleRemoveFile}
                onAppendFiles={handleAppendFiles}
                files={uploadedFiles}
                isFullWidth={isFullWidth}
                lang={uiLanguage}
                isActive={appState === 'CONFIG'}
                preloadedTitle={preloadedExamTitle}
            />
          )}

          {appState === 'BUILDER' && (
              <ExamBuilder 
                  onExamGenerated={handleBuilderExamGenerated}
                  onCancel={() => confirmAndNavigate(handleRestart)}
                  isFullWidth={isFullWidth}
                  lang={uiLanguage}
                  onQuotaError={handleQuotaError}
              />
          )}

          {appState === 'GENERATING' && (
            <LoadingScreen 
                message={loadingMsg} 
                files={uploadedFiles}
                lang={uiLanguage}
            />
          )}

          {appState === 'EXAM_READY' && settings && (
              <ExamReadyScreen 
                  questions={questions}
                  settings={settings}
                  title={preloadedExamTitle}
                  onStart={() => setAppState('EXAM')}
                  lang={uiLanguage}
              />
          )}

          {appState === 'EXAM' && settings && (
            <ExamRunner 
              questions={questions} 
              settings={settings} 
              onComplete={handleExamComplete} 
              isFullWidth={isFullWidth}
              lang={uiLanguage}
            />
          )}

          {appState === 'RESULTS' && (
            <Results 
              questions={questions} 
              answers={userAnswers} 
              onRestart={handleRestart}
              onRetake={handleRetake}
              onGenerateRemediation={handleRemediation}
              onDownloadPDF={handleDownloadPDF}
              isFullWidth={isFullWidth}
              autoHideFooter={autoHideFooter}
              lang={uiLanguage}
              onQuotaError={handleQuotaError}
              userProfile={userProfile}
              onUpdateProfile={setUserProfile}
            />
          )}
      </div>
    </Layout>
  );
};

export default App;
