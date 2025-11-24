import React from 'react';
import { UILanguage } from '../types';
import { t } from '../utils/translations';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  lang: UILanguage;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel, lang }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-terminal-black border-2 border-terminal-alert w-full max-w-md shadow-[0_0_30px_rgba(255,51,51,0.4)] p-6 relative flex flex-col gap-6 rounded-lg">
        <div className="flex items-center gap-3 text-red-600 dark:text-terminal-alert">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <h3 className="font-bold text-xl uppercase tracking-wider">{title}</h3>
        </div>
        <p className="text-gray-700 dark:text-gray-300 font-sans text-base leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end gap-4 mt-4">
          <button 
            onClick={onCancel} 
            className="px-6 py-2 border border-gray-400 dark:border-terminal-gray hover:bg-gray-200 dark:hover:bg-terminal-gray/50 font-bold transition-colors dark:text-terminal-light text-sm rounded"
          >
            {t('cancel_action', lang)}
          </button>
          <button 
            onClick={onConfirm} 
            className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-terminal-alert dark:hover:brightness-125 text-white font-bold transition-colors text-sm rounded"
          >
            {t('confirm_action', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
