import { Question } from "../types";

const STORAGE_KEY = "zplus_question_library";

export const getLibrary = (): Question[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse library", e);
    return [];
  }
};

export const saveQuestion = (question: Question) => {
  const library = getLibrary();
  // Check if already exists
  if (library.some(q => q.id === question.id)) return; // No duplicates
  
  const newLibrary = [question, ...library];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newLibrary));
};

export const removeQuestion = (questionId: string) => {
  const library = getLibrary();
  const newLibrary = library.filter(q => q.id !== questionId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newLibrary));
};

export const isQuestionSaved = (questionId: string): boolean => {
  const library = getLibrary();
  return library.some(q => q.id === questionId);
};