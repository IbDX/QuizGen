
import React, { useState, useRef, useEffect } from 'react';
import { ExamMode, ExamSettings, QuestionFormatPreference, OutputLanguage, UILanguage } from '../types';
import { validateFile, fileToBase64, urlToBase64 } from '../utils/fileValidation';
import { scanFileWithVirusTotal } from '../utils/virusTotal';
import { sanitizeInput } from '../utils/security';
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
  isActive: boolean;
  preloadedTitle?: string;
}

const FORMAT_OPTIONS = [
    { val: QuestionFormatPreference.MIXED, label: 'AUTO MIX', desc: 'AI Choice' },
    { val: QuestionFormatPreference.ORIGINAL, label: 'ORIGINAL', desc: 'Source' },
    { val: QuestionFormatPreference.MCQ, label: 'MCQ ONLY', desc: 'Force Options' },
    { val: QuestionFormatPreference.SHORT_ANSWER, label: 'TEXT ONLY', desc: 'Open Ended' },
    { val: QuestionFormatPreference.TRACING, label: 'TRACING', desc: 'Code Logic' },
    { val: QuestionFormatPreference.CODING, label: 'CODING', desc: 'Write Code' },
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

export const ExamConfig: React.FC<ExamConfigProps> = ({ onStart, onRemoveFile, onAppendFiles, files, isFullWidth, lang, isActive, preloadedTitle }) => {
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [isTimed, setIsTimed] = useState<boolean>(true);
  const [mode, setMode] = useState<ExamMode>(ExamMode.ONE_WAY);
  const [formatPref, setFormatPref] = useState<QuestionFormatPreference>(QuestionFormatPreference.ORIGINAL);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('en'); 
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [instructionError, setInstructionError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  
  const [hoveredFile, setHoveredFile] = useState<{file: FileData, x: number, y: number} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (lang === 'ar') setOutputLanguage('ar');
      else setOutputLanguage('en');
  }, [lang]);

  useEffect(() => {
      if (window.innerWidth < 768) {
          setFormatPref(QuestionFormatPreference.MCQ);
      }
  }, []);

  const handleStart = () => {
      if (instructionError) return;
      onStart({
          timeLimitMinutes: isTimed ? timeLimit : 0,
          mode,
          formatPreference: formatPref,
          outputLanguage,
          instructions: instructions.trim() || undefined
      });
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const validation = sanitizeInput(val, 300);
      setInstructions(validation.sanitizedValue);
      if (!validation.isValid) {
          setInstructionError(validation.error || "Invalid Input");
      } else {
          setInstructionError(null);
      }
  };

  const handleAddFileClick = () => {
      fileInputRef.current?.click();
  };

  const processNewFiles = async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const MAX_BATCH_SIZE_MB = 50; 
      const currentTotalSize = files.reduce((acc, f) => acc + (f.base64.length * 0.75), 0);
      const newFiles = Array.from(fileList);
      const newFilesSize = newFiles.reduce((acc, f) => acc + f.size, 0);

      if ((currentTotalSize + newFilesSize) > MAX_BATCH_SIZE_MB * 1024 * 1024) {
           setScanError(`Batch limit exceeded. Total files cannot exceed ${MAX_BATCH_SIZE_MB}MB.`);
           return;
      }

      setIsScanning(true);
      setScanError(null);
      
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

  const processUrl = async (url: string) => {
      setIsScanning(true);
      setScanError(null);
      try {
          const { base64, mimeType, name } = await urlToBase64(url);
          const newFileSize = base64.length * 0.75; 
          const currentTotalSize = files.reduce((acc, f) => acc + (f.base64.length * 0.75), 0);
          const MAX_BATCH_SIZE_MB = 50;

          if ((currentTotalSize + newFileSize) > MAX_BATCH_SIZE_MB * 1024 * 1024) {
               throw new Error(`Batch limit exceeded. Total cannot exceed ${MAX_BATCH_SIZE_MB}MB.`);
          }
          
          const hash = `url_${Date.now()}_${name}`;
          onAppendFiles([{ base64, mime: mimeType, name, hash }]);
          setUrlInput(''); 
      } catch (err: any) {
          setScanError(err.message);
      }
      setIsScanning(false);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(urlInput && !isScanning) processUrl(urlInput);
  };

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        processNewFiles(e.clipboardData.files);
        return;
    }
    const text = e.clipboardData.getData('text');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      processUrl(text.trim());
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
        if (isScanning || preloadedTitle) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && target.getAttribute('type') !== 'file')) {
            return;
        }
        if (e.clipboardData) {
             if (e.clipboardData.files.length > 0) {
                e.preventDefault();
                processNewFiles(e.clipboardData.files);
             } else {
                 const text = e.clipboardData.getData('text');
                 if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                     e.preventDefault();
                     setUrlInput(text.trim());
                     processUrl(text.trim());
                 }
             }
        }
    };
    if (isActive) {
        window.addEventListener('paste', handlePaste);
    }
    return () => {
        if (isActive) {
            window.removeEventListener('paste', handlePaste);
        }
    };
  }, [files, isScanning, isActive, preloadedTitle]); 

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!isScanning && !preloadedTitle) processNewFiles(e.dataTransfer.files); };

  const updatePreviewPosition = (target: Element, file: FileData) => {
      const rect = target.getBoundingClientRect();
      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const TOOLTIP_WIDTH = Math.min(320, viewportWidth - 30);
      const TOOLTIP_HEIGHT = 350;
      const PADDING = 10;
      let left = rect.right + PADDING;
      let top = rect.top;
      if (lang === 'ar') {
           left = rect.left - TOOLTIP_WIDTH - PADDING;
           if (left < PADDING) left = rect.right + PADDING;
      } else {
          if (left + TOOLTIP_WIDTH > viewportWidth) left = rect.left - TOOLTIP_WIDTH - PADDING;
          if (left < PADDING) left = PADDING;
      }
      if (top + TOOLTIP_HEIGHT > viewportHeight) top = viewportHeight - TOOLTIP_HEIGHT - PADDING;
      if (top < PADDING) top = PADDING;
      setHoveredFile({ file, x: left, y: top });
  };

  const handleMouseEnterFile = (e: React.MouseEvent, file: FileData) => {
      if (window.matchMedia('(pointer: coarse)').matches) return;
      updatePreviewPosition(e.currentTarget, file);
  };

  const handleTouchStartFile = (e: React.TouchEvent, file: FileData) => {
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
    <div className={`
        border-2 border-gray-300 dark:border-terminal-border 
        p-0 bg-white/95 dark:bg-terminal-black/95 backdrop-blur-md 
        mt-4 md:mt-10 shadow-2xl mx-auto transition-all duration-300 relative rounded-lg overflow-hidden
        ${isFullWidth ? 'max-w-none w-full' : 'max-w-3xl'}
    `}>
      
      {/* File Preview Tooltip */}
      {hoveredFile && (
          <div 
            className="fixed z-[100] bg-gray-100 dark:bg-black border-2 border-terminal-green shadow-2xl p-2 animate-fade-in"
            style={{ top: hoveredFile.y, left: hoveredFile.x, maxWidth: '90vw', width: '320px' }}
          >
              <div className="text-[10px] font-bold bg-terminal-green text-terminal-btn-text px-1 mb-1">PREVIEW SOURCE</div>
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

      {/* Header Bar */}
      <div className="p-4 border-b-2 border-gray-300 dark:border-terminal-border bg-gray-50 dark:bg-terminal-gray flex items-center gap-3">
          <div className="w-3 h-3 bg-blue-500 dark:bg-terminal-green rounded-full shadow-[0_0_10px_var(--color-term-green)] animate-pulse"></div>
          <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-terminal-green tracking-widest font-mono uppercase">
            {preloadedTitle ? `Configuring: ${preloadedTitle}` : t('configuration', lang)}
          </h2>
      </div>

      <div className="p-4 md:p-6 space-y-6">
          
          {/* Target Sources Panel */}
          {!preloadedTitle && (
          <div className="bg-gray-100 dark:bg-terminal-gray/20 border border-gray-300 dark:border-terminal-border p-4 rounded-lg shadow-inner relative">
            <div className="absolute top-0 right-0 p-1">
                <span className="text-[10px] font-mono text-gray-400 dark:text-terminal-border opacity-50 px-2">SRC_DATA</span>
            </div>
            <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-bold text-gray-600 dark:text-terminal-green uppercase tracking-widest">{t('target_sources', lang)} ({files.length})</p>
            </div>
            
            <ul className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar mb-4 pr-1">
                {files.map((f, i) => (
                    <li 
                        key={i} 
                        className="font-mono text-xs md:text-sm bg-white dark:bg-terminal-black border border-gray-200 dark:border-terminal-border p-2 flex items-center justify-between group hover:border-blue-400 dark:hover:border-terminal-green hover:shadow-md transition-all cursor-help select-none rounded-sm"
                        onMouseEnter={(e) => handleMouseEnterFile(e, f)}
                        onMouseLeave={handleMouseLeaveFile}
                        onTouchStart={(e) => handleTouchStartFile(e, f)}
                        onTouchEnd={handleMouseLeaveFile}
                    >
                        <div className="flex items-center gap-3 overflow-hidden w-full">
                            <span className="text-[9px] w-6 text-center bg-gray-200 dark:bg-terminal-gray dark:text-gray-400 rounded px-1 shrink-0">{i+1}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 w-10 text-center ${f.mime.includes('pdf') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                {f.mime.includes('pdf') ? 'PDF' : 'IMG'}
                            </span>
                            <span className="truncate text-gray-700 dark:text-terminal-light w-full">{f.name}</span>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 shrink-0 ml-2"
                            title="Remove File"
                        >
                            ✕
                        </button>
                    </li>
                ))}
            </ul>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                <div 
                    onClick={!isScanning ? handleAddFileClick : undefined}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`h-full border-2 border-dashed border-gray-300 dark:border-terminal-border/50 bg-white dark:bg-terminal-black/30 p-2 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-terminal-green/5 transition-colors rounded ${isScanning ? 'opacity-50 cursor-wait' : ''}`}
                >
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(e) => processNewFiles(e.target.files)} disabled={isScanning} />
                    <div className="text-xs font-bold text-gray-500 dark:text-terminal-green uppercase flex items-center justify-center gap-2 h-full py-2">
                        {isScanning ? <><span className="animate-spin">↻</span> {t('scanning', lang)} </> : <><span>+</span> {t('add_more', lang)}</>}
                    </div>
                </div>
                
                <form onSubmit={handleUrlSubmit} className="flex gap-2 w-full md:w-auto">
                    <input 
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onPaste={handleUrlPaste}
                        placeholder="https://..."
                        className="w-full md:w-64 bg-white dark:bg-terminal-black border border-gray-300 dark:border-terminal-border p-2.5 text-xs font-mono outline-none focus:border-blue-500 dark:focus:border-terminal-green rounded dark:text-white transition-colors shadow-sm"
                        disabled={isScanning}
                    />
                    <button 
                        type="submit"
                        disabled={!urlInput || isScanning}
                        className="px-4 py-2 bg-gray-200 dark:bg-terminal-gray hover:bg-gray-300 dark:hover:bg-terminal-border border border-gray-400 dark:border-terminal-border text-gray-700 dark:text-terminal-green text-xs font-bold uppercase rounded disabled:opacity-50 transition-colors"
                    >
                        {t('fetch', lang)}
                    </button>
                </form>
            </div>
            
            {scanError && (
                <div className="mt-2 text-[10px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/10 p-2 border border-red-200 dark:border-red-900/30 rounded">
                    ⚠️ ERROR: {scanError}
                </div>
            )}
          </div>
          )}

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Left Column: Language & Format */}
            <div className="space-y-4">
                {!preloadedTitle && (
                <div className="bg-gray-50 dark:bg-terminal-gray/20 p-4 border border-gray-200 dark:border-terminal-border rounded-lg relative overflow-hidden">
                    <label className="block text-xs font-bold mb-3 text-gray-500 dark:text-terminal-green uppercase tracking-wider">{t('output_lang', lang)}</label>
                    <div className="flex gap-2">
                        {['en', 'ar', 'auto'].map((l) => (
                            <button
                                key={l}
                                onClick={() => setOutputLanguage(l as OutputLanguage)}
                                className={`
                                    flex-1 py-3 px-2 border rounded font-bold text-xs uppercase transition-all relative overflow-hidden
                                    ${outputLanguage === l 
                                        ? 'border-blue-500 bg-blue-500 text-white dark:border-terminal-green dark:bg-terminal-green dark:text-terminal-btn-text shadow-md' 
                                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-terminal-border dark:bg-terminal-black dark:text-gray-400 dark:hover:bg-terminal-gray'
                                    }
                                `}
                            >
                                {l === 'en' ? 'ENGLISH' : l === 'ar' ? 'العربية' : t('original_lang', lang)}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 font-mono h-4">{getLangDescription(outputLanguage)}</div>
                </div>
                )}

                <div className="bg-gray-50 dark:bg-terminal-gray/20 p-4 border border-gray-200 dark:border-terminal-border rounded-lg">
                    <label className="block text-xs font-bold mb-3 text-gray-500 dark:text-terminal-green uppercase tracking-wider">{t('mode_select', lang)}</label>
                    <div className="flex flex-col gap-2">
                        {[ExamMode.ONE_WAY, ExamMode.TWO_WAY].map((m) => (
                            <label 
                                key={m} 
                                className={`
                                    flex items-center p-3 border cursor-pointer transition-all rounded group relative overflow-hidden
                                    ${mode === m 
                                        ? 'border-blue-500 bg-blue-50 dark:border-terminal-green dark:bg-terminal-green/10 shadow-sm' 
                                        : 'border-gray-300 bg-white dark:border-terminal-border dark:bg-terminal-black hover:border-blue-400 dark:hover:border-terminal-green/50'
                                    }
                                `}
                            >
                                <div className={`w-1 h-full absolute left-0 top-0 ${mode === m ? 'bg-blue-500 dark:bg-terminal-green' : 'bg-transparent'}`}></div>
                                <input 
                                    type="radio" 
                                    name="mode" 
                                    value={m} 
                                    checked={mode === m} 
                                    onChange={() => setMode(m)} 
                                    className="mr-3 accent-blue-600 dark:accent-terminal-green rtl:ml-3 rtl:mr-0 w-4 h-4" 
                                />
                                <div className="flex flex-col">
                                    <span className={`text-xs font-bold ${mode === m ? 'text-blue-700 dark:text-terminal-green' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {m === ExamMode.ONE_WAY ? 'ONE_WAY (Standard)' : 'TWO_WAY (Interactive)'}
                                    </span>
                                    <span className="text-[9px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                                        {m === ExamMode.ONE_WAY ? 'Submit answers at end. Simulates real exam.' : 'Instant feedback per question. Good for learning.'}
                                    </span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Column: Format & Time */}
            <div className="space-y-4">
                {!preloadedTitle && (
                <div className="bg-gray-50 dark:bg-terminal-gray/20 p-4 border border-gray-200 dark:border-terminal-border rounded-lg h-auto lg:h-[calc(50%-0.5rem)]">
                    <label className="block text-xs font-bold mb-3 text-gray-500 dark:text-terminal-green uppercase tracking-wider">{t('output_format', lang)}</label>
                    <div className="grid grid-cols-3 gap-2">
                        {FORMAT_OPTIONS.map((opt) => (
                            <button
                                key={opt.val}
                                onClick={() => setFormatPref(opt.val)}
                                className={`
                                    p-2 border text-center flex flex-col items-center justify-center transition-all rounded min-h-[70px]
                                    ${formatPref === opt.val 
                                        ? 'border-blue-500 bg-blue-500 text-white dark:border-terminal-green dark:bg-terminal-green dark:text-terminal-btn-text shadow-md transform scale-[1.02]' 
                                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-terminal-border dark:bg-terminal-black dark:text-gray-400 dark:hover:bg-terminal-gray hover:border-blue-300 dark:hover:border-terminal-green/50'
                                    }
                                `}
                            >
                                <div className="text-[10px] font-bold leading-tight mb-1">{opt.label}</div>
                                <div className={`text-[8px] uppercase tracking-wider ${formatPref === opt.val ? 'text-blue-100 dark:text-black/70' : 'text-gray-400 dark:text-gray-600'}`}>{opt.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>
                )}

                <div className="bg-gray-50 dark:bg-terminal-gray/20 p-4 border border-gray-200 dark:border-terminal-border rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-bold text-gray-500 dark:text-terminal-green uppercase tracking-wider">{t('time_alloc', lang)}</label>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase ${isTimed ? 'text-blue-600 dark:text-terminal-green' : 'text-gray-400'}`}>{isTimed ? 'ON' : 'OFF'}</span>
                            <div 
                                onClick={() => setIsTimed(!isTimed)}
                                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isTimed ? 'bg-blue-600 dark:bg-terminal-green' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${isTimed ? 'left-6 rtl:right-6 rtl:left-auto' : 'left-1 rtl:right-1 rtl:left-auto'}`}></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className={`transition-all duration-300 ${isTimed ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-mono text-gray-500">5m</span>
                            <input 
                                type="range" min="5" max="120" step="5" value={timeLimit} 
                                onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                                className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-800 accent-blue-600 dark:accent-terminal-green"
                            />
                            <span className="text-xs font-mono text-gray-500">120m</span>
                        </div>
                        <div className="text-center mt-2">
                            <span className="text-2xl font-mono font-bold text-gray-800 dark:text-terminal-light">{isTimed ? timeLimit : '∞'}</span>
                            <span className="text-xs text-gray-500 ml-1">min</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* Custom Instructions - Hidden if preloaded */}
          {!preloadedTitle && (
          <div className="bg-gray-50 dark:bg-terminal-gray/20 p-4 border border-gray-200 dark:border-terminal-border rounded-lg relative group focus-within:border-blue-400 dark:focus-within:border-terminal-green transition-colors">
              <label className="block text-xs font-bold mb-2 text-gray-500 dark:text-terminal-green uppercase tracking-wider">
                  {lang === 'ar' ? 'تعليمات مخصصة (اختياري)' : 'CUSTOM INSTRUCTIONS (OPTIONAL)'}
              </label>
              <textarea
                  value={instructions}
                  onChange={handleInstructionsChange}
                  maxLength={300}
                  placeholder={lang === 'ar' ? "مثال: ركز على المصفوفات..." : "e.g., Focus on Arrays, or Generate exactly 5 questions."}
                  className="w-full p-3 bg-white dark:bg-black border border-gray-300 dark:border-gray-700 rounded text-sm font-mono focus:outline-none dark:text-gray-300 resize-none h-20 shadow-inner"
              />
              <div className="absolute bottom-2 right-2 text-[9px] text-gray-400 pointer-events-none rtl:right-auto rtl:left-2 bg-white dark:bg-black px-1 rounded border dark:border-gray-800">
                  {instructions.length}/300
              </div>
              {instructionError && <p className="text-[10px] text-red-500 mt-1 font-bold">{instructionError}</p>}
          </div>
          )}
      </div>

      {/* Footer Action */}
      <div className="p-4 bg-gray-100 dark:bg-terminal-gray border-t-2 border-gray-300 dark:border-terminal-border">
          <button 
            onClick={handleStart}
            disabled={(isScanning && !preloadedTitle) || !!instructionError}
            className="w-full py-4 bg-gray-900 hover:bg-black dark:bg-terminal-green dark:hover:bg-terminal-dimGreen text-white dark:text-terminal-btn-text font-bold text-base md:text-lg uppercase tracking-[0.15em] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg rounded hover:shadow-xl active:scale-[0.99]"
          >
            [ {preloadedTitle ? "START EXAM SESSION" : t('initiate_exam', lang)} ]
          </button>
      </div>
    </div>
  );
};
