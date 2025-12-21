
import React from 'react';
import { Badge } from '../types';

interface LevelUpOverlayProps {
    xpGained: number;
    streakBonus: number;
    leveledUp: boolean;
    newLevel: number;
    newBadges: Badge[];
    onClose: () => void;
}

export const LevelUpOverlay: React.FC<LevelUpOverlayProps> = ({ xpGained, streakBonus, leveledUp, newLevel, newBadges, onClose }) => {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div className="flex flex-col items-center gap-6 p-8 max-w-lg w-full text-center" onClick={(e) => e.stopPropagation()}>
                
                {/* XP GAINED */}
                <div className="animate-bounce-in">
                    <div className="text-6xl mb-2">⚡</div>
                    <h2 className="text-4xl font-black text-terminal-green font-mono drop-shadow-[0_0_10px_rgba(0,255,65,0.8)]">
                        +{xpGained} XP
                    </h2>
                    {streakBonus > 0 && <p className="text-orange-500 font-bold text-sm mt-1">STREAK BONUS APPLIED!</p>}
                </div>

                {/* LEVEL UP */}
                {leveledUp && (
                    <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 p-1 rounded-lg w-full animate-pulse-slow transform scale-110">
                        <div className="bg-black p-4 rounded flex flex-col items-center">
                            <span className="text-yellow-500 font-bold tracking-[0.5em] text-xs">SYSTEM UPGRADE</span>
                            <div className="text-3xl font-bold text-white mt-1">LEVEL {newLevel}</div>
                        </div>
                    </div>
                )}

                {/* BADGES */}
                {newBadges.length > 0 && (
                    <div className="flex flex-col gap-3 w-full">
                        <span className="text-blue-400 text-xs font-bold tracking-widest uppercase">Badges Unlocked</span>
                        <div className="flex justify-center gap-4 flex-wrap">
                            {newBadges.map(b => (
                                <div key={b.id} className="flex flex-col items-center bg-gray-800 p-3 rounded-lg border border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-slide-up">
                                    <span className="text-4xl mb-1">{b.icon}</span>
                                    <span className="text-xs font-bold text-white">{b.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button 
                    onClick={onClose}
                    className="mt-8 px-8 py-3 bg-white text-black font-bold uppercase tracking-widest rounded-full hover:scale-105 transition-transform"
                >
                    CONTINUE
                </button>
            </div>
        </div>
    );
};
