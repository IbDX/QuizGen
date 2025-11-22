export enum QuestionType {
  MCQ = 'MCQ',
  TRACING = 'TRACING',
  CODING = 'CODING'
}

export enum ExamMode {
  ONE_WAY = 'ONE_WAY', // No going back, feedback at end
  TWO_WAY = 'TWO_WAY'  // Immediate feedback allowed
}

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
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

export type AppState = 
  | 'UPLOAD'
  | 'CONFIG'
  | 'GENERATING'
  | 'EXAM'
  | 'RESULTS'
  | 'LIBRARY';