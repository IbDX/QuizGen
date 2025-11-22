import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { FileUpload } from './components/FileUpload';
import { ExamConfig } from './components/ExamConfig';
import { ExamRunner } from './components/ExamRunner';
import { Results } from './components/Results';
import { Leaderboard } from './components/Leaderboard';
import { AppState, Question, ExamSettings, UserAnswer } from './types';
import { generateExam, generateExamFromWrongAnswers } from './services/gemini';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('UPLOAD');
  const [fileData, setFileData] = useState<{base64: string; mime: string; name: string} | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<ExamSettings | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isFullWidth, setIsFullWidth] = useState(true); // Default to true

  const handleFileAccepted = (base64: string, mime: string, name: string) => {
    setFileData({ base64, mime, name });
    setAppState('CONFIG');
  };

  const handleReplaceFile = () => {
    setFileData(null);
    setAppState('UPLOAD');
  };

  const handleStartExam = async (examSettings: ExamSettings) => {
    if (!fileData) return;
    setSettings(examSettings);
    setAppState('GENERATING');
    setLoadingMsg('ESTABLISHING NEURAL LINK... PARSING SOURCE MATERIAL...');

    try {
      const generatedQuestions = await generateExam(fileData.base64, fileData.mime);
      if (generatedQuestions.length === 0) throw new Error("No questions generated");
      setQuestions(generatedQuestions);
      setAppState('EXAM');
    } catch (e) {
      console.error(e);
      alert('Failed to generate exam. Please try a different file.');
      setAppState('UPLOAD');
    }
  };

  const handleExamComplete = (answers: UserAnswer[]) => {
    setUserAnswers(answers);
    setAppState('RESULTS');
  };

  const handleRestart = () => {
    setAppState('UPLOAD');
    setFileData(null);
    setQuestions([]);
    setSettings(null);
    setUserAnswers([]);
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

  return (
    <Layout 
      onHome={handleRestart} 
      isFullWidth={isFullWidth} 
      onToggleFullWidth={() => setIsFullWidth(!isFullWidth)}
    >
      {appState === 'UPLOAD' && (
        <>
          <FileUpload 
            onFileAccepted={handleFileAccepted} 
            isFullWidth={isFullWidth}
          />
          <Leaderboard />
        </>
      )}

      {appState === 'CONFIG' && fileData && (
        <ExamConfig 
            onStart={handleStartExam} 
            onReplaceFile={handleReplaceFile} 
            fileName={fileData.name} 
            isFullWidth={isFullWidth}
        />
      )}

      {appState === 'GENERATING' && (
        <div className="flex flex-col items-center justify-center h-[50vh] space-y-6">
          <div className="w-16 h-16 border-4 border-t-terminal-green border-r-transparent border-b-terminal-green border-l-transparent rounded-full animate-spin"></div>
          <p className="font-mono text-lg animate-pulse text-center max-w-md px-4">{loadingMsg}</p>
        </div>
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
    </Layout>
  );
};

export default App;