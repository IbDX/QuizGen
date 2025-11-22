
import React, { useState, useRef } from 'react';
import { ExamMode, ExamSettings } from '../types';
import { validateFile, fileToBase64 } from '../utils/fileValidation';
import { scanFileWithVirusTotal } from '../utils/virusTotal';

interface ExamConfigProps {
  onStart: (settings: ExamSettings) => void;
  onRemoveFile: (index: number) => void;
  onAppendFiles: (files: Array<{base64: string, mime: string, name: string}>) => void;
  files: Array<{ name: string }>;
  isFullWidth: boolean;
}

export const ExamConfig: React.FC<ExamConfigProps> = ({ onStart, onRemoveFile, onAppendFiles, files, isFullWidth }) => {
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [isTimed, setIsTimed] = useState<boolean>(true);
  const [mode, setMode] = useState<ExamMode>(ExamMode.ONE_WAY);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStart = () => {
      onStart({
          timeLimitMinutes: isTimed ? timeLimit : 0,
          mode
      });
  };

  const handleAddFileClick = () => {
      fileInputRef.current?.click();
  };

  const processNewFiles = async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      
      setIsScanning(true);
      setScanError(null);
      const newFiles = Array.from(fileList);
      const successfulFiles: Array<{base64: string, mime: string, name: string}> = [];

      for (let i = 0; i < newFiles.length; i++) {
          const file = newFiles[i];
          try {
              // 1. Validation
              const validationCheck = await validateFile(file);
              if (!validationCheck.valid || !validationCheck.mimeType) {
                  throw new Error(`File ${file.name}: ${validationCheck.error || 'Invalid type'}`);
              }

              // 2. Security Scan & Conversion
              const [scanResult, base64] = await Promise.all([
                  scanFileWithVirusTotal(file),
                  fileToBase64(file)
              ]);

              if (!scanResult.safe) {
                  throw new Error(`File ${file.name}: ${scanResult.message}`);
              }

              successfulFiles.push({ base64, mime: validationCheck.mimeType, name: file.name });

          } catch (e: any) {
              setScanError(e.message);
              // Stop processing batch on error or continue? Let's stop to warn user.
              setIsScanning(false);
              return;
          }
      }

      onAppendFiles(successfulFiles);
      setIsScanning(false);
  };

  return (
    <div className={`border border-gray-300 dark:border-terminal-dimGreen p-6 bg-white dark:bg-gray-900 mt-10 shadow-lg mx-auto transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-xl'}`}>
      <h2 className="text-2xl font-bold mb-6 border-b border-gray-300 dark:border-gray-700 pb-2">
        <span className="text-blue-600 dark:text-blue-400">&gt;</span> CONFIGURATION
      </h2>

      <div className="mb-6 bg-gray-100 dark:bg-black p-4 border border-gray-300 dark:border-gray-700">
        <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">Target Sources ({files.length})</p>
        </div>
        
        {/* File List with Remove Option */}
        <ul className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar mb-4">
            {files.map((f, i) => (
                <li key={i} className="font-mono text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2 flex items-center justify-between group">
                    <div className="flex items-center gap-2 truncate">
                        <span className="opacity-50 text-xs text-gray-500">[{i+1}]</span>
                        <span className="truncate text-terminal-green">{f.name}</span>
                    </div>
                    <button 
                        onClick={() => onRemoveFile(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Remove File"
                    >
                        ✕
                    </button>
                </li>
            ))}
        </ul>

        {/* Add More Files Area */}
        <div 
            onClick={!isScanning ? handleAddFileClick : undefined}
            className={`border-2 border-dashed border-gray-300 dark:border-gray-700 p-3 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${isScanning ? 'opacity-50 cursor-wait' : ''}`}
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".pdf,.jpg,.jpeg,.png"
                multiple 
                onChange={(e) => processNewFiles(e.target.files)}
                disabled={isScanning}
            />
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center justify-center gap-2">
                {isScanning ? (
                    <>
                        <span className="animate-spin">↻</span> SCANNING & ANALYZING...
                    </>
                ) : (
                    <>
                        <span>+</span> ADD MORE FILES
                    </>
                )}
            </div>
        </div>
        
        {scanError && (
            <div className="mt-2 text-[10px] text-red-500 font-bold bg-red-100 dark:bg-red-900/20 p-2 border border-red-200 dark:border-red-900">
                ERROR: {scanError}
            </div>
        )}
      </div>

      <div className="mb-6 space-y-6">
        {/* Mode Selection */}
        <div>
          <label className="block text-sm font-bold mb-2">MODE_SELECT</label>
          <div className="flex flex-col gap-2">
            <label className={`flex items-center p-3 border cursor-pointer transition-colors ${mode === ExamMode.ONE_WAY ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700'}`}>
              <input 
                type="radio" 
                name="mode" 
                value={ExamMode.ONE_WAY} 
                checked={mode === ExamMode.ONE_WAY}
                onChange={() => setMode(ExamMode.ONE_WAY)}
                className="mr-3"
              />
              <div>
                <span className="font-bold">ONE_WAY (Standard)</span>
                <p className="text-xs opacity-70">Submit all answers at end. No immediate feedback.</p>
              </div>
            </label>
            
            <label className={`flex items-center p-3 border cursor-pointer transition-colors ${mode === ExamMode.TWO_WAY ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700'}`}>
              <input 
                type="radio" 
                name="mode" 
                value={ExamMode.TWO_WAY}
                checked={mode === ExamMode.TWO_WAY}
                onChange={() => setMode(ExamMode.TWO_WAY)}
                className="mr-3"
              />
              <div>
                <span className="font-bold">TWO_WAY (Interactive)</span>
                <p className="text-xs opacity-70">Check answers immediately. Practice mode.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Time Allocation */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold">TIME_ALLOCATION</label>
            <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
                <input 
                    type="checkbox" 
                    checked={isTimed} 
                    onChange={(e) => setIsTimed(e.target.checked)} 
                    className="accent-blue-600 w-4 h-4"
                />
                <span className={isTimed ? "text-gray-900 dark:text-white" : "text-gray-500"}>ENABLE TIMER</span>
            </label>
          </div>
          
          <div className={`transition-opacity duration-200 ${isTimed ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex items-center gap-4">
                <input 
                type="range" 
                min="5" 
                max="120" 
                step="5" 
                value={timeLimit} 
                onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-500"
                disabled={!isTimed}
                />
                <span className="font-mono text-xl w-20 text-right">
                    {isTimed ? `${timeLimit}m` : '∞'}
                </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
                {isTimed ? 'Exam will auto-submit when time expires.' : 'No time limit imposed.'}
            </p>
          </div>
        </div>
      </div>

      <button 
        onClick={handleStart}
        disabled={isScanning}
        className="w-full py-3 bg-gray-900 hover:bg-gray-700 dark:bg-terminal-green dark:hover:bg-terminal-dimGreen text-white dark:text-black font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        [ INITIATE_EXAM ]
      </button>
    </div>
  );
};
