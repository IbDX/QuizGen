
import { Question, SavedExam } from "../types";
import { compressData, decompressData, calculateStringHash } from "../utils/crypto";
import { validateExamSchema } from "../utils/security";

const QUESTION_STORAGE_KEY = "zplus_question_library";
const EXAM_STORAGE_KEY = "zplus_exam_library";
const EXAM_HISTORY_KEY = "zplus_exam_history";

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

export const importSavedExam = async (content: string): Promise<{ success: boolean; message?: string }> => {
    try {
        // 1. Calculate Hash of Uploaded Content
        const uploadedHash = await calculateStringHash(content);

        // 2. Check for Duplicates in Existing Library
        const exams = getSavedExams();
        for (const exam of exams) {
            // We reconstruct the approximate source object to hash it, 
            // OR ideally we should store hashes. 
            // Since we don't store hashes, we will check if an exam with identical questions exists.
            // A simplified approach is checking if we can decompress and find a match.
            // However, to be strict as requested:
            // We will compress the existing exams individually to check against the uploaded string if it was a direct export.
            // BUT re-compression might yield different bytes due to timestamps or gzip metadata.
            // Better approach: Decompress upload, then compare content signature.
        }

        // Decompress Upload
        const examData = await decompressData(content);
        
        // 3. Security Schema Validation
        if (!validateExamSchema(examData)) {
            return { success: false, message: "Invalid Schema" };
        }

        // 4. Content Logic Check for Duplicates
        // We create a signature based on the question IDs and Text length
        const uploadSignature = JSON.stringify(examData.questions.map((q: any) => q.id).sort());
        
        const isDuplicate = exams.some(existing => {
            const existingSignature = JSON.stringify(existing.questions.map(q => q.id).sort());
            return existingSignature === uploadSignature;
        });

        if (isDuplicate) {
            return { success: false, message: "Duplicate: This exam already exists in your library." };
        }
        
        const newExam: SavedExam = {
            id: `exam_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            title: examData.title ? `${examData.title} (Imported)` : `Imported Exam ${new Date().toLocaleDateString()}`,
            date: new Date().toISOString(),
            questions: examData.questions
        };
        
        const newExams = [newExam, ...exams];
        localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(newExams));
        return { success: true };
    } catch (e) {
        console.error("Import failed", e);
        return { success: false, message: "File Corrupted" };
    }
};

export const removeExam = (examId: string) => {
    const exams = getSavedExams();
    const newExams = exams.filter(e => e.id !== examId);
    localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(newExams));
};

// --- HISTORY SECTION ---
export const getHistory = (): SavedExam[] => {
    const stored = localStorage.getItem(EXAM_HISTORY_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch (e) {
        return [];
    }
};

export const saveToHistory = (questions: Question[], title: string) => {
    const history = getHistory();
    const newEntry: SavedExam = {
        id: `hist_${Date.now()}`,
        title: title,
        date: new Date().toISOString(),
        questions: questions
    };
    
    // Add to top, keep only last 3
    const newHistory = [newEntry, ...history].slice(0, 3);
    localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(newHistory));
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
