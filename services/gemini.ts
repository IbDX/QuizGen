
// Fix: Added missing exported functions and types required by components.
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, QuestionFormatPreference, OutputLanguage, UILanguage, ExamMode } from "../types";
import { monitor } from "./monitor";

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to detect 429/Quota errors
const isRateLimitError = (error: any): boolean => {
    if (!error) return false;
    const msg = (error.message || error.toString()).toLowerCase();
    if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) return true;
    if (error.status === 429 || error.code === 429) return true;
    if (error.error?.code === 429 || error.error?.status === 'RESOURCE_EXHAUSTED') return true;
    return false;
};

// Helper to generate schema based on preference
const getQuestionSchema = (preference?: QuestionFormatPreference) => {
  let allowedDescription = "One of: 'MCQ', 'TRACING', 'CODING'";
  if (preference === QuestionFormatPreference.MCQ) allowedDescription = "MUST be 'MCQ'.";
  else if (preference === QuestionFormatPreference.TRACING) allowedDescription = "MUST be 'TRACING'.";
  else if (preference === QuestionFormatPreference.CODING) allowedDescription = "MUST be 'CODING'.";
  else if (preference === QuestionFormatPreference.SHORT_ANSWER) allowedDescription = "MUST be 'MCQ' with empty options [].";

  return {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      type: { type: Type.STRING, description: allowedDescription },
      topic: { type: Type.STRING },
      text: { type: Type.STRING },
      codeSnippet: { type: Type.STRING, nullable: true },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
      correctOptionIndex: { type: Type.INTEGER, nullable: true },
      tracingOutput: { type: Type.STRING, nullable: true },
      expectedOutput: { type: Type.STRING, nullable: true },
      explanation: { type: Type.STRING },
      graphConfig: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          title: { type: Type.STRING },
          xAxisLabel: { type: Type.STRING },
          yAxisLabel: { type: Type.STRING },
          functions: { type: Type.ARRAY, items: { type: Type.STRING } },
          domain: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          range: { type: Type.ARRAY, items: { type: Type.NUMBER } }
        }
      },
      diagramConfig: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          type: { type: Type.STRING },
          code: { type: Type.STRING }
        }
      },
      visualBounds: { type: Type.ARRAY, items: { type: Type.INTEGER }, nullable: true },
      sourceFileIndex: { type: Type.INTEGER, nullable: true },
      pageNumber: { type: Type.INTEGER, nullable: true }
    },
    required: ["id", "type", "topic", "text", "explanation"]
  };
};

const gradingSchema = {
  type: Type.OBJECT,
  properties: {
    isCorrect: { type: Type.BOOLEAN },
    feedback: { type: Type.STRING }
  },
  required: ["isCorrect", "feedback"]
};

/**
 * Client-side helper to crop images or PDF pages based on AI bounds
 */
const cropImage = async (
  base64: string, 
  mimeType: string, 
  bounds: number[], 
  pageNumber: number = 1
): Promise<string | undefined> => {
  const [ymin, xmin, ymax, xmax] = bounds;
  const norm = (val: number) => Math.max(0, Math.min(1, val / 1000));
  const nYmin = norm(ymin);
  const nXmin = norm(xmin);
  const nYmax = norm(ymax);
  const nXmax = norm(xmax);
  
  if (mimeType === 'application/pdf') {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) return undefined;
      try {
        const loadingTask = pdfjsLib.getDocument({ data: atob(base64) });
        const pdf = await loadingTask.promise;
        const pIndex = Math.max(1, Math.min(pageNumber, pdf.numPages));
        const page = await pdf.getPage(pIndex);
        const viewport = page.getViewport({ scale: 4.0 }); 
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const cropW = (nXmax - nXmin) * canvas.width;
        const cropH = (nYmax - nYmin) * canvas.height;
        const cropX = nXmin * canvas.width;
        const cropY = nYmin * canvas.height;
        if (cropW <= 0 || cropH <= 0) return undefined;
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = cropW;
        finalCanvas.height = cropH;
        const finalCtx = finalCanvas.toDataURL('image/png');
        return finalCtx.split(',')[1];
      } catch (e) { return undefined; }
  } else {
      return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const w = img.width;
              const h = img.height;
              const cropW = (nXmax - nXmin) * w;
              const cropH = (nYmax - nYmin) * h;
              const cropX = nXmin * w;
              const cropY = nYmin * h;
              if (cropW <= 0 || cropH <= 0) { resolve(undefined); return; }
              canvas.width = cropW;
              canvas.height = cropH;
              const ctx = canvas.getContext('2d');
              if (!ctx) { resolve(undefined); return; }
              ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              resolve(canvas.toDataURL('image/png').split(',')[1]);
          };
          img.onerror = () => resolve(undefined);
          img.src = `data:${mimeType};base64,${base64}`;
      });
  }
};

const processVisuals = async (questions: any[], files: {base64: string, mimeType: string}[]) => {
    if (!Array.isArray(questions)) return [];
    const processed = [];
    for (const q of questions) {
        if (q && q.visualBounds && Array.isArray(q.visualBounds) && q.visualBounds.length === 4 && q.sourceFileIndex !== undefined) {
             const file = files[q.sourceFileIndex];
             if (file) {
                 const visualBase64 = await cropImage(file.base64, file.mimeType, q.visualBounds, q.pageNumber || 1);
                 if (visualBase64) q.visual = visualBase64;
             }
        }
        if (q && typeof q === 'object') {
            const { visualBounds, sourceFileIndex, pageNumber, ...cleanQ } = q;
            processed.push(cleanQ);
        }
    }
    return processed;
};

const deduplicateQuestions = (questions: Question[]): Question[] => {
  if (!Array.isArray(questions)) return [];
  const uniqueQuestions: Question[] = [];
  const seenSignatures = new Set<string>();
  for (const q of questions) {
    if (!q || !q.text) continue;
    const sig = `${q.type}::${q.text.toLowerCase().replace(/\s+/g, ' ')}`;
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      uniqueQuestions.push({ ...q, id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` });
    }
  }
  return uniqueQuestions;
};

const getSystemInstruction = (preference: QuestionFormatPreference, outputLang: OutputLanguage): string => {
    let langInstruction = outputLang === 'ar' ? "LANGUAGE: ARABIC questions, English code." : "LANGUAGE: ENGLISH.";
    return `${langInstruction} Role: Exam Builder. Extract all questions from provided documents. Use LaTeX for units $12\\,V$. Remove answers from text. Use graphConfig/diagramConfig for visuals.`;
};

// Main generation function
export const generateExam = async (
    files: { base64: string, mimeType: string }[], 
    preference: QuestionFormatPreference = QuestionFormatPreference.MIXED,
    outputLanguage: OutputLanguage = 'en',
    instructions?: string
): Promise<Question[]> => {
  const startTime = performance.now();
  monitor.log('API_LATENCY', 'generateExam - Start', 0, { fileCount: files.length });

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = files.map(file => ({
      inlineData: { mimeType: file.mimeType, data: file.base64.replace(/\s/g, '') }
  }));
  parts.push({ text: `Extract questions. ${instructions || ''}` });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: getSystemInstruction(preference, outputLanguage),
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: getQuestionSchema(preference) },
        temperature: 0.2 
      }
    });
    const questions = JSON.parse(response.text || '[]');
    const visualEnriched = await processVisuals(questions, files);
    
    const duration = performance.now() - startTime;
    monitor.log('API_LATENCY', 'generateExam - Success', duration, { questionCount: questions.length });
    
    return deduplicateQuestions(visualEnriched);
  } catch (error) {
    const duration = performance.now() - startTime;
    monitor.log('API_LATENCY', 'generateExam - Failure', duration, { error: (error as any).message });
    if (isRateLimitError(error)) throw new Error("429_RATE_LIMIT");
    throw error;
  }
};

// Grading functions
export const gradeCodingAnswer = async (q: Question, answer: string, lang: string) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Question: ${q.text}\nCorrect Solution: ${q.explanation}\nUser Answer: ${answer}`,
            config: {
                systemInstruction: `Grade the user code. Language: ${lang}. Return JSON with isCorrect and feedback.`,
                responseMimeType: "application/json",
                responseSchema: gradingSchema
            }
        });
        const duration = performance.now() - startTime;
        monitor.log('API_LATENCY', 'gradeCoding', duration);
        return JSON.parse(response.text || '{"isCorrect":false,"feedback":"Error"}');
    } catch (e) {
        monitor.log('API_LATENCY', 'gradeCoding - Fail', performance.now() - startTime);
        throw e;
    }
};

export const gradeShortAnswer = async (q: Question, answer: string, lang: string) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Question: ${q.text}\nExplanation: ${q.explanation}\nUser Answer: ${answer}`,
            config: {
                systemInstruction: `Grade the answer. Language: ${lang}. Return JSON with isCorrect and feedback.`,
                responseMimeType: "application/json",
                responseSchema: gradingSchema
            }
        });
        const duration = performance.now() - startTime;
        monitor.log('API_LATENCY', 'gradeShortAnswer', duration);
        return JSON.parse(response.text || '{"isCorrect":false,"feedback":"Error"}');
    } catch (e) {
        monitor.log('API_LATENCY', 'gradeShortAnswer - Fail', performance.now() - startTime);
        throw e;
    }
};

// Remediation
export const generateExamFromWrongAnswers = async (questions: Question[], wrongIds: string[]) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const targets = questions.filter(q => wrongIds.includes(q.id));
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Generate 5 new remediation questions based on these failed topics: ${JSON.stringify(targets)}`,
            config: {
                systemInstruction: "Generate new similar questions for remediation.",
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: getQuestionSchema() }
            }
        });
        const duration = performance.now() - startTime;
        monitor.log('API_LATENCY', 'remediation', duration);
        return JSON.parse(response.text || '[]');
    } catch (e) {
        monitor.log('API_LATENCY', 'remediation - Fail', performance.now() - startTime);
        throw e;
    }
};

// Tips
export const generateLoadingTips = async (files: {base64: string, mimeType: string}[], lang: UILanguage) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Generate 5 short technical tips based on these files.",
            config: {
                systemInstruction: `Language: ${lang}. Return a JSON array of strings.`,
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        monitor.log('API_LATENCY', 'tips', performance.now() - startTime);
        return JSON.parse(response.text || '[]');
    } catch (e) { return []; }
};

// AI Helper
export const getAiHelperResponse = async (input: string, lang: UILanguage) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: input,
            config: { systemInstruction: `You are Z+ System Support. Language: ${lang}.` }
        });
        monitor.log('API_LATENCY', 'helper', performance.now() - startTime);
        return response.text || "";
    } catch (e) { return "Error contacting support."; }
};

// Builder Message
export const sendExamBuilderMessage = async (messages: ChatMessage[], input: string) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: input }] }],
            config: { 
                systemInstruction: "You are an Exam Builder Agent. Discuss requirements. Append ||SUGGESTIONS|| [\"opt1\", \"opt2\"] to your message for quick replies." 
            }
        });
        monitor.log('API_LATENCY', 'builderChat', performance.now() - startTime);
        return response.text || "";
    } catch (e) {
        monitor.log('API_LATENCY', 'builderChat - Fail', performance.now() - startTime);
        throw e;
    }
};

// Final Build from Chat
export const generateExamFromBuilderChat = async (messages: ChatMessage[]) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
            config: {
                systemInstruction: "Generate the final exam JSON based on the conversation.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        settings: {
                            type: Type.OBJECT,
                            properties: {
                                timeLimitMinutes: { type: Type.INTEGER },
                                mode: { type: Type.STRING }
                            }
                        },
                        questions: { type: Type.ARRAY, items: getQuestionSchema() }
                    },
                    required: ["title", "questions"]
                }
            }
        });
        const duration = performance.now() - startTime;
        monitor.log('API_LATENCY', 'builderCompile', duration);
        const data = JSON.parse(response.text || '{"title":"Error","questions":[]}');
        return {
            questions: data.questions,
            settings: data.settings || { timeLimitMinutes: 0, mode: ExamMode.ONE_WAY },
            title: data.title
        };
    } catch (e) {
        monitor.log('API_LATENCY', 'builderCompile - Fail', performance.now() - startTime);
        throw e;
    }
};
