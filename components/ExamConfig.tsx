
import React, { useState, useRef } from 'react';
import { ExamMode, ExamSettings, QuestionFormatPreference } from '../types';
import { validateFile, fileToBase64 } from '../utils/fileValidation';
import { scanFileWithVirusTotal } from '../utils/virusTotal';

interface FileData {
    base64: string;
    mime: string;
    name: string;
    hash: string;
}

interface ExamConfigProps {
  onStart: (settings: ExamSettings) => void;
  onRemoveFile: (index: number) => void;
  onAppendFiles: (files: Array<FileData>) => void;
  files: Array<FileData>;
  isFullWidth: boolean;
}

const FORMAT_OPTIONS = [
    { val: QuestionFormatPreference.MIXED, label: 'AUTO MIX', desc: 'Best Fit', fullLabel: 'AUTO MIX (Best Fit)' },
    { val: QuestionFormatPreference.ORIGINAL, label: 'ORIGINAL', desc: 'Source Type', fullLabel: 'ORIGINAL (Source Type)' },
    { val: QuestionFormatPreference.MCQ, label: 'MCQ ONLY', desc: 'Force MCQ', fullLabel: 'MCQ ONLY (Force MCQ)' },
    { val: QuestionFormatPreference.TRACING, label: 'TRACING', desc: 'Code Output', fullLabel: 'TRACING (Code Output)' },
    { val: QuestionFormatPreference.CODING, label: 'CODING', desc: 'Code Write', fullLabel: 'CODING (Code Write)' },
];

export const ExamConfig: React.FC<ExamConfigProps> = ({ onStart, onRemoveFile, onAppendFiles, files, isFullWidth }) => {
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [isTimed, setIsTimed] = useState<boolean>(true);
  const [mode, setMode] = useState<ExamMode>(ExamMode.ONE_WAY);
  const [formatPref, setFormatPref] = useState<QuestionFormatPreference>(QuestionFormatPreference.MIXED);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  // Stores the file to preview and its calculated screen coordinates (x, y)
  const [hoveredFile, setHoveredFile] = useState<{file: FileData, x: number, y: number} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStart = () => {
      onStart({
          timeLimitMinutes: isTimed ? timeLimit : 0,
          mode,
          formatPreference: formatPref
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
      const successfulFiles: Array<FileData> = [];

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

              const hash = scanResult.hash || `unknown_hash_${Date.now()}_${Math.random()}`;
              successfulFiles.push({ base64, mime: validationCheck.mimeType, name: file.name, hash });

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

  const handleMouseEnterFile = (e: React.MouseEvent, file: FileData) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Estimated Dimensions of Tooltip
      const TOOLTIP_WIDTH = 320;
      const TOOLTIP_MAX_HEIGHT = 350;
      const PADDING = 15;

      // Horizontal Logic: Default to Right, Flip to Left if overflow
      let left = rect.right + PADDING;
      if (left + TOOLTIP_WIDTH > viewportWidth) {
          left = rect.left - TOOLTIP_WIDTH - PADDING;
      }
      
      // Ensure it doesn't go off the left edge (mobile/narrow screens)
      if (left < PADDING) left = PADDING;

      // Vertical Logic: Default to Top of element, Shift Up if overflow bottom
      let top = rect.top;
      if (top + TOOLTIP_MAX_HEIGHT > viewportHeight) {
          top = viewportHeight - TOOLTIP_MAX_HEIGHT - PADDING;
      }
      // Ensure it doesn't go off the top edge
      if (top < PADDING) top = PADDING;

      setHoveredFile({
          file,
          x: left,
          y: top
      });
  };

  const handleMouseLeaveFile = () => {
      setHoveredFile(null);
  };

  return (
    <div className={`border border-gray-300 dark:border-terminal-dimGreen p-4 md:p-6 bg-white dark:bg-gray-900 mt-4 md:mt-10 shadow-lg mx-auto transition-all duration-300 relative ${isFullWidth ? 'max-w-none w-full' : 'max-w-xl'}`}>
      
      {/* File Preview Tooltip */}
      {hoveredFile && (
          <div 
            className="fixed z-50 bg-gray-100 dark:bg-black border-2 border-terminal-green shadow-2xl p-2 pointer-events-none animate-fade-in hidden md:block"
            style={{ 
                top: hoveredFile.y,
                left: hoveredFile.x,
                maxWidth: '300px'
            }}
          >
              <div className="text-[10px] font-bold bg-terminal-green text-black px-1 mb-1">PREVIEW SOURCE</div>
              {hoveredFile.file.mime.startsWith('image/') ? (
                  <img 
                    src={`data:${hoveredFile.file.mime};base64,${hoveredFile.file.base64}`} 
                    alt="preview" 
                    className="w-full h-auto max-h-[300px] object-contain border border-gray-700"
                  />
              ) : hoveredFile.file.mime === 'application/pdf' ? (
                   /* Removed Embed for mobile stability, kept simpler structure */
                  <div className="w-[280px] h-[300px] bg-white relative overflow-hidden border border-gray-700 flex items-center justify-center">
                       <span className="text-black font-bold">PDF PREVIEW</span>
                  </div>
              ) : (
                  <div className="p-4 text-center text-gray-500 text-xs font-mono">
                      NO PREVIEW AVAILABLE
                  </div>
              )}
              <div className="text-[9px] mt-1 text-gray-500 truncate">{hoveredFile.file.name}</div>
          </div>
      )}

      {/* PDF Preview Component Logic - Using IFrame with Blob URL for better compatibility if we were to restore it fully here */}
      
      <h2 className="text-xl md:text-2xl font-bold mb-6 border-b border-gray-300 dark:border-gray-700 pb-2">
        <span className="text-blue-600 dark:text-blue-400">&gt;</span> CONFIGURATION
      </h2>

      <div className="mb-6 bg-gray-100 dark:bg-black p-4 border border-gray-300 dark:border-gray-700">
        <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">Target Sources ({files.length})</p>
        </div>
        
        {/* File List with Remove Option */}
        <ul className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar mb-4 relative">
            {files.map((f, i) => (
                <li 
                    key={i} 
                    className="font-mono text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 md:p-2 flex items-center justify-between group hover:border-terminal-green hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors relative cursor-help"
                    onMouseEnter={(e) => handleMouseEnterFile(e, f)}
                    onMouseLeave={handleMouseLeaveFile}
                >
                    <div className="flex items-center gap-2 truncate">
                        <span className="opacity-50 text-xs text-gray-500">[{i+1}]</span>
                        <span className="truncate text-terminal-green max-w-[150px] md:max-w-none">{f.name}</span>
                        {/* Mini icon indicator */}
                        <span className="text-[9px] px-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-500">
                            {f.mime.includes('pdf') ? 'PDF' : 'IMG'}
                        </span>
                    </div>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering generic click if any
                            onRemoveFile(i);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-2 md:p-1"
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
            className={`border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${isScanning ? 'opacity-50 cursor-wait' : ''}`}
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
            <div className="text-sm md:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center justify-center gap-2">
                {isScanning ? (
                    <>
                        <span className="animate-spin">↻</span> SCANNING...
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
        
        {/* Format Selection */}
        <div>
            <label className="block text-sm font-bold mb-2">OUTPUT_FORMAT_OVERRIDE</label>
            
            {/* Desktop: Grid Buttons */}
            <div className="hidden md:grid grid-cols-5 gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                    <button
                        key={opt.val}
                        onClick={() => setFormatPref(opt.val)}
                        className={`
                            p-2 border text-left transition-all relative overflow-hidden
                            ${formatPref === opt.val 
                                ? 'border-terminal-green bg-terminal-green/10 text-terminal-green' 
                                : 'border-gray-300 dark:border-gray-700 opacity-60 hover:opacity-100'
                            }
                        `}
                    >
                        <div className="text-[10px] md:text-xs font-bold">{opt.label}</div>
                        <div className="text-[8px] md:text-[9px] opacity-70">{opt.desc}</div>
                        {formatPref === opt.val && (
                            <div className="absolute bottom-0 right-0 w-2 h-2 bg-terminal-green"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Mobile: Combo Box */}
            <div className="md:hidden relative">
                <select
                    value={formatPref}
                    onChange={(e) => setFormatPref(e.target.value as QuestionFormatPreference)}
                    className="w-full p-4 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 font-mono text-base focus:border-terminal-green outline-none appearance-none rounded-none"
                >
                    {FORMAT_OPTIONS.map((opt) => (
                        <option key={opt.val} value={opt.val}>{opt.fullLabel}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-300">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
        </div>

        {/* Mode Selection */}
        <div>
          <label className="block text-sm font-bold mb-2">MODE_SELECT</label>
          
          {/* Desktop: Radio Cards */}
          <div className="hidden md:flex flex-col gap-2">
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

          {/* Mobile: Combo Box */}
          <div className="md:hidden relative">
             <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ExamMode)}
                className="w-full p-4 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 font-mono text-base focus:border-terminal-green outline-none appearance-none rounded-none"
             >
                <option value={ExamMode.ONE_WAY}>ONE_WAY (Standard - Submit at End)</option>
                <option value={ExamMode.TWO_WAY}>TWO_WAY (Interactive - Immediate Check)</option>
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-300">
                 <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
             </div>
          </div>
        </div>

        {/* Time Allocation */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold">TIME_ALLOCATION</label>
            <label className="flex items-center gap-2 cursor-pointer text-sm select-none p-2">
                <input 
                    type="checkbox" 
                    checked={isTimed} 
                    onChange={(e) => setIsTimed(e.target.checked)} 
                    className="accent-blue-600 w-5 h-5"
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
                className="w-full h-4 md:h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-500"
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
        className="w-full py-4 md:py-3 bg-gray-900 hover:bg-gray-700 dark:bg-terminal-green dark:hover:bg-terminal-dimGreen text-white dark:text-black font-bold text-lg md:text-base uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        [ INITIATE_EXAM ]
      </button>
    </div>
  );
};
