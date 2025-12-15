
import { Question, SavedExam } from "../types";
import { compressData, decompressData } from "../utils/crypto";
import { validateExamSchema } from "../utils/security";

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
  if (library.some(q => q.id === question.id)) return;
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
    
    const newExams = [newExam, ...exams];
    localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(newExams));
    return newExam.id;
};

export const importSavedExam = async (content: string): Promise<boolean> => {
    try {
        // 1. Decompress & Decrypt (if applicable)
        const examData = await decompressData(content);
        
        // 2. Security Schema Validation
        if (!validateExamSchema(examData)) {
            console.error("Schema validation failed for imported exam.");
            return false;
        }
        
        const exams = getSavedExams();
        const newExam: SavedExam = {
            id: `exam_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            title: examData.title ? `${examData.title} (Imported)` : `Imported Exam ${new Date().toLocaleDateString()}`,
            date: new Date().toISOString(),
            questions: examData.questions
        };
        
        const newExams = [newExam, ...exams];
        localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(newExams));
        return true;
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
};

export const removeExam = (examId: string) => {
    const exams = getSavedExams();
    const newExams = exams.filter(e => e.id !== examId);
    localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(newExams));
};

// --- DOWNLOAD HELPER ---
export const triggerExamDownload = async (questions: Question[], title: string) => {
    const exportData = {
        id: `exam_${Date.now()}`,
        title: title,
        date: new Date().toISOString(),
        questions: questions
    };

    // Compress data
    const compressedString = await compressData(exportData);
    
    // Create Blob
    const blob = new Blob([compressedString], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const exportFileDefaultName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.zplus`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    URL.revokeObjectURL(url);
};
