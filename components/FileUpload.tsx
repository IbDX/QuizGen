
import React, { useRef, useState, useEffect } from 'react';
import { validateFile, fileToBase64, urlToBase64 } from '../utils/fileValidation';
import { scanFileWithVirusTotal } from '../utils/virusTotal';
import { sanitizeInput } from '../utils/security';

interface FileUploadProps {
  onFileAccepted: (base64: string, mimeType: string, fileName: string) => void;
  isFullWidth: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileAccepted, isFullWidth }) => {
  const [error, setError] = useState<string | null>(null);
  const [threatDetails, setThreatDetails] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'PROCESSING' | 'ERROR'>('IDLE');
  const [scanMessage, setScanMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0 && status === 'IDLE') {
        e.preventDefault();
        handleFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [status]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setStatus('SCANNING');
    setScanMessage('Initializing VirusTotal Threat Scan...');
    setError(null);
    setThreatDetails(null);
    const file = files[0];

    try {
      // 1. Basic Validation & Mime Detection
      const validation = await validateFile(file);
      if (!validation.valid || !validation.mimeType) {
        setError(validation.error || 'Unknown error');
        setStatus('ERROR');
        return;
      }

      // 2. VirusTotal Scan
      setScanMessage('Checking file hash against VirusTotal database...');
      const scanResult = await scanFileWithVirusTotal(file);
      
      if (!scanResult.safe) {
          setError(scanResult.message);
          if (scanResult.threatLabel) {
            setThreatDetails(scanResult.threatLabel);
          }
          setStatus('ERROR');
          return;
      }

      setScanMessage(scanResult.message); // "Safe" message

      // Short delay to show success message
      await new Promise(r => setTimeout(r, 800));
      
      setStatus('PROCESSING');
      
      // 3. Convert and Submit
      const base64 = await fileToBase64(file);
      // Use detected mimeType, NOT file.type
      onFileAccepted(base64, validation.mimeType, file.name);
    } catch (e) {
      setError("Failed to read or verify file.");
      setStatus('ERROR');
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const validation = sanitizeInput(val, 500); // 500 chars max for URL
      setUrlInput(validation.sanitizedValue);
      if (!validation.isValid) {
          setError(validation.error || "Invalid characters in URL");
      } else {
          setError(null);
      }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    
    // Extra check before submitting
    if (urlInput.toLowerCase().includes('javascript:')) {
        setError("Invalid Protocol");
        return;
    }

    setStatus('PROCESSING');
    setError(null);
    setThreatDetails(null);
    
    try {
       const { base64, mimeType, name } = await urlToBase64(urlInput);
       onFileAccepted(base64, mimeType, name);
    } catch (err: any) {
        setError(err.message || "Failed to load URL. Check CORS or format.");
        setStatus('ERROR');
    }
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
    if (status === 'IDLE') {
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
            : status === 'ERROR'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                : 'border-gray-400 dark:border-terminal-green hover:border-blue-400 dark:hover:border-white'
          }
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => status === 'IDLE' && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={status !== 'IDLE'}
        />
        
        <div className="space-y-4 relative z-10">
          <div className="text-4xl">
             {status === 'SCANNING' ? (
                 <span className="inline-block animate-spin">🛡️</span>
             ) : status === 'PROCESSING' ? (
                 <span className="inline-block animate-bounce">📥</span>
             ) : status === 'ERROR' ? (
                 <span>⚠️</span>
             ) : (
                 <span>🛡️</span>
             )}
          </div>

          <h3 className="text-xl font-bold uppercase">
            {status === 'SCANNING' ? 'SECURITY SCAN IN PROGRESS' 
             : status === 'PROCESSING' ? 'PROCESSING PAYLOAD'
             : status === 'ERROR' ? 'UPLOAD REJECTED'
             : 'SECURE FILE UPLOAD'}
          </h3>
          
          <p className="text-sm opacity-70 font-mono">
            {status === 'SCANNING' ? scanMessage 
             : status === 'PROCESSING' ? 'Converting data streams...'
             : 'Drag & Drop PDF/IMG (VirusTotal Integrated)'}
          </p>
          
          {status === 'IDLE' && (
            <div className="text-xs text-gray-400 mt-4">
                [ MAX: 15MB ] • [ PROTECTED BY VIRUSTOTAL ]
            </div>
          )}
        </div>

        {/* Scanning overlay effect */}
        {status === 'SCANNING' && (
            <div className="absolute inset-0 bg-green-500/10 animate-pulse z-0"></div>
        )}
      </div>

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
            disabled={status !== 'IDLE'}
          />
          <button 
             type="submit"
             disabled={!urlInput || status !== 'IDLE'}
             className="px-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 border border-gray-400 dark:border-gray-600 font-bold text-sm disabled:opacity-50"
          >
            FETCH
          </button>
      </form>
      
      {error && (
        <div className="mt-4 p-4 border-l-4 border-red-500 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-mono animate-fade-in shadow-lg">
          <div className="flex items-center gap-2 font-bold mb-1 text-base">
            <span>⚠️ THREAT DETECTED</span>
          </div>
          <div className="mb-2">{error}</div>
          {threatDetails && (
             <div className="bg-red-200 dark:bg-red-900/40 p-2 rounded border border-red-300 dark:border-red-800 text-xs font-bold uppercase tracking-wider">
               DETECTION LABEL: {threatDetails}
             </div>
          )}
        </div>
      )}
    </div>
  );
};
