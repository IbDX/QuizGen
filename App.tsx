
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

  const handleFilesAccepted = (files: Array<{base64: string; mime: string; name: string; hash: string}>) => {
    // Initial upload - just set the files (assuming batch from FileUpload doesn't have internal duplicates)
    setUploadedFiles(files);
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
        alert(`The following files are already uploaded and were skipped:\n- ${duplicateNames.join('\n- ')}`);
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
