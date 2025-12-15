
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

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
            if (!validationCheck.valid || !validationCheck.mimeType) throw new Error(validationCheck.error || 'Invalid file type');
            const [scanResult, base64] = await Promise.all([scanFileWithVirusTotal(file), fileToBase64(file)]);
            if (!scanResult.safe) throw new Error(scanResult.message);
            const hash = scanResult.hash || `unknown_hash_${Date.now()}_${Math.random()}`;
            successfulFiles.push({ base64, mime: validationCheck.mimeType, name: file.name, hash });
            setLogs(prev => prev.map(l => l.name === file.name ? { ...l, status: 'SUCCESS' } : l));
        } catch (e: any) {
            setLogs(prev => prev.map(l => l.name === file.name ? { ...l, status: 'FAILED', error: e.message } : l));
        }
    }
    setGlobalStatus('IDLE');
    if (successfulFiles.length > 0) setTimeout(() => onFilesAccepted(successfulFiles), 1000);
  };

  const processUrl = async (url: string) => {
    if (!url || url.toLowerCase().includes('javascript:')) return;
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

  const handleUrlSubmit = (e: React.FormEvent) => { e.preventDefault(); processUrl(urlInput); };
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => { setUrlInput(sanitizeInput(e.target.value, 500).sanitizedValue); };
  
  // UseEffect for Paste omitted for brevity, keeping existing logic structure
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (globalStatus !== 'IDLE') return;
      if (e.clipboardData) {
          if (e.clipboardData.files.length > 0) { e.preventDefault(); handleFiles(e.clipboardData.files); } 
          else {
            const text = e.clipboardData.getData('text');
            if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                e.preventDefault(); setUrlInput(text.trim()); processUrl(text.trim());
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

  return (
    <div className={`w-full mx-auto mt-8 md:mt-12 transition-all duration-300 ${isFullWidth ? 'max-w-none' : 'max-w-3xl'}`}>
      
      {/* MOBILE UPLOAD */}
      <div className="md:hidden flex flex-col gap-3">
          <button
            onClick={() => globalStatus === 'IDLE' && fileInputRef.current?.click()}
            className={`w-full p-8 rounded-2xl shadow-xl flex flex-col items-center justify-center gap-4 transition-all active:scale-95 border border-terminal-green/30 ${globalStatus === 'PROCESSING' ? 'bg-yellow-50 text-yellow-700' : 'bg-terminal-surface text-terminal-green'}`}
          >
              <div className="text-4xl">{globalStatus === 'PROCESSING' ? <span className="animate-spin inline-block">⏳</span> : '📂'}</div>
              <div className="text-lg font-bold uppercase tracking-wider">{globalStatus === 'PROCESSING' ? t('analyzing_batch', lang) : t('tap_to_select', lang)}</div>
          </button>
      </div>

      {/* DESKTOP UPLOAD */}
      <div 
        className={`
          hidden md:block
          border-2 border-dashed transition-all p-12 text-center cursor-pointer relative overflow-hidden rounded-2xl group
          ${isDragging 
            ? 'border-terminal-green bg-terminal-green/5 scale-[1.01]' 
            : globalStatus === 'PROCESSING'
                ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 cursor-wait'
                : 'border-terminal-gray/30 bg-terminal-surface hover:border-terminal-green hover:bg-terminal-surface/80'
          }
        `}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => globalStatus === 'IDLE' && fileInputRef.current?.click()}
      >
        <div className="space-y-4 relative z-10">
          <div className="text-5xl transition-transform group-hover:scale-110 duration-300 drop-shadow-md">
             {globalStatus === 'PROCESSING' ? <span className="inline-block animate-spin">🛡️</span> : '🛡️'}
          </div>
          <h3 className="text-2xl font-bold uppercase text-terminal-light">{globalStatus === 'PROCESSING' ? t('analyzing_batch', lang) : t('secure_upload', lang)}</h3>
          <p className="text-base text-gray-500 dark:text-gray-400 font-sans">Drag & Drop PDF, PNG, JPG here or Click to Browse</p>
          <div className="inline-block px-3 py-1 rounded-full bg-terminal-gray/10 text-xs font-bold text-gray-500 uppercase tracking-widest border border-terminal-gray/20">Max 15MB/file • Encrypted</div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(e) => handleFiles(e.target.files)} disabled={globalStatus !== 'IDLE'} />

      {/* LOGS */}
      {logs.length > 0 && (
          <div className="mt-6 border border-terminal-gray/20 bg-terminal-surface p-4 rounded-xl shadow-inner font-mono text-xs animate-fade-in max-h-48 overflow-y-auto">
              <div className="text-xs font-bold uppercase text-gray-500 mb-2 border-b border-terminal-gray/10 pb-2">Session Log</div>
              <div className="space-y-2">
                  {logs.map((log, i) => (
                      <div key={i} className="flex justify-between items-start text-terminal-light">
                          <span className="truncate max-w-[60%] opacity-80">{log.name}</span>
                          <span className={`font-bold ${log.status === 'SUCCESS' ? 'text-terminal-green' : log.status === 'FAILED' ? 'text-terminal-alert' : 'text-blue-400'}`}>
                              {log.status === 'SUCCESS' ? 'SAFE ✓' : log.status}
                          </span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* URL INPUT */}
      <div className="flex items-center my-8">
          <div className="h-px bg-terminal-gray/20 flex-grow"></div>
          <span className="px-4 text-xs text-gray-400 font-bold uppercase tracking-widest">{t('or_via_network', lang)}</span>
          <div className="h-px bg-terminal-gray/20 flex-grow"></div>
      </div>

      <form onSubmit={handleUrlSubmit} className="flex gap-3 relative z-10 max-w-2xl mx-auto">
          <div className="relative flex-grow group">
              <input 
                  type="url" ref={urlInputRef} placeholder="https://example.com/document.pdf" 
                  className="w-full bg-terminal-surface border border-terminal-gray/30 p-4 pl-12 rounded-xl text-sm outline-none focus:border-terminal-green focus:ring-1 focus:ring-terminal-green transition-all shadow-sm text-terminal-light placeholder-gray-500"
                  value={urlInput} onChange={handleUrlChange} disabled={globalStatus !== 'IDLE'}
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-50 grayscale group-focus-within:grayscale-0 transition-all">🌐</div>
          </div>
          <button type="submit" disabled={!urlInput || globalStatus !== 'IDLE'} className="px-8 bg-terminal-green hover:bg-terminal-green/90 text-white font-bold text-sm uppercase rounded-xl transition-all shadow-lg hover:shadow-terminal-green/30 disabled:opacity-50 disabled:shadow-none">
            {t('fetch', lang)}
          </button>
      </form>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-10">
          <ActionCard 
              icon="⚡" 
              title={t('quick_test', lang)} 
              desc="Instant diagnostic simulation. No files required." 
              action={t('load_demo', lang)} 
              onClick={onLoadDemo} 
              disabled={globalStatus !== 'IDLE'} 
              colorClass="text-yellow-500"
              bgHover="group-hover:bg-yellow-500/10"
              borderHover="group-hover:border-yellow-500/50"
          />
          <ActionCard 
              icon="🤖" 
              title={t('builder_card_title', lang)} 
              desc={t('builder_card_desc', lang)}
              action={t('start_builder', lang)} 
              onClick={onStartBuilder} 
              disabled={globalStatus !== 'IDLE'} 
              colorClass="text-blue-500 dark:text-terminal-green"
              bgHover="group-hover:bg-blue-500/10 dark:group-hover:bg-terminal-green/10"
              borderHover="group-hover:border-blue-500/50 dark:group-hover:border-terminal-green/50"
          />
      </div>
    </div>
  );
};

const ActionCard = ({ icon, title, desc, action, onClick, disabled, colorClass, bgHover, borderHover }: any) => (
    <div className={`relative group bg-terminal-surface border border-terminal-gray/20 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${borderHover}`}>
        <div className={`absolute inset-0 opacity-0 transition-opacity duration-300 rounded-2xl ${bgHover}`}></div>
        <div className="relative z-10 flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-2xl bg-terminal-gray/5 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform ${colorClass}`}>
                {icon}
            </div>
            <h4 className="font-bold text-lg text-terminal-light mb-2">{title}</h4>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-[220px]">{desc}</p>
            <button onClick={onClick} disabled={disabled} className="w-full py-3 bg-terminal-light/5 hover:bg-terminal-light/10 text-terminal-light font-bold text-xs uppercase tracking-widest rounded-xl transition-colors">
                {action}
            </button>
        </div>
    </div>
);
