
import { Question, SavedExam } from "../types";

const QUESTION_STORAGE_KEY = "zplus_question_library";
const EXAM_STORAGE_KEY = "zplus_exam_library";

// --- QUESTION LIBRARY ---
export const getLibrary = (): Question[] => {
  const stored = localStorage.getItem(QUESTION_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse question library", e);
    return [];
  }
};

export const saveQuestion = (question: Question) => {
  const library = getLibrary();
  // Check if already exists
  if (library.some(q => q.id === question.id)) return; // No duplicates
  
  const newLibrary = [question, ...library];
  localStorage.setItem(QUESTION_STORAGE_KEY, JSON.stringify(newLibrary));
};

export const removeQuestion = (questionId: string) => {
  const library = getLibrary();
  const newLibrary = library.filter(q => q.id !== questionId);
  localStorage.setItem(QUESTION_STORAGE_KEY, JSON.stringify(newLibrary));
};

export const isQuestionSaved = (questionId: string): boolean => {
  const library = getLibrary();
  return library.some(q => q.id === questionId);
};

// --- EXAM LIBRARY ---
export const getSavedExams = (): SavedExam[] => {
    const stored = localStorage.getItem(EXAM_STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error("Failed to parse exam library", e);
        return [];
    }
};

export const saveFullExam = (questions: Question[], title?: string) => {
    const exams = getSavedExams();
    const newExam: SavedExam = {
        id: `exam_${Date.now()}`,
        title: title || `Exam Session ${new Date().toLocaleDateString()}`,
        date: new Date().toISOString(),
        questions: questions
    };
    
    // Unshift to add to top
    const newExams = [newExam, ...exams];
    localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(newExams));
    return newExam.id;
};

export const removeExam = (examId: string) => {
    const exams = getSavedExams();
    const newExams = exams.filter(e => e.id !== examId);
    localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(newExams));
};
