
import React, { useRef, useState, useEffect } from 'react';
import { validateFile, fileToBase64, urlToBase64 } from '../utils/fileValidation';
import { scanFileWithVirusTotal } from '../utils/virusTotal';
import { sanitizeInput } from '../utils/security';

interface FileUploadProps {
  onFilesAccepted: (files: Array<{base64: string, mime: string, name: string}>) => void;
  isFullWidth: boolean;
}

interface ProcessingLog {
    name: string;
    status: 'PENDING' | 'SCANNING' | 'SUCCESS' | 'FAILED';
    error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesAccepted, isFullWidth }) => {
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [globalStatus, setGlobalStatus] = useState<'IDLE' | 'PROCESSING'>('IDLE');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0 && globalStatus === 'IDLE') {
        e.preventDefault();
        handleFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [globalStatus]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    const newFiles = Array.from(fileList);
    setGlobalStatus('PROCESSING');
    
    // Initialize logs for these files
    const newLogs: ProcessingLog[] = newFiles.map(f => ({ name: f.name, status: 'PENDING' }));
    setLogs(prev => [...newLogs]); // Reset logs for new batch or append? Let's reset for cleaner UI in single batch mode.

    const successfulFiles: Array<{base64: string, mime: string, name: string}> = [];

    // Process Sequentially (to avoid rate limiting VirusTotal public API)
    // For a production app with paid key, Promise.all is better.
    for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        
        // Update status to scanning
        setLogs(prev => prev.map(l => l.name === file.name ? { ...l, status: 'SCANNING' } : l));

        try {
            // 1. Validation
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

            // Success
            successfulFiles.push({ base64, mime: validationCheck.mimeType, name: file.name });
            setLogs(prev => prev.map(l => l.name === file.name ? { ...l, status: 'SUCCESS' } : l));

        } catch (e: any) {
            setLogs(prev => prev.map(l => l.name === file.name ? { ...l, status: 'FAILED', error: e.message } : l));
        }
    }

    setGlobalStatus('IDLE');

    if (successfulFiles.length > 0) {
        // Small delay to let user see success ticks before proceeding
        setTimeout(() => {
            onFilesAccepted(successfulFiles);
        }, 1000);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const validation = sanitizeInput(val, 500); 
      setUrlInput(validation.sanitizedValue);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    
    if (urlInput.toLowerCase().includes('javascript:')) return;

    setGlobalStatus('PROCESSING');
    setLogs([{ name: urlInput, status: 'SCANNING' }]);
    
    try {
       const { base64, mimeType, name } = await urlToBase64(urlInput);
       setLogs([{ name: name, status: 'SUCCESS' }]);
       setTimeout(() => onFilesAccepted([{ base64, mime: mimeType, name }]), 800);
    } catch (err: any) {
        setLogs([{ name: urlInput, status: 'FAILED', error: err.message }]);
    }
    setGlobalStatus('IDLE');
  };

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
    <div className={`w-full mx-auto mt-10 transition-all duration-300 ${isFullWidth ? 'max-w-none' : 'max-w-2xl'}`}>
      <div 
        className={`
          border-2 border-dashed transition-all p-10 text-center cursor-pointer relative overflow-hidden
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : globalStatus === 'PROCESSING'
                ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 cursor-wait'
                : 'border-gray-400 dark:border-terminal-green hover:border-blue-400 dark:hover:border-white'
          }
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => globalStatus === 'IDLE' && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,.jpg,.jpeg,.png"
          multiple // ENABLE MULTIPLE FILES
          onChange={(e) => handleFiles(e.target.files)}
          disabled={globalStatus !== 'IDLE'}
        />
        
        <div className="space-y-4 relative z-10">
          <div className="text-4xl">
             {globalStatus === 'PROCESSING' ? (
                 <span className="inline-block animate-spin">🛡️</span>
             ) : (
                 <span>🛡️</span>
             )}
          </div>

          <h3 className="text-xl font-bold uppercase">
            {globalStatus === 'PROCESSING' ? 'ANALYZING BATCH...' : 'SECURE FILE UPLOAD'}
          </h3>
          
          <p className="text-sm opacity-70 font-mono">
            {globalStatus === 'PROCESSING' 
             ? 'Executing Security Protocols on individual files...'
             : 'Drag & Drop Multiple PDFs/Images (VirusTotal Integrated)'}
          </p>
        </div>

        {/* Scanning overlay effect */}
        {globalStatus === 'PROCESSING' && (
            <div className="absolute inset-0 bg-green-500/5 animate-pulse z-0"></div>
        )}
      </div>

      {/* Processing Logs */}
      {logs.length > 0 && (
          <div className="mt-6 border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-4 rounded shadow-inner font-mono text-xs">
              <div className="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Session Log</div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                  {logs.map((log, i) => (
                      <div key={i} className="flex justify-between items-center">
                          <span className="truncate max-w-[70%]">{log.name}</span>
                          <div className="flex items-center gap-2">
                              {log.status === 'PENDING' && <span className="text-gray-500">WAITING</span>}
                              {log.status === 'SCANNING' && <span className="text-blue-500 animate-pulse">SCANNING...</span>}
                              {log.status === 'SUCCESS' && <span className="text-green-500 font-bold">✓ SAFE</span>}
                              {log.status === 'FAILED' && <span className="text-red-500 font-bold">✕ BLOCKED</span>}
                          </div>
                          {log.error && <div className="w-full text-red-400 italic pl-2">{log.error}</div>}
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="flex items-center my-6">
          <div className="h-px bg-gray-300 dark:bg-gray-700 flex-grow"></div>
          <span className="px-4 text-xs text-gray-500 font-mono uppercase">OR VIA NETWORK</span>
          <div className="h-px bg-gray-300 dark:bg-gray-700 flex-grow"></div>
      </div>

      <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <input 
            type="url" 
            placeholder="https://example.com/document.pdf" 
            className="flex-grow bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-700 p-3 font-mono text-sm outline-none focus:border-terminal-green"
            value={urlInput}
            onChange={handleUrlChange}
            disabled={globalStatus !== 'IDLE'}
          />
          <button 
             type="submit"
             disabled={!urlInput || globalStatus !== 'IDLE'}
             className="px-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 border border-gray-400 dark:border-gray-600 font-bold text-sm disabled:opacity-50"
          >
            FETCH
          </button>
      </form>
    </div>
  );
};
