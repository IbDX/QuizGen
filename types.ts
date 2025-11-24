

export enum QuestionType {
  MCQ = 'MCQ',
  TRACING = 'TRACING',
  CODING = 'CODING'
}

export enum QuestionFormatPreference {
  MIXED = 'MIXED', // AI decides best format
  MCQ = 'MCQ',     // Force everything to MCQ
  TRACING = 'TRACING', // Force everything to Tracing
  CODING = 'CODING', // Force everything to Coding
  ORIGINAL = 'ORIGINAL' // Strictly follow source document format
}

export enum ExamMode {
  ONE_WAY = 'ONE_WAY', // No going back, feedback at end
  TWO_WAY = 'TWO_WAY'  // Immediate feedback allowed
}

export type OutputLanguage = 'en' | 'ar' | 'auto';
export type UILanguage = 'en' | 'ar';

export interface Question {
  id: string;
  type: QuestionType;
  topic: string; // Added for weak point analysis
  text: string;
  codeSnippet?: string;
  options?: string[]; // For MCQ
  correctOptionIndex?: number; // For MCQ
  tracingOutput?: string; // For Tracing
  explanation: string;
  visual?: string; // Base64 string of the cropped visual/diagram associated with the question
}

export interface UserAnswer {
  questionId: string;
  answer: string | number; // Index for MCQ, string for others
  isCorrect?: boolean;
  feedback?: string; // AI generated feedback for coding
}

export interface ExamSettings {
  timeLimitMinutes: number;
  mode: ExamMode;
  formatPreference: QuestionFormatPreference;
  outputLanguage: OutputLanguage;
  instructions?: string; // Optional user context/constraints
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
  isElite?: boolean; // Tracks if user got a perfect score (Z+ Badge)
}

export interface SavedExam {
  id: string;
  title: string;
  date: string;
  questions: Question[];
}

export type AppState = 
  | 'UPLOAD'
  | 'CONFIG'
  | 'BUILDER'
  | 'GENERATING'
  | 'EXAM'
  | 'RESULTS'
  | 'LIBRARY';