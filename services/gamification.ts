
import { UserProfile, Badge, ThemeOption } from "../types";

const STORAGE_KEY = "zplus_user_profile_v1";

const DEFAULT_PROFILE: UserProfile = {
    username: "Agent",
    avatar: "👨‍💻",
    xp: 0,
    level: 1,
    currentStreak: 0,
    lastExamDate: "",
    stats: {
        totalExams: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        perfectScores: 0
    },
    badges: [],
    unlockedThemes: ['light', 'dark', 'palestine']
};

const BADGES_DB: Omit<Badge, 'unlockedAt'>[] = [
    { id: 'first_blood', name: 'First Blood', description: 'Complete your first exam', icon: '🩸', rarity: 'common' },
    { id: 'streak_3', name: 'On Fire', description: 'Achieve a 3-day streak', icon: '🔥', rarity: 'rare' },
    { id: 'perfect_score', name: 'Z+ Elite', description: 'Get 100% on an exam', icon: '🏆', rarity: 'epic' },
    { id: 'veteran', name: 'Veteran', description: 'Complete 10 exams', icon: '🎖️', rarity: 'rare' },
    { id: 'coder', name: 'Code Master', description: 'Solve 50 coding questions', icon: '💻', rarity: 'epic' },
    { id: 'night_owl', name: 'Night Owl', description: 'Complete an exam between 12AM and 4AM', icon: '🦉', rarity: 'rare' }
];

export const getLevelThreshold = (level: number) => Math.floor(100 * Math.pow(level, 1.5));

export class GamificationService {
    private profile: UserProfile;

    constructor() {
        const stored = localStorage.getItem(STORAGE_KEY);
        this.profile = stored ? JSON.parse(stored) : DEFAULT_PROFILE;
    }

    getProfile(): UserProfile {
        return { ...this.profile };
    }

    saveProfile() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    }

    updateAvatar(avatar: string) {
        this.profile.avatar = avatar;
        this.saveProfile();
        return this.profile;
    }

    updateUsername(name: string) {
        this.profile.username = name.slice(0, 15);
        this.saveProfile();
        return this.profile;
    }

    processExamResult(score: number, totalQuestions: number, correctCount: number) {
        const now = new Date();
        const today = now.toDateString();
        const lastDate = this.profile.lastExamDate ? new Date(this.profile.lastExamDate).toDateString() : "";

        // 1. Streak Logic
        let streakBonus = 0;
        if (today !== lastDate) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDate === yesterday.toDateString()) {
                this.profile.currentStreak++;
                streakBonus = this.profile.currentStreak * 10;
            } else {
                this.profile.currentStreak = 1; // Reset or start new
            }
            this.profile.lastExamDate = now.toISOString();
        }

        // 2. XP Calculation
        // Base: 10 per correct answer + Score bonus
        const baseXP = (correctCount * 10) + score; 
        const totalXP = baseXP + streakBonus;
        
        this.profile.xp += totalXP;

        // 3. Level Up Logic
        let leveledUp = false;
        let nextThreshold = getLevelThreshold(this.profile.level);
        while (this.profile.xp >= nextThreshold) {
            this.profile.xp -= nextThreshold;
            this.profile.level++;
            leveledUp = true;
            nextThreshold = getLevelThreshold(this.profile.level);
            
            // Unlock Themes based on level
            if (this.profile.level >= 3 && !this.profile.unlockedThemes.includes('cyberpunk')) {
                this.profile.unlockedThemes.push('cyberpunk');
            }
            if (this.profile.level >= 5 && !this.profile.unlockedThemes.includes('synthwave')) {
                this.profile.unlockedThemes.push('synthwave');
            }
        }

        // 4. Stats Update
        this.profile.stats.totalExams++;
        this.profile.stats.totalQuestions += totalQuestions;
        this.profile.stats.correctAnswers += correctCount;
        if (score === 100) this.profile.stats.perfectScores++;

        // 5. Badge Checks
        const newBadges: Badge[] = [];
        const checkBadge = (id: string, condition: boolean) => {
            if (condition && !this.profile.badges.some(b => b.id === id)) {
                const badgeDef = BADGES_DB.find(b => b.id === id);
                if (badgeDef) {
                    const newBadge = { ...badgeDef, unlockedAt: new Date().toISOString() };
                    this.profile.badges.push(newBadge);
                    newBadges.push(newBadge);
                }
            }
        };

        checkBadge('first_blood', this.profile.stats.totalExams >= 1);
        checkBadge('streak_3', this.profile.currentStreak >= 3);
        checkBadge('perfect_score', score === 100);
        checkBadge('veteran', this.profile.stats.totalExams >= 10);
        
        const hour = now.getHours();
        checkBadge('night_owl', hour >= 0 && hour < 4);

        this.saveProfile();

        return {
            profile: this.profile,
            xpGained: totalXP,
            streakBonus,
            leveledUp,
            newBadges
        };
    }
    
    exportData() {
        return btoa(JSON.stringify(this.profile));
    }
    
    importData(base64: string) {
        try {
            const parsed = JSON.parse(atob(base64));
            if (parsed.username && parsed.level) {
                this.profile = parsed;
                this.saveProfile();
                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }
}

export const gamification = new GamificationService();
