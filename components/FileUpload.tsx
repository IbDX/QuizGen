import React, { useRef, useState, useEffect } from 'react';
import { validateFile, fileToBase64, urlToBase64 } from '../utils/fileValidation';

interface FileUploadProps {
  onFileAccepted: (base64: string, mimeType: string, fileName: string) => void;
  isFullWidth: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileAccepted, isFullWidth }) => {
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        handleFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    const file = files[0];

    try {
      const validation = await validateFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Unknown error');
        setIsProcessing(false);
        return;
      }

      const base64 = await fileToBase64(file);
      onFileAccepted(base64, file.type, file.name);
    } catch (e) {
      setError("Failed to read file.");
      setIsProcessing(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
       const { base64, mimeType, name } = await urlToBase64(urlInput);
       onFileAccepted(base64, mimeType, name);
    } catch (err: any) {
        setError(err.message || "Failed to load URL. Check CORS or format.");
        setIsProcessing(false);
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
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={`w-full mx-auto mt-10 transition-all duration-300 ${isFullWidth ? 'max-w-none' : 'max-w-2xl'}`}>
      <div 
        className={`
          border-2 border-dashed transition-all p-10 text-center cursor-pointer relative
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-400 dark:border-terminal-green hover:border-blue-400 dark:hover:border-white'
          }
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFiles(e.target.files)}
        />
        
        <div className="space-y-4">
          <div className="text-4xl animate-bounce-slow">
             {isProcessing ? '⏳' : '📥'}
          </div>
          <h3 className="text-xl font-bold uppercase">
            {isProcessing ? 'Analyzing payload...' : 'Drop File / Paste Image'}
          </h3>
          <p className="text-sm opacity-70">
            Drag & Drop PDF/IMG or Ctrl+V
          </p>
          <div className="text-xs text-gray-400 mt-4">
             [ MAX: 15MB ]
          </div>
        </div>
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
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <button 
             type="submit"
             disabled={!urlInput || isProcessing}
             className="px-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 border border-gray-400 dark:border-gray-600 font-bold text-sm"
          >
            FETCH
          </button>
      </form>
      
      {error && (
        <div className="mt-4 p-3 border border-red-500 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-mono flex items-center gap-2">
          <span>[ERROR]</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};