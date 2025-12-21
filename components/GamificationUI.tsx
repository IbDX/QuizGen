
import React, { useState } from 'react';
import { UserProfile, Badge } from '../types';
import { getLevelThreshold, gamification } from '../services/gamification';
import { t } from '../utils/translations';

// --- HUD COMPONENT ---
export const GamificationHud: React.FC<{ profile: UserProfile, onClick: () => void }> = ({ profile, onClick }) => {
    const threshold = getLevelThreshold(profile.level);
    const progress = Math.min(100, (profile.xp / threshold) * 100);

    return (
        <div onClick={onClick} className="flex items-center gap-3 cursor-pointer group hover:bg-white/5 p-1 rounded-md transition-colors">
            {/* Avatar */}
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-800 border border-terminal-green flex items-center justify-center text-lg shadow-sm group-hover:scale-105 transition-transform">
                {profile.avatar}
            </div>
            
            {/* Stats */}
            <div className="flex flex-col min-w-[80px]">
                <div className="flex justify-between items-end text-[10px] font-bold font-mono text-gray-500 dark:text-gray-400 mb-0.5">
                    <span className="text-terminal-green">LVL {profile.level}</span>
                    <span>{profile.xp}/{threshold} XP</span>
                </div>
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-terminal-green transition-all duration-500 shadow-[0_0_5px_var(--color-term-green)]"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
            
            {/* Streak */}
            {profile.currentStreak > 0 && (
                <div className="hidden md:flex flex-col items-center ml-2">
                    <span className="text-orange-500 text-sm animate-pulse">🔥</span>
                    <span className="text-[9px] font-bold text-orange-500">{profile.currentStreak}</span>
                </div>
            )}
        </div>
    );
};

// --- PROFILE MODAL ---
const AVATARS = ["👨‍💻", "👩‍💻", "🤖", "👽", "🦄", "🐉", "🕵️", "🧙‍♂️", "🧟", "🧠", "⚡", "🔮"];

export const ProfileModal: React.FC<{ profile: UserProfile, onClose: () => void, onUpdate: (p: UserProfile) => void }> = ({ profile, onClose, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(profile.username);
    const [importStr, setImportStr] = useState('');

    const handleSaveName = () => {
        const updated = gamification.updateUsername(newName);
        onUpdate(updated);
        setIsEditing(false);
    };

    const handleSelectAvatar = (av: string) => {
        const updated = gamification.updateAvatar(av);
        onUpdate(updated);
    };
    
    const handleExport = () => {
        const data = gamification.exportData();
        navigator.clipboard.writeText(data).then(() => alert("Profile data copied to clipboard!"));
    };
    
    const handleImport = () => {
        if(gamification.importData(importStr)) {
            onUpdate(gamification.getProfile());
            alert("Profile imported successfully!");
            setImportStr('');
        } else {
            alert("Invalid profile data.");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#0c0c0c] border-2 border-terminal-green w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg shadow-[0_0_40px_rgba(0,255,65,0.15)] overflow-hidden">
                
                {/* Header */}
                <div className="p-6 bg-[#111] border-b border-terminal-green/30 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-mono text-white tracking-widest flex items-center gap-2">
                        <span className="text-2xl">{profile.avatar}</span> AGENT PROFILE
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500">✕</button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-8">
                    
                    {/* ID Card Section */}
                    <div className="flex flex-col md:flex-row gap-6 items-center md:items-start bg-gray-50 dark:bg-[#151515] p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-full bg-black border-2 border-terminal-green flex items-center justify-center text-5xl shadow-lg">
                                {profile.avatar}
                            </div>
                            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                                <span className="text-[10px] text-white font-bold">CHANGE</span>
                            </div>
                            {/* Avatar Picker Grid */}
                            <div className="absolute top-full left-0 mt-2 bg-black border border-terminal-green p-2 rounded grid-cols-4 gap-1 shadow-xl z-50 hidden group-hover:grid w-48">
                                {AVATARS.map(av => (
                                    <button key={av} onClick={() => handleSelectAvatar(av)} className="p-1 hover:bg-white/10 rounded text-lg">{av}</button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-grow space-y-2 text-center md:text-left w-full">
                            <div className="flex items-center justify-center md:justify-start gap-2">
                                {isEditing ? (
                                    <div className="flex gap-2">
                                        <input 
                                            value={newName} 
                                            onChange={(e) => setNewName(e.target.value)} 
                                            className="bg-black border border-terminal-green px-2 py-1 text-white font-mono rounded"
                                        />
                                        <button onClick={handleSaveName} className="text-green-500 font-bold">✓</button>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white font-mono">{profile.username}</h3>
                                        <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-terminal-green text-xs">✏️</button>
                                    </>
                                )}
                            </div>
                            <div className="text-terminal-green font-mono font-bold text-sm tracking-widest">
                                LEVEL {profile.level} • {profile.xp} XP
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 w-full">
                                <StatBox label="STREAK" value={`${profile.currentStreak} Days`} icon="🔥" />
                                <StatBox label="EXAMS" value={profile.stats.totalExams} icon="📝" />
                                <StatBox label="PERFECT" value={profile.stats.perfectScores} icon="🏆" />
                                <StatBox label="ACCURACY" value={`${profile.stats.totalQuestions ? Math.round((profile.stats.correctAnswers/profile.stats.totalQuestions)*100) : 0}%`} icon="🎯" />
                            </div>
                        </div>
                    </div>

                    {/* Badges Section */}
                    <div>
                        <h4 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">Achievement Badges</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {profile.badges.length === 0 ? (
                                <div className="col-span-full text-center py-8 text-gray-600 italic text-sm">No badges earned yet. Complete exams to unlock!</div>
                            ) : (
                                profile.badges.map(badge => (
                                    <div key={badge.id} className="bg-gradient-to-br from-gray-800 to-black p-3 rounded border border-gray-700 flex flex-col items-center text-center gap-2 group hover:border-terminal-green transition-colors">
                                        <div className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform">{badge.icon}</div>
                                        <span className="text-xs font-bold text-white">{badge.name}</span>
                                        <span className="text-[9px] text-gray-400 leading-tight">{badge.description}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Cloud Sync (Mock) */}
                    <div>
                        <h4 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">Cloud Sync (Manual)</h4>
                        <div className="flex gap-2">
                            <button onClick={handleExport} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700">EXPORT PROFILE</button>
                            <div className="flex-grow flex gap-2">
                                <input 
                                    value={importStr}
                                    onChange={(e) => setImportStr(e.target.value)}
                                    placeholder="Paste profile string here..."
                                    className="flex-grow bg-black border border-gray-700 rounded px-2 text-xs text-gray-300"
                                />
                                <button onClick={handleImport} className="px-4 py-2 bg-gray-700 text-white text-xs font-bold rounded hover:bg-gray-600">IMPORT</button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

const StatBox = ({ label, value, icon }: { label: string, value: string | number, icon: string }) => (
    <div className="bg-white dark:bg-black p-2 rounded border border-gray-200 dark:border-gray-800 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <div className="flex flex-col">
            <span className="text-[9px] text-gray-500 font-bold">{label}</span>
            <span className="text-sm font-bold text-gray-800 dark:text-white">{value}</span>
        </div>
    </div>
);
