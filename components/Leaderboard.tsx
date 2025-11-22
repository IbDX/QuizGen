import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from '../types';

export const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('exam_leaderboard');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setScores(parsed.sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score).slice(0, 5));
      } catch (e) {
        console.error("Failed to parse leaderboard", e);
      }
    }
  }, []);

  if (scores.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto mt-8 border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-lg">
      <h3 className="text-center font-bold border-b border-gray-300 dark:border-gray-700 pb-2 mb-4 tracking-wider text-sm">
        ★ TOP AGENTS ★
      </h3>
      <div className="space-y-2">
        {scores.map((entry, i) => (
          <div key={i} className="flex justify-between items-center text-xs md:text-sm font-mono p-2 bg-gray-50 dark:bg-black border border-transparent hover:border-terminal-green transition-colors">
            <div className="flex items-center gap-3">
              <span className={`font-bold w-4 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                #{i + 1}
              </span>
              <span className="uppercase">{entry.name}</span>
            </div>
            <div className="flex items-center gap-4">
                <span className="opacity-50 text-[10px]">{new Date(entry.date).toLocaleDateString()}</span>
                <span className="font-bold text-terminal-green">{entry.score}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};