import React, { useState, useEffect } from 'react';
import { Layout, MobileAction } from './components/Layout';
import { FileUpload } from './components/FileUpload';
import { ExamConfig } from './components/ExamConfig';
import { ExamBuilder } from './components/ExamBuilder';
import { ExamRunner } from './components/ExamRunner';
import { Results } from './components/Results';
import { Leaderboard } from './components/Leaderboard';
import { QuestionLibrary } from './components/QuestionLibrary';
import { LoadingScreen } from './components/LoadingScreen';
import { ConfirmModal } from './components/ConfirmModal'; // Import the custom modal
import { AppState, Question, ExamSettings, UserAnswer, QuestionType, ExamMode, QuestionFormatPreference, UILanguage } from './types';
import { generateExam, generateExamFromWrongAnswers } from './services/gemini';
import { generateExamPDF } from './utils/pdfGenerator';
import { t } from './utils/translations';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('UPLOAD');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{base64: string; mime: string; name: string; hash: string}>>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<ExamSettings | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isFullWidth, setIsFullWidth] = useState(true); 
  
  const [autoHideFooter, setAutoHideFooter] = useState(true);
  const [uiLanguage, setUiLanguage] = useState<UILanguage>('en');
  
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);

  // State for the custom confirmation modal
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    document.documentElement.dir = uiLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

  // Browser-level exit confirmation (refresh, close tab)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (appState === 'EXAM') {
        const message = t('exit_exam_warning_body', uiLanguage);
        event.preventDefault();
        event.returnValue = message; // For older browsers
        return message; // For modern browsers
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [appState, uiLanguage]);

  // In-app navigation confirmation logic
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

  const handleReplaceFiles = () => {
    setUploadedFiles([]);
    setAppState('UPLOAD');
  };

  const handleDemoLoad = () => {
      const content = `
#include <iostream>
using namespace std;
// DEMO CONTENT...
      `;
      const base64 = btoa(content);
      const demoFile = {
          base64: base64,
          mime: 'text/plain',
          name: 'diagnostic_demo.cpp',
          hash: 'DEMO_HASH_PRESET_001'
      };
      handleFilesAccepted([demoFile]);
  };
  
  const handleStartBuilder = () => {
      setAppState('BUILDER');
  };
  
  const handleBuilderExamGenerated = (generatedQuestions: Question[]) => {
      setQuestions(generatedQuestions);
      // Default settings for builder-generated exam
      setSettings({
          timeLimitMinutes: 0,
          mode: ExamMode.ONE_WAY, // Chat usually implies checking knowledge, so One Way is standard
          formatPreference: QuestionFormatPreference.MIXED,
          outputLanguage: 'en', // Builder handles language in chat
      });
      setAppState('EXAM');
  };

  const handleStartExam = async (examSettings: ExamSettings) => {
    if (uploadedFiles.length === 0) return;
    setSettings(examSettings);
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
      setAppState('EXAM');

    } catch (e) {
      console.error(e);
      alert('Failed to generate exam. Please try different files.');
      setAppState('UPLOAD');
    }
  };

  const handleExamComplete = (answers: UserAnswer[]) => {
    setUserAnswers(answers);
    setAppState('RESULTS');
  };

  const handleRestart = () => {
    setAppState('UPLOAD');
    setUploadedFiles([]);
    setQuestions([]);
    setSettings(null);
    setUserAnswers([]);
    setIsLibraryOpen(false);
  };

  const handleRetake = () => {
    setUserAnswers([]);
    setAppState('EXAM');
  };
  
  const handleLoadSavedExam = (loadedQuestions: Question[]) => {
      setQuestions(loadedQuestions);
      setUserAnswers([]);
      setSettings({
          timeLimitMinutes: 0,
          mode: ExamMode.ONE_WAY,
          formatPreference: QuestionFormatPreference.ORIGINAL,
          outputLanguage: uiLanguage === 'ar' ? 'ar' : 'en',
      });
      setIsLibraryOpen(false);
      setAppState('EXAM');
  };

  const handleRemediation = async (wrongIds: string[]) => {
    setAppState('GENERATING');
    setLoadingMsg(uiLanguage === 'ar' ? 'تحليل نقاط الضعف...' : 'ANALYZING FAILURE POINTS... GENERATING TACTICAL REMEDIATION EXAM...');
    try {
      const newQuestions = await generateExamFromWrongAnswers(questions, wrongIds);
      setQuestions(newQuestions);
      setUserAnswers([]);
      setAppState('EXAM');
    } catch (e) {
       console.error(e);
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
     const getGrade = (s: number) => s >= 97 ? 'A+' : s >= 93 ? 'A' : s >= 90 ? 'A-' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F';
     generateExamPDF(questions, score, getGrade(score), "User");
  };
  
  const handleToggleLibrary = () => {
      setIsLibraryOpen(prev => !prev);
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
      isFullWidth={isFullWidth} 
      onToggleFullWidth={() => setIsFullWidth(!isFullWidth)}
      autoHideFooter={autoHideFooter}
      onToggleAutoHideFooter={() => setAutoHideFooter(!autoHideFooter)}
      mobileActions={getMobileActions()}
      uiLanguage={uiLanguage}
      onSetUiLanguage={setUiLanguage}
    >
      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onCancel={handleCancelExit}
        lang={uiLanguage}
      />

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

      <div className={isLibraryOpen ? 'hidden' : ''}>
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

          {appState === 'CONFIG' && uploadedFiles.length > 0 && (
            <ExamConfig 
                onStart={handleStartExam} 
                onRemoveFile={handleRemoveFile}
                onAppendFiles={handleAppendFiles}
                files={uploadedFiles}
                isFullWidth={isFullWidth}
                lang={uiLanguage}
                isActive={appState === 'CONFIG'}
            />
          )}

          {appState === 'BUILDER' && (
              <ExamBuilder 
                  onExamGenerated={handleBuilderExamGenerated}
                  onCancel={() => confirmAndNavigate(handleRestart)}
                  isFullWidth={isFullWidth}
                  lang={uiLanguage}
              />
          )}

          {appState === 'GENERATING' && (
            <LoadingScreen 
                message={loadingMsg} 
                files={uploadedFiles}
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
              isFullWidth={isFullWidth}
              autoHideFooter={autoHideFooter}
              lang={uiLanguage}
            />
          )}
      </div>
    </Layout>
  );
};

export default App;