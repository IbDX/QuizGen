
import React, { useState, useRef, useEffect } from 'react';
import { ExamSettings, QuestionFormatPreference, OutputLanguage, ExamMode, UILanguage } from '../types';
import { t } from '../utils/translations';
import { validateFile, fileToBase64, validateBatchSize, urlToBase64 } from '../utils/fileValidation';
import { scanFileWithVirusTotal } from '../utils/virusTotal';
import { sanitizeInput } from '../utils/security';

interface ExamConfigProps {
  onStart: (settings: ExamSettings) => void;
  onRemoveFile: (index: number) => void;
  onAppendFiles: (files: Array<{base64: string, mime: string, name: string, hash: string}>) => void;
  files: Array<{base64: string, mime: string, name: string, hash: string}>;
  isFullWidth: boolean;
  lang: UILanguage;
  isActive: boolean;
  preloadedTitle?: string;
}

interface FileItemProps {
    file: {base64: string, mime: string, name: string, hash?: string};
    index: number;
    onRemove: (i: number) => void;
    lang: UILanguage;
}

// Helper component for File Item with Hover Preview
const FileItem: React.FC<FileItemProps> = ({ 
    file, 
    index, 
    onRemove, 
    lang 
}) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    
    // Refs for positioning the fixed tooltip
    const itemRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{top: number, left: number, width: number} | null>(null);

    useEffect(() => {
        if (!isHovering) return;
        if (previewUrl) return; // Already loaded

        if (file.mime.includes('image')) {
            setPreviewUrl(`data:${file.mime};base64,${file.base64}`);
        } else if (file.mime === 'application/pdf') {
            setLoadingPreview(true);
            // Render PDF thumbnail logic
            const renderPdf = async () => {
                try {
                    const pdfjsLib = (window as any).pdfjsLib;
                    if (!pdfjsLib) return;
                    
                    const loadingTask = pdfjsLib.getDocument({ data: atob(file.base64) });
                    const pdf = await loadingTask.promise;
                    const page = await pdf.getPage(1); // Get first page
                    const viewport = page.getViewport({ scale: 0.5 }); // Small thumbnail scale
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    if (context) {
                        await page.render({ canvasContext: context, viewport: viewport }).promise;
                        setPreviewUrl(canvas.toDataURL());
                    }
                } catch (e) {
                    console.error("PDF Preview Failed", e);
                } finally {
                    setLoadingPreview(false);
                }
            };
            renderPdf();
        }
    }, [isHovering, file]);

    const handleMouseEnter = () => {
        if (itemRef.current) {
            const rect = itemRef.current.getBoundingClientRect();
            setCoords({ top: rect.top, left: rect.left, width: rect.width });
            setIsHovering(true);
        }
    };

    return (
        <div 
            ref={itemRef}
            className="relative group"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => { setIsHovering(false); setCoords(null); }}
        >
            {/* File Chip */}
            <div className="flex justify-between items-center p-3 bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-terminal-green transition-all shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-xl">{file.mime.includes('pdf') ? '📄' : '🖼️'}</span>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold font-mono truncate max-w-[200px] text-gray-700 dark:text-gray-200">{file.name}</span>
                        <span className="text-[10px] text-gray-400 uppercase">{file.mime.split('/')[1]}</span>
                    </div>
                </div>
                <button 
                    onClick={() => onRemove(index)}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                    title="Remove File"
                >
                    ✕
                </button>
            </div>

            {/* Hover Preview Tooltip - Fixed Position to avoid clipping and z-index issues */}
            {isHovering && coords && (
                <div 
                    className="fixed z-[9999] p-2 bg-white dark:bg-black border border-gray-300 dark:border-terminal-green shadow-2xl rounded-lg w-48 h-auto animate-fade-in pointer-events-none"
                    style={{
                        top: coords.top - 12,
                        // For RTL: align right edge of tooltip with right edge of item
                        // 192px is roughly w-48 (12rem)
                        left: lang === 'ar' ? (coords.left + coords.width - 192) : coords.left,
                        transform: 'translateY(-100%)'
                    }}
                >
                    {loadingPreview ? (
                        <div className="h-32 flex items-center justify-center text-xs text-gray-500">Generating Preview...</div>
                    ) : previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-full h-auto rounded border border-gray-200 dark:border-gray-800" />
                    ) : (
                        <div className="h-20 flex items-center justify-center text-xs text-gray-400 italic">No Preview</div>
                    )}
                    {/* Arrow */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-black border-b border-r border-gray-300 dark:border-terminal-green transform rotate-45"></div>
                </div>
            )}
        </div>
    );
};

export const ExamConfig: React.FC<ExamConfigProps> = ({ 
    onStart, onRemoveFile, onAppendFiles, files, isFullWidth, lang, isActive, preloadedTitle 
}) => {
  const [timeLimit, setTimeLimit] = useState(0);
  const [mode, setMode] = useState<ExamMode>(ExamMode.ONE_WAY);
  const [format, setFormat] = useState<QuestionFormatPreference>(QuestionFormatPreference.MIXED);
  const [outLang, setOutLang] = useState<OutputLanguage>('auto');
  const [instructions, setInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If files are empty, we assume it's a preloaded/saved exam, so we hide source/generation settings
  const isLoadedExam = files.length === 0 && !!preloadedTitle;

  // --- SOURCE HANDLERS ---

  const handleAppend = async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setIsProcessing(true);
      
      const newFiles = Array.from(fileList);
      const batchCheck = validateBatchSize(newFiles);
      if (!batchCheck.valid) {
          alert(batchCheck.error);
          setIsProcessing(false);
          return;
      }

      const successfulFiles: Array<{base64: string, mime: string, name: string, hash: string}> = [];

      for (const file of newFiles) {
          try {
              const val = await validateFile(file);
              if (!val.valid || !val.mimeType) throw new Error(val.error);

              const scan = await scanFileWithVirusTotal(file);
              if (!scan.safe) throw new Error(scan.message);

              const base64 = await fileToBase64(file);
              const hash = scan.hash || `${file.name}_${Date.now()}`;
              
              successfulFiles.push({ base64, mime: val.mimeType, name: file.name, hash });
          } catch (e: any) {
              console.error(`Failed to append ${file.name}`, e);
              alert(`Skipped ${file.name}: ${e.message}`);
          }
      }

      if (successfulFiles.length > 0) onAppendFiles(successfulFiles);
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUrlFetch = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!urlInput.trim()) return;
      setIsProcessing(true);
      try {
          const { base64, mimeType, name } = await urlToBase64(urlInput);
          const hash = `url_${Date.now()}_${name}`;
          onAppendFiles([{ base64, mime: mimeType, name, hash }]);
          setUrlInput('');
      } catch (e: any) {
          alert(`URL Fetch Failed: ${e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  const handlePaste = async () => {
      if (!navigator.clipboard) return;
      try {
          const text = await navigator.clipboard.readText();
          if (text && (text.startsWith('http') || text.startsWith('www'))) {
              setUrlInput(text);
              return;
          }
          // If not URL, check for image data
          const items = await navigator.clipboard.read();
          for (const item of items) {
              const imageType = item.types.find(t => t.startsWith('image/'));
              if (imageType) {
                  const blob = await item.getType(imageType);
                  const file = new File([blob], "pasted_image.png", { type: imageType });
                  handleAppend([file] as unknown as FileList); // Cast for simplicity
                  return;
              }
          }
          alert("No valid URL or Image found in clipboard.");
      } catch (e) {
          alert("Clipboard access denied or empty.");
      }
  };

  const handleStart = () => {
      onStart({
          timeLimitMinutes: timeLimit,
          mode,
          formatPreference: format,
          outputLanguage: outLang,
          instructions
      });
  };

  return (
    <div className={`mx-auto transition-all duration-300 animate-fade-in ${isFullWidth ? 'max-w-none w-full' : 'max-w-4xl'}`}>
       
       <div className="bg-white dark:bg-terminal-black border-2 border-gray-300 dark:border-terminal-green shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(0,255,65,0.1)] p-6 md:p-8 rounded-lg relative overflow-hidden flex flex-col gap-8">
           
           {/* Header */}
           <div className="border-b border-gray-300 dark:border-terminal-green/30 pb-4">
               <h2 className="text-3xl font-bold font-mono text-gray-800 dark:text-terminal-light flex items-center gap-3">
                   <span className="text-blue-600 dark:text-terminal-green animate-pulse">⚙</span>
                   {isLoadedExam ? (lang === 'ar' ? 'إعدادات الجلسة' : 'SESSION CONFIG') : t('configuration', lang)}
               </h2>
               {preloadedTitle && (
                   <div className="mt-2 text-sm text-gray-500 font-mono">
                       {t('suggested_title', lang)}: <span className="font-bold text-gray-800 dark:text-white">{preloadedTitle}</span>
                   </div>
               )}
           </div>

           {!isLoadedExam && (
               <>
                   {/* SECTION 1: TARGET SOURCES (TOP PRIORITY) */}
                   <div className="bg-gray-50 dark:bg-[#0a0a0a] p-5 rounded-lg border border-gray-200 dark:border-terminal-gray">
                       <label className="text-xs font-bold font-mono text-gray-500 dark:text-terminal-dimGreen uppercase tracking-widest mb-4 block">
                           {t('target_sources', lang)} ({files.length})
                       </label>

                       {/* Files List Grid */}
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 max-h-60 overflow-y-auto custom-scrollbar p-1">
                           {files.map((file, idx) => (
                               <FileItem key={`${file.hash}-${idx}`} file={file} index={idx} onRemove={onRemoveFile} lang={lang} />
                           ))}
                           {files.length === 0 && (
                               <div className="col-span-full py-8 text-center border-2 border-dashed border-gray-300 dark:border-terminal-gray rounded-lg text-gray-400 text-sm">
                                   No files loaded. Add sources below.
                               </div>
                           )}
                       </div>

                       {/* Add/Fetch Controls */}
                       <div className="flex flex-col md:flex-row gap-3">
                           <input 
                               type="file" 
                               ref={fileInputRef} 
                               multiple 
                               accept=".pdf,.png,.jpg,.jpeg" 
                               className="hidden"
                               onChange={(e) => handleAppend(e.target.files)}
                           />
                           
                           <button 
                               onClick={() => !isProcessing && fileInputRef.current?.click()}
                               disabled={isProcessing}
                               className="flex-shrink-0 px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-[#1a1a1a] dark:hover:bg-[#252525] text-gray-800 dark:text-terminal-light text-xs font-bold uppercase rounded border border-gray-300 dark:border-terminal-gray transition-colors flex items-center justify-center gap-2"
                           >
                               <span>📂</span> {t('add_more', lang)}
                           </button>

                           <div className="flex-grow flex gap-2">
                               <form onSubmit={handleUrlFetch} className="flex-grow flex gap-0 relative group">
                                   <input 
                                        type="url" 
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        placeholder="https://example.com/doc.pdf"
                                        className="w-full bg-white dark:bg-[#111] border border-gray-300 dark:border-terminal-gray rounded-l px-3 text-sm outline-none focus:border-blue-500 dark:focus:border-terminal-green dark:text-terminal-light placeholder-gray-400"
                                   />
                                   <button 
                                        type="submit"
                                        disabled={isProcessing || !urlInput.trim()}
                                        className="px-4 bg-blue-600 dark:bg-terminal-green text-white dark:text-black font-bold text-xs uppercase rounded-r hover:opacity-90 disabled:opacity-50"
                                   >
                                       {t('fetch', lang)}
                                   </button>
                               </form>
                               <button 
                                    onClick={handlePaste}
                                    className="px-3 bg-gray-200 hover:bg-gray-300 dark:bg-[#1a1a1a] dark:hover:bg-[#252525] border border-gray-300 dark:border-terminal-gray rounded text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-terminal-green transition-colors"
                                    title={t('paste_from_clipboard', lang)}
                               >
                                   📋
                               </button>
                           </div>
                       </div>
                   </div>

                   {/* SECTION 2: OUTPUT & FORMAT (Middle) */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold font-mono text-gray-400 dark:text-terminal-dimGreen uppercase tracking-widest mb-2">
                                {t('output_lang', lang)}
                            </label>
                            <div className="relative">
                                <select 
                                    value={outLang} 
                                    onChange={(e) => setOutLang(e.target.value as OutputLanguage)}
                                    className="w-full bg-gray-50 dark:bg-[#050505] border border-gray-300 dark:border-terminal-border text-gray-800 dark:text-terminal-light text-sm p-3 rounded focus:border-blue-500 dark:focus:border-terminal-green outline-none appearance-none cursor-pointer hover:bg-white dark:hover:bg-[#111] transition-colors"
                                >
                                    <option value="auto">{t('original_lang', lang)}</option>
                                    <option value="en">English (Force)</option>
                                    <option value="ar">العربية (Force)</option>
                                </select>
                                <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 ${lang === 'ar' ? 'left-3' : 'right-3'}`}>▼</div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 pl-1">
                                {outLang === 'auto' ? t('lang_desc_auto', lang) : outLang === 'en' ? t('lang_desc_en', lang) : t('lang_desc_ar', lang)}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold font-mono text-gray-400 dark:text-terminal-dimGreen uppercase tracking-widest mb-2">
                                {t('output_format', lang)}
                            </label>
                            <div className="relative">
                                <select 
                                    value={format} 
                                    onChange={(e) => setFormat(e.target.value as QuestionFormatPreference)}
                                    className="w-full bg-gray-50 dark:bg-[#050505] border border-gray-300 dark:border-terminal-border text-gray-800 dark:text-terminal-light text-sm p-3 rounded focus:border-blue-500 dark:focus:border-terminal-green outline-none appearance-none cursor-pointer hover:bg-white dark:hover:bg-[#111] transition-colors"
                                >
                                    <option value={QuestionFormatPreference.MIXED}>MIXED (Smart Selection)</option>
                                    <option value={QuestionFormatPreference.MCQ}>MCQ Only</option>
                                    <option value={QuestionFormatPreference.CODING}>Coding Only</option>
                                    <option value={QuestionFormatPreference.TRACING}>Tracing Only</option>
                                    <option value={QuestionFormatPreference.SHORT_ANSWER}>Short Answer</option>
                                    <option value={QuestionFormatPreference.ORIGINAL}>Strict Original Format</option>
                                </select>
                                <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 ${lang === 'ar' ? 'left-3' : 'right-3'}`}>▼</div>
                            </div>
                        </div>
                   </div>
               </>
           )}

           {/* SECTION 3: PARAMETERS (Bottom) */}
           <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${!isLoadedExam ? 'border-t border-gray-200 dark:border-terminal-gray pt-6' : ''}`}>
                
                {/* Left Column: Mode & Time */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold font-mono text-gray-400 dark:text-terminal-dimGreen uppercase tracking-widest mb-2">
                            {t('mode_select', lang)}
                        </label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setMode(ExamMode.ONE_WAY)}
                                className={`flex-1 p-3 text-xs font-bold border rounded transition-all ${mode === ExamMode.ONE_WAY ? 'bg-blue-600 text-white border-blue-600 dark:bg-terminal-green dark:text-terminal-black dark:border-terminal-green' : 'bg-transparent border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'}`}
                            >
                                ONE WAY
                            </button>
                            <button 
                                onClick={() => setMode(ExamMode.TWO_WAY)}
                                className={`flex-1 p-3 text-xs font-bold border rounded transition-all ${mode === ExamMode.TWO_WAY ? 'bg-purple-600 text-white border-purple-600 dark:bg-terminal-green dark:text-terminal-black dark:border-terminal-green' : 'bg-transparent border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'}`}
                            >
                                TWO WAY
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold font-mono text-gray-400 dark:text-terminal-dimGreen uppercase tracking-widest mb-2">
                            {t('time_alloc', lang)}
                        </label>
                        <div className="bg-gray-50 dark:bg-[#050505] p-3 rounded border border-gray-300 dark:border-terminal-border">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold dark:text-white">{timeLimit === 0 ? "∞" : `${timeLimit}m`}</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={timeLimit > 0} onChange={() => setTimeLimit(timeLimit > 0 ? 0 : 30)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-terminal-green"></div>
                                </label>
                            </div>
                            <input 
                                type="range" 
                                min="5" 
                                max="180" 
                                step="5" 
                                value={timeLimit || 30} 
                                disabled={timeLimit === 0}
                                onChange={(e) => setTimeLimit(Number(e.target.value))}
                                className={`w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 ${timeLimit === 0 ? 'opacity-30' : ''}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Instructions */}
                <div>
                    <label className="block text-xs font-bold font-mono text-gray-400 dark:text-terminal-dimGreen uppercase tracking-widest mb-2">
                        Custom Instructions (Optional)
                    </label>
                    <textarea 
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="e.g. Focus heavily on pointers, ignore history questions..."
                        className="w-full h-36 bg-gray-50 dark:bg-[#050505] border border-gray-300 dark:border-terminal-border rounded p-3 text-sm text-gray-800 dark:text-terminal-light placeholder-gray-400 focus:border-blue-500 dark:focus:border-terminal-green outline-none resize-none transition-colors"
                    />
                </div>
           </div>

           {/* Footer Action */}
           <div className="pt-2 flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="text-[10px] font-mono text-gray-400">
                   READY TO DEPLOY // v1.5.0
               </div>
               <button 
                   onClick={handleStart}
                   disabled={isProcessing}
                   className="w-full md:w-auto px-12 py-4 bg-gray-900 dark:bg-terminal-green text-white dark:text-terminal-btn-text font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-xl active:scale-95 rounded disabled:opacity-50 disabled:scale-100"
               >
                   {isProcessing ? t('scanning', lang) : t('initiate_exam', lang)}
               </button>
           </div>
       </div>

       {isProcessing && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm cursor-wait">
               <div className="bg-white dark:bg-black p-4 rounded-full shadow-2xl animate-spin">
                   <div className="w-8 h-8 border-4 border-blue-500 dark:border-terminal-green border-t-transparent rounded-full"></div>
               </div>
           </div>
       )}
    </div>
  );
};
