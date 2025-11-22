import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { FileUpload } from './components/FileUpload';
import { ExamConfig } from './components/ExamConfig';
import { ExamRunner } from './components/ExamRunner';
import { Results } from './components/Results';
import { Leaderboard } from './components/Leaderboard';
import { QuestionLibrary } from './components/QuestionLibrary';
import { LoadingScreen } from './components/LoadingScreen';
import { AppState, Question, ExamSettings, UserAnswer } from './types';
import { generateExam, generateExamFromWrongAnswers } from './services/gemini';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('UPLOAD');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  // Changed from single fileData to array of files, now includes hash for deduplication
  const [uploadedFiles, setUploadedFiles] = useState<Array<{base64: string; mime: string; name: string; hash: string}>>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<ExamSettings | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isFullWidth, setIsFullWidth] = useState(true); 
  
  // State for Duplicate File Modal
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);

  const handleFilesAccepted = (files: Array<{base64: string; mime: string; name: string; hash: string}>) => {
    // Deduplicate within the incoming batch itself
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
      
      // Filter out files that already exist
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
      // If all files are removed, go back to upload screen
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

  const handleStartExam = async (examSettings: ExamSettings) => {
    if (uploadedFiles.length === 0) return;
    setSettings(examSettings);
    setAppState('GENERATING');
    setLoadingMsg(`ESTABLISHING NEURAL LINK... ANALYZING ${uploadedFiles.length} SOURCE DOCUMENT(S)...`);

    try {
      // Map uploadedFiles to the format expected by generateExam
      const filePayloads = uploadedFiles.map(f => ({ base64: f.base64, mimeType: f.mime }));
      
      // Pass the format preference to the generator
      const generatedQuestions = await generateExam(filePayloads, examSettings.formatPreference);
      
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
    // Keep questions and settings, just reset answers and go back to exam runner
    setUserAnswers([]);
    setAppState('EXAM');
  };

  const handleRemediation = async (wrongIds: string[]) => {
    setAppState('GENERATING');
    setLoadingMsg('ANALYZING FAILURE POINTS... GENERATING TACTICAL REMEDIATION EXAM...');
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
  
  const handleToggleLibrary = () => {
      setIsLibraryOpen(prev => !prev);
  };

  return (
    <Layout 
      onHome={handleRestart} 
      onToggleLibrary={handleToggleLibrary}
      isLibraryOpen={isLibraryOpen}
      isFullWidth={isFullWidth} 
      onToggleFullWidth={() => setIsFullWidth(!isFullWidth)}
    >
      {/* Duplicate Warning Modal */}
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
                  
                  <button 
                      onClick={() => setDuplicateFiles([])} 
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest transition-colors"
                  >
                      ACKNOWLEDGE
                  </button>
              </div>
          </div>
      )}

      {/* Overlay Library if Open */}
      {isLibraryOpen && (
          <QuestionLibrary isFullWidth={isFullWidth} />
      )}

      {/* Main App State - Hidden when Library is open to preserve state (timer, inputs) */}
      <div className={isLibraryOpen ? 'hidden' : ''}>
          {appState === 'UPLOAD' && (
            <>
              <FileUpload 
                onFilesAccepted={handleFilesAccepted} 
                isFullWidth={isFullWidth}
              />
              <Leaderboard />
            </>
          )}

          {appState === 'CONFIG' && uploadedFiles.length > 0 && (
            <ExamConfig 
                onStart={handleStartExam} 
                onRemoveFile={handleRemoveFile}
                onAppendFiles={handleAppendFiles}
                files={uploadedFiles}
                isFullWidth={isFullWidth}
            />
          )}

          {appState === 'GENERATING' && (
            <LoadingScreen 
                message={loadingMsg} 
                fileNames={uploadedFiles.map(f => f.name)}
            />
          )}

          {appState === 'EXAM' && settings && (
            <ExamRunner 
              questions={questions} 
              settings={settings} 
              onComplete={handleExamComplete} 
              isFullWidth={isFullWidth}
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
            />
          )}
      </div>
    </Layout>
  );
};

export default App;