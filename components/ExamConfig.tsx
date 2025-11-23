

import React, { useState, useRef, useEffect } from 'react';
import { ExamMode, ExamSettings, QuestionFormatPreference, OutputLanguage, UILanguage } from '../types';
import { validateFile, fileToBase64 } from '../utils/fileValidation';
import { scanFileWithVirusTotal } from '../utils/virusTotal';
import { t } from '../utils/translations';

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
  lang: UILanguage;
}

const FORMAT_OPTIONS = [
    { val: QuestionFormatPreference.MIXED, label: 'AUTO MIX', desc: 'Best Fit' },
    { val: QuestionFormatPreference.ORIGINAL, label: 'ORIGINAL', desc: 'Source Type' },
    { val: QuestionFormatPreference.MCQ, label: 'MCQ ONLY', desc: 'Force MCQ' },
    { val: QuestionFormatPreference.TRACING, label: 'TRACING', desc: 'Code Output' },
    { val: QuestionFormatPreference.CODING, label: 'CODING', desc: 'Code Write' },
];

const PdfPreview: React.FC<{ base64: string }> = ({ base64 }) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!base64) return;
        try {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setBlobUrl(url);
            return () => { URL.revokeObjectURL(url); };
        } catch (e) {
            console.error("Failed to create PDF blob", e);
        }
    }, [base64]);

    if (!blobUrl) {
        return (
            <div className="w-[280px] h-[300px] bg-gray-100 dark:bg-terminal-black border border-gray-700 flex items-center justify-center text-xs dark:text-terminal-green">
                <span className="animate-pulse">LOADING PDF...</span>
            </div>
        );
    }

    return (
        <iframe 
            src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} 
            className="w-[280px] h-[300px] border border-gray-700 bg-white"
            title="PDF Preview"
        />
    );
};

export const ExamConfig: React.FC<ExamConfigProps> = ({ onStart, onRemoveFile, onAppendFiles, files, isFullWidth, lang }) => {
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [isTimed, setIsTimed] = useState<boolean>(true);
  const [mode, setMode] = useState<ExamMode>(ExamMode.ONE_WAY);
  const [formatPref, setFormatPref] = useState<QuestionFormatPreference>(QuestionFormatPreference.ORIGINAL);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('en'); // Default to En
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  const [hoveredFile, setHoveredFile] = useState<{file: FileData, x: number, y: number} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      // If UI language changes to Arabic, default output to Arabic for convenience
      if (lang === 'ar') setOutputLanguage('ar');
      else setOutputLanguage('en');
  }, [lang]);

  useEffect(() => {
      if (window.innerWidth < 768) {
          setFormatPref(QuestionFormatPreference.MCQ);
      }
  }, []);

  const handleStart = () => {
      onStart({
          timeLimitMinutes: isTimed ? timeLimit : 0,
          mode,
          formatPreference: formatPref,
          outputLanguage // Pass selected language to generator
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
              const validationCheck = await validateFile(file);
              if (!validationCheck.valid || !validationCheck.mimeType) {
                  throw new Error(`File ${file.name}: ${validationCheck.error || 'Invalid type'}`);
              }
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
              setIsScanning(false);
              return;
          }
      }
      onAppendFiles(successfulFiles);
      setIsScanning(false);
  };

  const updatePreviewPosition = (target: Element, file: FileData) => {
      const rect = target.getBoundingClientRect();
      // Use visualViewport if available for better mobile accuracy, fallback to window
      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      
      const TOOLTIP_WIDTH = Math.min(320, viewportWidth - 30); // Dynamic width for small screens
      const TOOLTIP_HEIGHT = 350; // Approx height
      const PADDING = 10;

      let left = rect.right + PADDING;
      let top = rect.top;

      // RTL handling
      if (lang === 'ar') {
           left = rect.left - TOOLTIP_WIDTH - PADDING;
           if (left < PADDING) left = rect.right + PADDING; // Flip if hits left edge
      } else {
          // LTR handling
          // If tooltip goes off right edge, flip to left
          if (left + TOOLTIP_WIDTH > viewportWidth) {
              left = rect.left - TOOLTIP_WIDTH - PADDING;
          }
          // If still off screen (left), simply clamp to left edge
          if (left < PADDING) left = PADDING;
      }
      
      // Vertical clamping
      if (top + TOOLTIP_HEIGHT > viewportHeight) {
          // Shift up to align bottom with viewport bottom (minus padding)
          top = viewportHeight - TOOLTIP_HEIGHT - PADDING;
      }
      if (top < PADDING) top = PADDING;

      setHoveredFile({ file, x: left, y: top });
  };

  const handleMouseEnterFile = (e: React.MouseEvent, file: FileData) => {
      if (window.matchMedia('(pointer: coarse)').matches) return;
      updatePreviewPosition(e.currentTarget, file);
  };

  const handleTouchStartFile = (e: React.TouchEvent, file: FileData) => {
      // e.preventDefault(); // Prevents scroll, handled nicely by onTouchEnd clearing it
      updatePreviewPosition(e.currentTarget, file);
  };

  const handleMouseLeaveFile = () => {
      setHoveredFile(null);
  };

  const decodeBase64Text = (b64: string) => {
      try { return atob(b64); } catch { return "Error decoding preview."; }
  };

  const getLangDescription = (l: OutputLanguage) => {
      switch(l) {
          case 'ar': return t('lang_desc_ar', lang);
          case 'auto': return t('lang_desc_auto', lang);
          default: return t('lang_desc_en', lang);
      }
  }

  return (
    <div className={`border border-gray-300 dark:border-terminal-dimGreen p-4 md:p-6 bg-white/95 dark:bg-gray-900/90 backdrop-blur-md mt-4 md:mt-10 shadow-lg mx-auto transition-all duration-300 relative ${isFullWidth ? 'max-w-none w-full' : 'max-w-xl'}`}>
      
      {hoveredFile && (
          <div 
            className="fixed z-[100] bg-gray-100 dark:bg-black border-2 border-terminal-green shadow-2xl p-2 animate-fade-in"
            style={{ top: hoveredFile.y, left: hoveredFile.x, maxWidth: '90vw', width: '320px' }}
          >
              <div className="text-[10px] font-bold bg-terminal-green text-black px-1 mb-1">PREVIEW SOURCE</div>
              {hoveredFile.file.mime.startsWith('image/') ? (
                  <img src={`data:${hoveredFile.file.mime};base64,${hoveredFile.file.base64}`} alt="preview" className="w-full h-auto max-h-[300px] object-contain border border-gray-700" />
              ) : hoveredFile.file.mime === 'application/pdf' ? (
                  <PdfPreview base64={hoveredFile.file.base64} />
              ) : hoveredFile.file.mime.startsWith('text/') ? (
                   <pre className="w-full max-h-[300px] overflow-hidden text-[9px] bg-[#1e1e1e] text-gray-300 p-2 font-mono whitespace-pre-wrap" dir="ltr">
                       {decodeBase64Text(hoveredFile.file.base64).slice(0, 500)}...
                   </pre>
              ) : (
                  <div className="p-4 text-center text-gray-500 text-xs font-mono">NO PREVIEW AVAILABLE</div>
              )}
              <div className="text-[9px] mt-1 text-gray-500 truncate">{hoveredFile.file.name}</div>
          </div>
      )}

      <h2 className="text-xl md:text-2xl font-bold mb-6 border-b border-gray-300 dark:border-terminal-gray pb-2 flex items-center gap-2">
        <span className="text-blue-600 dark:text-terminal-green rtl:rotate-180">&gt;</span> 
        <span className="text-gray-900 dark:text-terminal-light">{t('configuration', lang)}</span>
      </h2>

      <div className="mb-6 bg-gray-100 dark:bg-gray-900/50 p-4 border border-gray-300 dark:border-terminal-gray shadow-sm">
        <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500 dark:text-terminal-green uppercase tracking-wider font-bold">{t('target_sources', lang)} ({files.length})</p>
        </div>
        
        <ul className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar mb-4 relative">
            {files.map((f, i) => (
                <li 
                    key={i} 
                    className="font-mono text-sm bg-white dark:bg-black border border-gray-200 dark:border-terminal-gray p-3 md:p-2 flex items-center justify-between group hover:border-terminal-green hover:bg-gray-50 dark:hover:bg-terminal-dimGreen/10 transition-colors relative cursor-help select-none"
                    onMouseEnter={(e) => handleMouseEnterFile(e, f)}
                    onMouseLeave={handleMouseLeaveFile}
                    onTouchStart={(e) => handleTouchStartFile(e, f)}
                    onTouchEnd={handleMouseLeaveFile}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="opacity-50 text-xs text-gray-500 shrink-0">[{i+1}]</span>
                        <span className="truncate text-blue-600 dark:text-terminal-green max-w-[140px] md:max-w-[300px]">{f.name}</span>
                        <span className="text-[9px] px-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-500 uppercase shrink-0">
                            {f.mime.includes('pdf') ? 'PDF' : f.mime.includes('image') ? 'IMG' : 'TXT'}
                        </span>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                        className="text-gray-400 hover:text-terminal-alert transition-colors p-2 md:p-1 shrink-0"
                        title="Remove File"
                    >
                        ✕
                    </button>
                </li>
            ))}
        </ul>

        <div 
            onClick={!isScanning ? handleAddFileClick : undefined}
            className={`border-2 border-dashed border-gray-300 dark:border-terminal-gray p-4 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-terminal-dimGreen/20 transition-colors ${isScanning ? 'opacity-50 cursor-wait' : ''}`}
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
            <div className="text-sm md:text-xs font-bold text-gray-500 dark:text-terminal-green uppercase flex items-center justify-center gap-2">
                {isScanning ? (
                    <> <span className="animate-spin">↻</span> {t('scanning', lang)} </>
                ) : (
                    <> <span>+</span> {t('add_more', lang)} </>
                )}
            </div>
        </div>
        
        {scanError && (
            <div className="mt-2 text-[10px] text-terminal-alert font-bold bg-red-100 dark:bg-terminal-alert/20 p-2 border border-red-200 dark:border-terminal-alert">
                ERROR: {scanError}
            </div>
        )}
      </div>

      <div className="mb-6 space-y-6">
        {/* Output Language Selection */}
        <div className="bg-gray-50 dark:bg-black/30 p-3 border border-gray-200 dark:border-gray-800 rounded shadow-sm">
            <label className="block text-sm font-bold mb-2 text-gray-900 dark:text-terminal-light">{t('output_lang', lang)}</label>
            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={() => setOutputLanguage('en')}
                    className={`p-3 border text-center font-bold text-sm transition-all rounded ${outputLanguage === 'en' ? 'bg-terminal-green text-black border-terminal-green' : 'border-gray-300 bg-white dark:bg-black dark:border-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                    ENGLISH
                </button>
                <button
                    onClick={() => setOutputLanguage('ar')}
                    className={`p-3 border text-center font-bold text-sm transition-all rounded font-sans ${outputLanguage === 'ar' ? 'bg-terminal-green text-black border-terminal-green' : 'border-gray-300 bg-white dark:bg-black dark:border-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                    العربية
                </button>
                <button
                    onClick={() => setOutputLanguage('auto')}
                    className={`p-3 border text-center font-bold text-sm transition-all rounded ${outputLanguage === 'auto' ? 'bg-terminal-green text-black border-terminal-green' : 'border-gray-300 bg-white dark:bg-black dark:border-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                    {t('original_lang', lang)}
                </button>
            </div>
            <p className="text-[10px] mt-2 text-gray-500 dark:text-gray-400 font-mono">
                &gt; {getLangDescription(outputLanguage)}
            </p>
        </div>

        <div className="hidden md:block bg-gray-50 dark:bg-black/30 p-3 border border-gray-200 dark:border-gray-800 rounded shadow-sm">
            <label className="block text-sm font-bold mb-2 text-gray-900 dark:text-terminal-light">{t('output_format', lang)}</label>
            <div className="grid grid-cols-5 gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                    <button
                        key={opt.val}
                        onClick={() => setFormatPref(opt.val)}
                        className={`
                            p-2 border text-left transition-all relative overflow-hidden rtl:text-right rounded
                            ${formatPref === opt.val 
                                ? 'border-terminal-green bg-terminal-green/10 text-terminal-green' 
                                : 'border-gray-300 bg-white dark:bg-black dark:border-terminal-gray opacity-60 hover:opacity-100 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }
                        `}
                    >
                        <div className="text-[10px] md:text-xs font-bold">{opt.label}</div>
                        <div className="text-[8px] md:text-[9px] opacity-70">{opt.desc}</div>
                    </button>
                ))}
            </div>
        </div>

        <div className="bg-gray-50 dark:bg-black/30 p-3 border border-gray-200 dark:border-gray-800 rounded shadow-sm">
          <label className="block text-sm font-bold mb-2 text-gray-900 dark:text-terminal-light">{t('mode_select', lang)}</label>
          <div className="hidden md:flex flex-col gap-2">
            {[ExamMode.ONE_WAY, ExamMode.TWO_WAY].map((m) => (
                 <label 
                    key={m} 
                    className={`
                        flex items-center p-3 border cursor-pointer transition-colors rounded
                        ${mode === m 
                            ? 'border-blue-600 dark:border-terminal-green bg-blue-600 dark:bg-terminal-green' 
                            : 'bg-white dark:bg-black border-gray-300 dark:border-terminal-gray hover:bg-gray-100 dark:hover:bg-gray-800'
                        }
                    `}
                 >
                    <input 
                        type="radio" 
                        name="mode" 
                        value={m} 
                        checked={mode === m} 
                        onChange={() => setMode(m)} 
                        className="mr-3 accent-white dark:accent-black rtl:ml-3 rtl:mr-0" 
                    />
                    <div>
                        <span className={`font-bold ${mode === m ? 'text-white dark:text-black' : 'text-gray-800 dark:text-terminal-light'}`}>
                            {m === ExamMode.ONE_WAY ? 'ONE_WAY (Standard)' : 'TWO_WAY (Interactive)'}
                        </span>
                    </div>
                </label>
            ))}
          </div>

          <div className="md:hidden relative">
             <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ExamMode)}
                className="w-full p-4 bg-white dark:bg-black text-gray-900 dark:text-terminal-light border border-gray-300 dark:border-terminal-gray font-mono text-base focus:border-terminal-green outline-none appearance-none rounded"
             >
                <option value={ExamMode.ONE_WAY} className="bg-white dark:bg-black text-gray-900 dark:text-terminal-light">ONE_WAY (Standard)</option>
                <option value={ExamMode.TWO_WAY} className="bg-white dark:bg-black text-gray-900 dark:text-terminal-light">TWO_WAY (Interactive)</option>
             </select>
             <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-black/30 p-3 border border-gray-200 dark:border-gray-800 rounded shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-gray-900 dark:text-terminal-light">{t('time_alloc', lang)}</label>
            <label className="flex items-center gap-2 cursor-pointer text-sm select-none p-2">
                <input type="checkbox" checked={isTimed} onChange={(e) => setIsTimed(e.target.checked)} className="accent-terminal-green w-5 h-5" />
                <span className={isTimed ? "text-gray-900 dark:text-terminal-light" : "text-gray-500"}>{t('enable_timer', lang)}</span>
            </label>
          </div>
          
          <div className={`transition-opacity duration-200 ${isTimed ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex items-center gap-4">
                <input 
                    type="range" min="5" max="120" step="5" value={timeLimit} 
                    onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                    className="w-full h-4 md:h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-500 dark:accent-terminal-green touch-pan-x"
                    disabled={!isTimed}
                />
                <span className="font-mono text-xl w-20 text-right dark:text-terminal-green rtl:text-left">
                    {isTimed ? `${timeLimit}m` : '∞'}
                </span>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleStart}
        disabled={isScanning}
        className="w-full py-4 md:py-3 bg-gray-900 hover:bg-gray-700 dark:bg-terminal-green dark:hover:bg-terminal-dimGreen text-white dark:text-terminal-black font-bold text-lg md:text-base uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg rounded"
      >
        [ {t('initiate_exam', lang)} ]
      </button>
    </div>
  );
};
