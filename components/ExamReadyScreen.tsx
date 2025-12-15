
import React, { useState } from 'react';
import { Question, ExamSettings, UILanguage } from '../types';
import { saveFullExam } from '../services/library';
import { t } from '../utils/translations';

interface ExamReadyScreenProps {
    questions: Question[];
    settings: ExamSettings;
    title?: string;
    onStart: () => void;
    lang: UILanguage;
}

export const ExamReadyScreen: React.FC<ExamReadyScreenProps> = ({ questions, settings, title, onStart, lang }) => {
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const displayTitle = title || `Exam Session ${new Date().toLocaleDateString()}`;

    const handleSaveToLibrary = () => {
        saveFullExam(questions, displayTitle);
        setSaveStatus(t('saved', lang));
        setTimeout(() => setSaveStatus(null), 2000);
    };

    const handleDownload = () => {
        const exportData = {
            id: `exam_${Date.now()}`,
            title: displayTitle,
            date: new Date().toISOString(),
            questions: questions
        };
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `${displayTitle.replace(/\s+/g, '_')}_${Date.now()}.zplus`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 animate-fade-in">
             <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-[#0c0c0c] p-8 rounded-xl border border-gray-200 dark:border-terminal-green/50 shadow-2xl">
                <div className="w-16 h-16 bg-terminal-green rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(0,255,65,0.4)]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
                
                <div>
                    <h3 className="text-2xl font-bold font-mono text-gray-900 dark:text-white mb-2">{t('exam_ready', lang)}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{t('exam_ready_desc', lang)}</p>
                </div>

                <div className="text-left bg-gray-50 dark:bg-black/50 p-4 rounded border border-gray-200 dark:border-gray-800 space-y-2 text-sm font-mono">
                    <div className="flex justify-between">
                        <span className="text-gray-500">{t('suggested_title', lang)}:</span>
                        <span className="font-bold text-blue-600 dark:text-terminal-green truncate max-w-[150px]">{displayTitle}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">{t('questions_count', lang)}:</span>
                        <span className="font-bold dark:text-white">{questions.length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">{t('time_limit', lang)}:</span>
                        <span className="font-bold dark:text-white">
                            {settings.timeLimitMinutes 
                                ? `${settings.timeLimitMinutes} ${t('minutes', lang)}` 
                                : '∞'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">{t('mode', lang)}:</span>
                        <span className="font-bold dark:text-white">{settings.mode}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <button 
                        onClick={onStart}
                        className="w-full py-3 bg-terminal-green hover:bg-terminal-dimGreen text-black font-bold uppercase tracking-widest rounded transition-colors shadow-lg"
                    >
                        {t('start_now', lang)}
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={handleSaveToLibrary}
                            className="w-full py-2 border border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-bold uppercase text-xs rounded transition-colors"
                        >
                            {saveStatus || t('save_library', lang)}
                        </button>
                        <button 
                            onClick={handleDownload}
                            className="w-full py-2 border border-gray-400 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold uppercase text-xs rounded transition-colors"
                        >
                            {t('download_zplus', lang)}
                        </button>
                    </div>
                </div>
             </div>
        </div>
    );
};
