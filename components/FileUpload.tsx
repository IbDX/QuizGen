
import React, { useRef, useState, useEffect } from 'react';
import { validateFile, fileToBase64, urlToBase64, validateBatchSize } from '../utils/fileValidation';
import { scanFileWithVirusTotal } from '../utils/virusTotal';
import { sanitizeInput } from '../utils/security';
import { t } from '../utils/translations';
import { UILanguage } from '../types';

interface FileUploadProps {
  onFilesAccepted: (files: Array<{base64: string, mime: string, name: string, hash: string}>) => void;
  onLoadDemo: () => void;
  onStartBuilder: () => void;
  isFullWidth: boolean;
  lang?: UILanguage;
  isActive: boolean;
}

interface ProcessingLog {
    name: string;
    status: 'PENDING' | 'SCANNING' | 'SUCCESS' | 'FAILED';
    error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesAccepted, onLoadDemo, onStartBuilder, isFullWidth, lang = 'en', isActive }) => {
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [globalStatus, setGlobalStatus] = useState<'IDLE' | 'PROCESSING'>('IDLE');
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => {
        const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const isTouch = navigator.maxTouchPoints > 0;
        const isNarrow = window.innerWidth < 768;
        setIsMobile(mobileRegex.test(userAgent) || isTouch || isNarrow);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    const newFiles = Array.from(fileList);
    const batchCheck = validateBatchSize(newFiles);
    if (!batchCheck.valid) {
        setLogs([{ name: "BATCH UPLOAD", status: 'FAILED', error: batchCheck.error }]);
        return;
    }
    
    setGlobalStatus('PROCESSING');
    const newLogs: ProcessingLog[] = newFiles.map(f => ({ name: f.name, status: 'PENDING' }));
    setLogs(prev => [...newLogs]); 

    const successfulFiles: Array<{base64: string, mime: string, name: string, hash: string}> = [];

    for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        setLogs(prev => prev.map(l => l.name === file.name ? { ...l, status: 'SCANNING' } : l));

        try {
            const validationCheck = await validateFile(file);
            if (!validationCheck.valid || !validationCheck.mimeType) {
                throw new Error(validationCheck.error || 'Invalid file type');
            }

            const [scanResult, base64] = await Promise.all([
                scanFileWithVirusTotal(file),
                fileToBase64(file)
            ]);

            if (!scanResult.safe) {
                throw new Error(scanResult.message);
            }

            const hash = scanResult.hash || `unknown_hash_${Date.now()}_${Math.random()}`;
            successfulFiles.push({ base64, mime: validationCheck.mimeType, name: file.name, hash });
            setLogs(prev => prev.map(l => l.name === file.name ? { ...l, status: 'SUCCESS' } : l));

        } catch (e: any) {
            setLogs(prev => prev.map(l => l.name === file.name ? { ...l, status: 'FAILED', error: e.message } : l));
        }
    }

    setGlobalStatus('IDLE');

    if (successfulFiles.length > 0) {
        setTimeout(() => {
            onFilesAccepted(successfulFiles);
        }, 1000);
    }
  };

  const processUrl = async (url: string) => {
    if (!url) return;
    if (url.toLowerCase().includes('javascript:')) return;

    setGlobalStatus('PROCESSING');
    setLogs([{ name: url, status: 'SCANNING' }]);
    
    try {
       const { base64, mimeType, name } = await urlToBase64(url);
       const hash = `url_hash_${Date.now()}_${name}`; 
       
       setLogs([{ name: name, status: 'SUCCESS' }]);
       setTimeout(() => onFilesAccepted([{ base64, mime: mimeType, name, hash }]), 800);
    } catch (err: any) {
        setLogs([{ name: url, status: 'FAILED', error: err.message }]);
    }
    setGlobalStatus('IDLE');
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    processUrl(urlInput);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const validation = sanitizeInput(val, 500); 
      setUrlInput(validation.sanitizedValue);
  };

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        handleFiles(e.clipboardData.files);
        return;
    }
    const text = e.clipboardData.getData('text');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      processUrl(text.trim());
    }
  };

  const handleManualPasteClick = async () => {
    if (globalStatus !== 'IDLE') return;
    setLogs(prev => prev.filter(l => l.name !== "CLIPBOARD"));

    if (!navigator.clipboard) {
         setLogs([{ name: "CLIPBOARD", status: 'FAILED', error: "Clipboard API not supported in this browser." }]);
         urlInputRef.current?.focus();
         return;
    }

    try {
        const clipboardItems = await navigator.clipboard.read();
        let foundContent = false;
        
        for (const item of clipboardItems) {
            const imageTypes = item.types.filter(type => type.startsWith('image/'));
            if (imageTypes.length > 0) {
                const blob = await item.getType(imageTypes[0]);
                const file = new File([blob], `pasted_image_${Date.now()}.png`, { type: blob.type });
                
                const dt = new DataTransfer();
                dt.items.add(file);
                handleFiles(dt.files);
                foundContent = true;
                break;
            }
        }
        if (!foundContent) throw new Error("No image content found");
    } catch (err: any) {
        try {
            const text = await navigator.clipboard.readText();
            if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                setUrlInput(text.trim());
                processUrl(text.trim());
            } else if (text) {
                 setLogs([{ name: "CLIPBOARD", status: 'FAILED', error: "Clipboard content is not a valid URL." }]);
                 urlInputRef.current?.focus();
            } else {
                 setLogs([{ name: "CLIPBOARD", status: 'FAILED', error: "Clipboard is empty." }]);
                 urlInputRef.current?.focus();
            }
        } catch (textErr: any) {
             setLogs([{ name: "CLIPBOARD", status: 'FAILED', error: t('clipboard_denied', lang) }]);
             urlInputRef.current?.focus();
        }
    }
  };

  // Global Paste Handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (globalStatus !== 'IDLE') return;

      if (e.clipboardData) {
          if (e.clipboardData.files.length > 0) {
            e.preventDefault();
            handleFiles(e.clipboardData.files);
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

    if (isActive) window.addEventListener('paste', handlePaste);
    return () => { if (isActive) window.removeEventListener('paste', handlePaste); };
  }, [globalStatus, isActive]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => { setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (globalStatus === 'IDLE') handleFiles(e.dataTransfer.files); };

  const pasteTip = isMobile ? t('paste_tip_mobile', lang) : t('paste_tip_desktop', lang);

  return (
    <div className={`w-full mx-auto mt-4 md:mt-10 transition-all duration-300 ${isFullWidth ? 'max-w-none' : 'max-w-2xl'}`}>
      
      {/* MOBILE UPLOAD BUTTON */}
      <div className="md:hidden flex flex-col gap-2">
          <button
            onClick={() => globalStatus === 'IDLE' && fileInputRef.current?.click()}
            className={`
                w-full p-8 rounded-lg shadow-lg flex flex-col items-center justify-center gap-4 transition-all active:scale-95
                ${globalStatus === 'PROCESSING' 
                    ? 'bg-yellow-100 border-2 border-yellow-500 text-yellow-800' 
                    : 'bg-terminal-green text-terminal-btn-text shadow-[0_0_15px_var(--color-term-green)] border border-terminal-green'
                }
            `}
          >
              <div className="text-4xl">
                  {globalStatus === 'PROCESSING' ? <span className="animate-spin inline-block">⏳</span> : '📂'}
              </div>
              <div className="text-xl font-bold uppercase tracking-wider">
                  {globalStatus === 'PROCESSING' ? t('analyzing_batch', lang) : t('tap_to_select', lang)}
              </div>
          </button>
          
          <button
             onClick={handleManualPasteClick}
             disabled={globalStatus !== 'IDLE'}
             className="w-full py-3 bg-gray-200 dark:bg-terminal-gray border border-gray-400 dark:border-terminal-border rounded text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-terminal-green active:bg-gray-300 dark:active:bg-gray-800 flex items-center justify-center gap-2"
          >
              <span>📋</span> {t('paste_from_clipboard', lang)}
          </button>
      </div>

      {/* DESKTOP UPLOAD ZONE */}
      <div 
        className={`
          hidden md:block
          border-2 border-dashed transition-all p-12 text-center cursor-pointer relative overflow-hidden rounded-lg group
          text-gray-400 dark:text-terminal-green
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02] shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
            : globalStatus === 'PROCESSING'
                ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 cursor-wait'
                : 'border-gray-400 dark:border-terminal-green/50 hover:border-blue-400 dark:hover:border-terminal-green hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
          }
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => globalStatus === 'IDLE' && fileInputRef.current?.click()}
      >
        {/* Dynamic Theme Pattern Background */}
        <div 
            className="absolute inset-0 opacity-5 dark:opacity-20 pointer-events-none transition-opacity duration-500" 
            style={{ 
                backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', 
                backgroundSize: '24px 24px' 
            }}
        ></div>

        <div className="space-y-4 relative z-10 flex flex-col items-center justify-center">
          <div className="text-5xl transition-transform group-hover:scale-110 duration-300 filter drop-shadow-md">
             {globalStatus === 'PROCESSING' ? (
                 <span className="inline-block animate-spin text-yellow-500 dark:text-terminal-green">⏳</span>
             ) : (
                 <span className="text-gray-600 dark:text-terminal-green">🛡️</span>
             )}
          </div>

          <div className="flex flex-col gap-1">
              <h3 className="text-2xl font-bold uppercase tracking-widest text-gray-800 dark:text-terminal-light group-hover:text-blue-600 dark:group-hover:text-terminal-green transition-colors">
                {globalStatus === 'PROCESSING' ? t('analyzing_batch', lang) : t('secure_upload', lang)}
              </h3>
              <div className="h-0.5 w-1/3 bg-gray-300 dark:bg-terminal-green/30 mx-auto rounded-full"></div>
          </div>
          
          <p className="text-sm opacity-80 font-mono text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
            {globalStatus === 'PROCESSING' 
             ? t('executing_protocols', lang)
             : "Drag & Drop PDF, PNG, JPG here or Click to Browse"}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-terminal-dimGreen font-bold uppercase tracking-[0.2em] mt-2 border border-gray-200 dark:border-terminal-border px-3 py-1 rounded-full bg-white dark:bg-[#1a1a1a]">
            Max 15MB per file / 50MB Total
          </p>
        </div>

        {/* Scanning overlay effect */}
        {globalStatus === 'PROCESSING' && (
            <div className="absolute inset-0 bg-terminal-green/5 animate-pulse z-0"></div>
        )}
      </div>

      <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,.jpg,.jpeg,.png"
          multiple 
          onChange={(e) => handleFiles(e.target.files)}
          disabled={globalStatus !== 'IDLE'}
      />

      {/* Processing Logs */}
      {logs.length > 0 && (
          <div className="mt-6 border border-gray-300 dark:border-terminal-border bg-gray-100 dark:bg-terminal-gray p-4 rounded shadow-inner font-mono text-xs animate-fade-in">
              <div className="text-xs font-bold uppercase text-gray-500 dark:text-terminal-green mb-2 border-b border-gray-300 dark:border-terminal-border pb-1">Session Log</div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                  {logs.map((log, i) => (
                      <div key={i} className="flex justify-between items-start py-1 border-b border-gray-200 dark:border-terminal-border/30 last:border-0">
                          <span className="truncate max-w-[60%] md:max-w-[50%] text-gray-700 dark:text-terminal-light pt-1" title={log.name}>{log.name}</span>
                          <div className="flex flex-col items-end gap-1 justify-end text-right flex-grow pl-2">
                              {log.status === 'PENDING' && <span className="text-gray-500">WAITING</span>}
                              {log.status === 'SCANNING' && <span className="text-blue-500 dark:text-terminal-green animate-pulse">SCANNING...</span>}
                              {log.status === 'SUCCESS' && <span className="text-green-600 dark:text-terminal-green font-bold">✓ SAFE</span>}
                              {log.status === 'FAILED' && (
                                  <div className="flex flex-col items-end w-full">
                                      <span className="text-red-500 dark:text-terminal-alert font-bold uppercase tracking-wider">✕ BLOCKED</span>
                                      {log.error && (
                                          <span className="text-[10px] text-red-600 dark:text-terminal-alert font-semibold mt-1 text-right w-full break-words leading-tight bg-red-50 dark:bg-red-900/20 p-1 rounded border border-red-100 dark:border-terminal-alert/30">
                                              {log.error}
                                          </span>
                                      )}
                                  </div>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="flex items-center my-6">
          <div className="h-px bg-gray-300 dark:bg-terminal-border flex-grow"></div>
          <span className="px-4 text-[10px] md:text-xs text-gray-500 dark:text-gray-500 font-mono uppercase">{t('or_via_network', lang)}</span>
          <div className="h-px bg-gray-300 dark:bg-terminal-border flex-grow"></div>
      </div>

      <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-3 relative z-10">
          <div className="relative flex-grow group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 dark:from-terminal-green dark:to-terminal-dimGreen rounded-md blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <input 
                  type="url" 
                  ref={urlInputRef}
                  placeholder="https://example.com/document.pdf" 
                  className="relative w-full bg-white dark:bg-[#0c0c0c] border-2 border-gray-300 dark:border-terminal-border p-3 pl-10 font-mono text-sm outline-none focus:border-blue-500 dark:focus:border-terminal-green rounded-md dark:text-terminal-light placeholder-gray-400 dark:placeholder-gray-600 transition-all shadow-sm"
                  value={urlInput}
                  onChange={handleUrlChange}
                  onPaste={handleUrlPaste}
                  disabled={globalStatus !== 'IDLE'}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-terminal-green">
                  🌐
              </div>
          </div>
          <button 
             type="submit" 
             disabled={!urlInput || globalStatus !== 'IDLE'}
             className="relative overflow-hidden group w-full sm:w-auto px-8 py-3 bg-gray-900 dark:bg-terminal-green text-white dark:text-terminal-btn-text font-bold text-sm uppercase rounded-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg"
          >
            <span className="relative z-10">{t('fetch', lang)}</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </button>
      </form>
      <div className="text-center mt-2 text-[9px] text-gray-400 dark:text-gray-500">
          {pasteTip}
      </div>

      {/* DEMO & AI BUILDER SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-8">
          
          {/* DEMO CARD */}
          <div className="relative group overflow-hidden bg-white dark:bg-[#1a1a1a] border-2 border-gray-200 dark:border-terminal-border hover:border-yellow-500 dark:hover:border-yellow-500 rounded-xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex flex-col items-center relative z-10">
                  <div className="w-16 h-16 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform border border-yellow-200 dark:border-yellow-700/50">
                      ⚡
                  </div>
                  <h4 className="font-bold text-lg text-gray-800 dark:text-terminal-light mb-1 font-mono">{t('quick_test', lang)}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 text-center leading-relaxed max-w-[200px]">
                      Instant diagnostic simulation. No files required.
                  </p>
                  <button 
                      onClick={onLoadDemo}
                      disabled={globalStatus !== 'IDLE'}
                      className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-white dark:text-black font-bold text-xs uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      <span>🚀</span> {t('load_demo', lang)}
                  </button>
              </div>
          </div>

          {/* AI BUILDER CARD */}
          <div className="relative group overflow-hidden bg-white dark:bg-[#1a1a1a] border-2 border-gray-200 dark:border-terminal-border hover:border-blue-500 dark:hover:border-terminal-green rounded-xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 dark:from-terminal-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex flex-col items-center relative z-10">
                  <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-terminal-green/10 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform border border-blue-200 dark:border-terminal-green/30">
                      🤖
                  </div>
                  <h4 className="font-bold text-lg text-gray-800 dark:text-terminal-light mb-1 font-mono">{t('builder_card_title', lang)}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 text-center leading-relaxed max-w-[200px]">
                      {t('builder_card_desc', lang)}
                  </p>
                  <button 
                      onClick={onStartBuilder}
                      disabled={globalStatus !== 'IDLE'}
                      className="w-full py-3 bg-blue-600 dark:bg-terminal-green hover:bg-blue-500 dark:hover:bg-terminal-dimGreen text-white dark:text-terminal-btn-text font-bold text-xs uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      <span>✨</span> {t('start_builder', lang)}
                  </button>
              </div>
          </div>

      </div>
    </div>
  );
};
