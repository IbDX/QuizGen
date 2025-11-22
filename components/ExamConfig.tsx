import React, { useState } from 'react';
import { ExamMode, ExamSettings } from '../types';

interface ExamConfigProps {
  onStart: (settings: ExamSettings) => void;
  onReplaceFile: () => void;
  fileName: string;
  isFullWidth: boolean;
}

export const ExamConfig: React.FC<ExamConfigProps> = ({ onStart, onReplaceFile, fileName, isFullWidth }) => {
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [isTimed, setIsTimed] = useState<boolean>(true);
  const [mode, setMode] = useState<ExamMode>(ExamMode.ONE_WAY);

  const handleStart = () => {
      onStart({
          timeLimitMinutes: isTimed ? timeLimit : 0,
          mode
      });
  };

  return (
    <div className={`border border-gray-300 dark:border-palette-accent p-6 bg-white dark:bg-palette-header mt-10 shadow-lg mx-auto transition-all duration-300 ${isFullWidth ? 'max-w-none w-full' : 'max-w-xl'}`}>
      <h2 className="text-2xl font-bold mb-6 border-b border-gray-300 dark:border-palette-accent pb-2">
        <span className="text-blue-600 dark:text-palette-text">&gt;</span> CONFIGURATION
      </h2>

      <div className="mb-6 flex items-end justify-between bg-gray-100 dark:bg-palette-deep p-3 border border-gray-300 dark:border-palette-accent">
        <div>
            <p className="text-xs mb-1 text-gray-500 dark:text-palette-accent uppercase tracking-wider">Target Source</p>
            <div className="font-mono text-sm truncate max-w-[200px] md:max-w-[300px] text-blue-600 dark:text-palette-text">
            {fileName}
            </div>
        </div>
        <button 
            onClick={onReplaceFile}
            className="text-xs text-blue-500 dark:text-palette-text underline hover:text-blue-400 font-mono"
        >
            [CHANGE_SOURCE]
        </button>
      </div>

      <div className="mb-6 space-y-6 text-gray-900 dark:text-palette-text">
        {/* Mode Selection */}
        <div>
          <label className="block text-sm font-bold mb-2">MODE_SELECT</label>
          <div className="flex flex-col gap-2">
            <label className={`flex items-center p-3 border cursor-pointer transition-colors ${mode === ExamMode.ONE_WAY ? 'border-blue-500 bg-blue-50 dark:bg-palette-deep/50 dark:border-palette-text' : 'border-gray-300 dark:border-palette-accent'}`}>
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
            
            <label className={`flex items-center p-3 border cursor-pointer transition-colors ${mode === ExamMode.TWO_WAY ? 'border-blue-500 bg-blue-50 dark:bg-palette-deep/50 dark:border-palette-text' : 'border-gray-300 dark:border-palette-accent'}`}>
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
                <span className={isTimed ? "text-gray-900 dark:text-palette-text" : "text-gray-500 dark:text-palette-accent"}>ENABLE TIMER</span>
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
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-palette-deep accent-blue-500 dark:accent-palette-text"
                disabled={!isTimed}
                />
                <span className="font-mono text-xl w-20 text-right">
                    {isTimed ? `${timeLimit}m` : '∞'}
                </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-palette-accent mt-1 text-right">
                {isTimed ? 'Exam will auto-submit when time expires.' : 'No time limit imposed.'}
            </p>
          </div>
        </div>
      </div>

      <button 
        onClick={handleStart}
        className="w-full py-3 bg-gray-900 hover:bg-gray-700 dark:bg-palette-accent dark:hover:bg-palette-deep text-white dark:text-white font-bold uppercase tracking-widest transition-all"
      >
        [ INITIATE_EXAM ]
      </button>
    </div>
  );
};