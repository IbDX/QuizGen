
import React, { useRef, useState, useEffect } from 'react';
import { validateFile, fileToBase64, urlToBase64, validateBatchSize } from '../utils/fileValidation';
import { scanFileWithVirusTotal } from '../utils/virusTotal';
import { sanitizeInput } from '../utils/security';
import { t } from '../utils/translations';
import { UILanguage } from '../types';

interface FileUploadProps {
  onFilesAccepted: (files: Array<{base64: string, mime: string, name: string, hash: string}>) => void;
  onLoadDemo: () => void;
  isFullWidth: boolean;
  lang?: UILanguage;
}

interface ProcessingLog {
    name: string;
    status: 'PENDING' | 'SCANNING' | 'SUCCESS' | 'FAILED';
    error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesAccepted, onLoadDemo, isFullWidth, lang = 'en' }) => {
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [globalStatus, setGlobalStatus] = useState<'IDLE' | 'PROCESSING'>('IDLE');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    const newFiles = Array.from(fileList);

    // 0. Batch Size Check (Strict 20MB)
    const batchCheck = validateBatchSize(newFiles);
    if (!batchCheck.valid) {
        setLogs([{ name: "BATCH UPLOAD", status: 'FAILED', error: batchCheck.error }]);
        return;
    }
    
    setGlobalStatus('PROCESSING');
    
    // Initialize logs for these files
    const newLogs: ProcessingLog[] = newFiles.map(f => ({ name: f.name, status: 'PENDING' }));
    setLogs(prev => [...newLogs]); 

    const successfulFiles: Array<{base64: string, mime: string, name: string, hash: string}> = [];

    // Process Sequentially
    for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        
        // Update status to scanning
        setLogs(prev => prev.map(l => l.name === file.name ? { ...l, status: 'SCANNING' } : l));

        try {
            // 1. Validation (Strict 10MB per file)
            const validationCheck = await validateFile(file);
            if (!validationCheck.valid || !validationCheck.mimeType) {
                throw new Error(validationCheck.error || 'Invalid file type');
            }

            // 2. Security Scan & Conversion
            const [scanResult, base64] = await Promise.all([
                scanFileWithVirusTotal(file),
                fileToBase64(file)
            ]);

            if (!scanResult.safe) {
                throw new Error(scanResult.message);
            }

            // Success - ensure hash is present
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
       // urlToBase64 enforces 10MB limit per file internally
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

  // Global Paste Handler (Files & URLs)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Avoid interfering if user is typing in an input
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
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [globalStatus]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (globalStatus === 'IDLE') {
        handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className={`w-full mx-auto mt-4 md:mt-10 transition-all duration-300 ${isFullWidth ? 'max-w-none' : 'max-w-2xl'}`}>
      
      {/* MOBILE UPLOAD BUTTON */}
      <div className="md:hidden">
          <button
            onClick={() => globalStatus === 'IDLE' && fileInputRef.current?.click()}
            className={`
                w-full p-8 rounded-lg shadow-lg flex flex-col items-center justify-center gap-4 transition-all active:scale-95
                ${globalStatus === 'PROCESSING' 
                    ? 'bg-yellow-100 border-2 border-yellow-500 text-yellow-800' 
                    : 'bg-terminal-green text-terminal-btn-text shadow-terminal-green/30'
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
      </div>

      {/* DESKTOP UPLOAD ZONE */}
      <div 
        className={`
          hidden md:block
          border-2 border-dashed transition-all p-10 text-center cursor-pointer relative overflow-hidden rounded-lg group
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]' 
            : globalStatus === 'PROCESSING'
                ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 cursor-wait'
                : 'border-gray-400 dark:border-terminal-green hover:border-blue-400 dark:hover:border-white hover:bg-gray-50 dark:hover:bg-terminal-green/5'
          }
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => globalStatus === 'IDLE' && fileInputRef.current?.click()}
      >
        <div className="space-y-3 relative z-10">
          <div className="text-4xl transition-transform group-hover:scale-110 duration-300">
             {globalStatus === 'PROCESSING' ? (
                 <span className="inline-block animate-spin">🛡️</span>
             ) : (
                 <span>🛡️</span>
             )}
          </div>

          <h3 className="text-xl font-bold uppercase dark:text-terminal-light">
            {globalStatus === 'PROCESSING' ? t('analyzing_batch', lang) : t('secure_upload', lang)}
          </h3>
          
          <p className="text-sm opacity-70 font-mono dark:text-gray-400">
            {globalStatus === 'PROCESSING' 
             ? t('executing_protocols', lang)
             : "Drag & Drop PDF, PNG, JPG here or Click to Browse"}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-2">
            Max 10MB per file / 20MB Total
          </p>
        </div>

        {/* Scanning overlay effect */}
        {globalStatus === 'PROCESSING' && (
            <div className="absolute inset-0 bg-green-500/5 animate-pulse z-0"></div>
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
          <div className="mt-6 border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-4 rounded shadow-inner font-mono text-xs animate-fade-in">
              <div className="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Session Log</div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                  {logs.map((log, i) => (
                      <div key={i} className="flex justify-between items-start py-1 border-b border-gray-200 dark:border-gray-800 last:border-0">
                          <span className="truncate max-w-[60%] md:max-w-[50%] text-gray-700 dark:text-gray-300 pt-1" title={log.name}>{log.name}</span>
                          <div className="flex flex-col items-end gap-1 justify-end text-right flex-grow pl-2">
                              {log.status === 'PENDING' && <span className="text-gray-500">WAITING</span>}
                              {log.status === 'SCANNING' && <span className="text-blue-500 animate-pulse">SCANNING...</span>}
                              {log.status === 'SUCCESS' && <span className="text-green-500 font-bold">✓ SAFE</span>}
                              {log.status === 'FAILED' && (
                                  <div className="flex flex-col items-end w-full">
                                      <span className="text-red-500 font-bold uppercase tracking-wider">✕ BLOCKED</span>
                                      {log.error && (
                                          <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold mt-1 text-right w-full break-words leading-tight bg-red-50 dark:bg-red-900/20 p-1 rounded border border-red-100 dark:border-red-900">
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
          <div className="h-px bg-gray-300 dark:bg-gray-700 flex-grow"></div>
          <span className="px-4 text-[10px] md:text-xs text-gray-500 font-mono uppercase">{t('or_via_network', lang)}</span>
          <div className="h-px bg-gray-300 dark:bg-gray-700 flex-grow"></div>
      </div>

      <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-2">
          <input 
            type="url" 
            placeholder="https://example.com/document.pdf" 
            className="flex-grow bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-700 p-3 md:p-3 font-mono text-sm outline-none focus:border-terminal-green rounded-sm dark:text-white"
            value={urlInput}
            onChange={handleUrlChange}
            disabled={globalStatus !== 'IDLE'}
          />
          <button 
             type="submit" 
             disabled={!urlInput || globalStatus !== 'IDLE'}
             className="w-full sm:w-auto px-6 py-3 md:py-0 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 border border-gray-400 dark:border-gray-600 font-bold text-sm disabled:opacity-50 rounded-sm dark:text-gray-200"
          >
            {t('fetch', lang)}
          </button>
      </form>
      <div className="text-center mt-2 text-[9px] text-gray-400 dark:text-gray-500">
          Tip: You can Paste (Ctrl+V) files or URLs directly anywhere on this screen.
      </div>

      {/* DEMO SECTION */}
      <div className="flex flex-col items-center mt-6">
          <div className="h-px bg-gray-300 dark:bg-gray-700 w-full mb-6"></div>
          
          <div className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4 md:gap-6 hover:border-terminal-green transition-colors group w-full">
              {/* Placeholder Image for Demo Card */}
              <div className="relative w-full sm:w-24 h-32 sm:h-24 flex-shrink-0 overflow-hidden rounded border border-gray-400 dark:border-gray-600 group-hover:scale-105 transition-transform">
                 <img 
                    src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=150&h=150&q=80" 
                    alt="Demo Source" 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100"
                 />
                 <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
              </div>
              
              <div className="flex-grow text-center sm:text-left w-full">
                  <h4 className="font-bold text-lg text-gray-800 dark:text-gray-100">{t('quick_test', lang)}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {t('demo_desc', lang)}
                  </p>
                  <button 
                     onClick={onLoadDemo}
                     disabled={globalStatus !== 'IDLE'}
                     className="px-6 py-3 md:py-2 bg-terminal-green text-terminal-btn-text font-bold text-sm hover:brightness-110 transition-all w-full sm:w-auto uppercase tracking-wider disabled:opacity-50 rounded-sm shadow-md"
                  >
                      {t('load_demo', lang)}
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};
