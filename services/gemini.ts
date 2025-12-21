
// Fix: Added missing exported functions and types required by components.
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Question, QuestionType, QuestionFormatPreference, OutputLanguage, UILanguage, ExamMode } from "../types";
import { monitor } from "./monitor";

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// --- ERROR HANDLING & UTILS ---

// Safe delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Detect Quota (429) errors
const isRateLimitError = (error: any): boolean => {
    if (!error) return false;
    const msg = (error.message || error.toString()).toLowerCase();
    if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) return true;
    if (error.status === 429 || error.code === 429) return true;
    if (error.error?.code === 429 || error.error?.status === 'RESOURCE_EXHAUSTED') return true;
    return false;
};

// Clean raw LLM output to extract JSON
const cleanJson = (text: string): string => {
    let clean = text.trim();
    // Remove markdown code blocks if present
    if (clean.startsWith('```')) {
        clean = clean.replace(/^```(json)?/, '').replace(/```$/, '');
    }
    return clean.trim();
};

// Retry wrapper with exponential backoff for 5xx errors (not 429)
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> {
    let currentDelay = initialDelay;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            // STOP immediately on Quota errors or Auth errors
            if (isRateLimitError(error) || error.status === 401 || error.status === 400) {
                throw error;
            }
            
            // Retry only on likely transient errors (500, 503, Network Errors)
            const isTransient = error.status >= 500 || error.message?.includes('fetch') || error.message?.includes('network');
            
            if (i === retries - 1 || !isTransient) throw error;
            
            console.warn(`API Attempt ${i + 1} failed. Retrying in ${currentDelay}ms...`, error);
            await delay(currentDelay);
            currentDelay *= 2; // Exponential backoff
        }
    }
    throw new Error("Max retries exceeded");
}

// --- SCHEMAS ---

const getQuestionSchema = (preference?: QuestionFormatPreference) => {
  let allowedTypes = ["MCQ", "TRACING", "CODING", "SHORT_ANSWER"];
  
  if (preference === QuestionFormatPreference.MCQ) allowedTypes = ["MCQ"];
  else if (preference === QuestionFormatPreference.TRACING) allowedTypes = ["TRACING"];
  else if (preference === QuestionFormatPreference.CODING) allowedTypes = ["CODING"];
  else if (preference === QuestionFormatPreference.SHORT_ANSWER) allowedTypes = ["MCQ"]; 

  return {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      type: { type: Type.STRING, enum: allowedTypes },
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

// --- CLIENT PROCESSING HELPERS ---

const cropImage = async (
  base64: string, 
  mimeType: string, 
  bounds: number[], 
  pageNumber: number = 1
): Promise<string | undefined> => {
  const [ymin, xmin, ymax, xmax] = bounds;
  // Safety check for bounds
  if (typeof ymin !== 'number' || typeof xmin !== 'number' || typeof ymax !== 'number' || typeof xmax !== 'number') return undefined;

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

// Validate structure and filter out broken questions
const validateAndFilterQuestions = (rawQuestions: any[]): Question[] => {
    if (!Array.isArray(rawQuestions)) return [];
    
    return rawQuestions.filter(q => {
        return (
            q && 
            typeof q.id === 'string' &&
            typeof q.text === 'string' && 
            q.text.length > 5 && // Minimal length check
            typeof q.type === 'string' &&
            typeof q.explanation === 'string'
        );
    });
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
    const lang = outputLang === 'ar' ? "ARABIC questions, English code" : "ENGLISH";
    return `Role: Exam Builder. Lang: ${lang}. Extract questions. Units: LaTeX $V$. No answers in text. Detect visuals/graphs.`;
};

// --- CORE GENERATION FUNCTIONS ---

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

  // WRAPPER: callWithRetry logic
  const apiCall = () => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: getSystemInstruction(preference, outputLanguage),
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: getQuestionSchema(preference) },
        temperature: 0.2 
      }
  });

  try {
    const response = await callWithRetry<GenerateContentResponse>(apiCall);
    
    // GUARD: Parsing with Clean Logic
    let rawData;
    try {
        const cleanedText = cleanJson(response.text || '');
        rawData = JSON.parse(cleanedText || '[]');
    } catch (parseError) {
        console.error("JSON Parse Error", parseError);
        // Fallback: If strict JSON fails, try to repair or just return empty
        throw new Error("MALFORMED_RESPONSE");
    }

    // GUARD: Validate structure (Partial Data Recovery)
    const validQuestions = validateAndFilterQuestions(rawData);
    
    if (validQuestions.length === 0 && rawData.length > 0) {
        throw new Error("DATA_INTEGRITY_FAIL: Questions generated but format invalid.");
    }

    const visualEnriched = await processVisuals(validQuestions, files);
    const finalQuestions = deduplicateQuestions(visualEnriched);
    
    const duration = performance.now() - startTime;
    monitor.log('API_LATENCY', 'generateExam - Success', duration, { questionCount: finalQuestions.length });
    
    return finalQuestions;

  } catch (error: any) {
    const duration = performance.now() - startTime;
    monitor.log('API_LATENCY', 'generateExam - Failure', duration, { error: error.message });
    
    // Bubble up specifically known errors
    if (isRateLimitError(error)) throw new Error("429_RATE_LIMIT");
    if (error.message === "MALFORMED_RESPONSE") throw new Error("MALFORMED_RESPONSE");
    
    throw error;
  }
};

// Grading functions
export const gradeCodingAnswer = async (q: Question, answer: string, lang: string) => {
    const startTime = performance.now();
    monitor.log('API_LATENCY', 'gradeCoding - Start', 0);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const apiCall = () => ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Q: ${q.text}\nSol: ${q.explanation}\nUser: ${answer}`,
        config: {
            systemInstruction: `Grade code. Lang: ${lang}. JSON {isCorrect, feedback}.`,
            responseMimeType: "application/json",
            responseSchema: gradingSchema
        }
    });

    try {
        const response = await callWithRetry<GenerateContentResponse>(apiCall);
        const result = JSON.parse(cleanJson(response.text || '{"isCorrect":false,"feedback":"Error"}'));
        monitor.log('API_LATENCY', 'gradeCoding - Success', performance.now() - startTime);
        return result;
    } catch (e) {
        monitor.log('API_LATENCY', 'gradeCoding - Fail', performance.now() - startTime);
        throw e;
    }
};

export const gradeShortAnswer = async (q: Question, answer: string, lang: string) => {
    const startTime = performance.now();
    monitor.log('API_LATENCY', 'gradeShortAnswer - Start', 0);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const apiCall = () => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Q: ${q.text}\nExp: ${q.explanation}\nUser: ${answer}`,
        config: {
            systemInstruction: `Grade answer. Lang: ${lang}. JSON {isCorrect, feedback}.`,
            responseMimeType: "application/json",
            responseSchema: gradingSchema
        }
    });

    try {
        const response = await callWithRetry<GenerateContentResponse>(apiCall);
        const result = JSON.parse(cleanJson(response.text || '{"isCorrect":false,"feedback":"Error"}'));
        monitor.log('API_LATENCY', 'gradeShortAnswer - Success', performance.now() - startTime);
        return result;
    } catch (e) {
        monitor.log('API_LATENCY', 'gradeShortAnswer - Fail', performance.now() - startTime);
        throw e;
    }
};

// Remediation
export const generateExamFromWrongAnswers = async (questions: Question[], wrongIds: string[]) => {
    const startTime = performance.now();
    monitor.log('API_LATENCY', 'remediation - Start', 0);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const targets = questions.filter(q => wrongIds.includes(q.id));
    
    const apiCall = () => ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate 5 remediation questions from: ${JSON.stringify(targets)}`,
        config: {
            systemInstruction: "Create similar questions.",
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: getQuestionSchema() }
        }
    });

    try {
        const response = await callWithRetry<GenerateContentResponse>(apiCall);
        const result = JSON.parse(cleanJson(response.text || '[]'));
        monitor.log('API_LATENCY', 'remediation - Success', performance.now() - startTime);
        return result;
    } catch (e) {
        monitor.log('API_LATENCY', 'remediation - Fail', performance.now() - startTime);
        throw e;
    }
};

// Tips - Short request, low retry priority
export const generateLoadingTips = async (files: {base64: string, mimeType: string}[], lang: UILanguage) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = (await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Generate 5 short technical tips from files.",
            config: {
                systemInstruction: `Lang: ${lang}. Return JSON array of strings.`,
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        })) as GenerateContentResponse;
        monitor.log('API_LATENCY', 'tips - Success', performance.now() - startTime);
        return JSON.parse(cleanJson(response.text || '[]'));
    } catch (e) { return []; }
};

// AI Helper
export const getAiHelperResponse = async (input: string, lang: UILanguage) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = (await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: input,
            config: { systemInstruction: `System Support. Lang: ${lang}. Short helpful answers.` }
        })) as GenerateContentResponse;
        monitor.log('API_LATENCY', 'helper - Success', performance.now() - startTime);
        return response.text || "";
    } catch (e) { return "Error contacting support."; }
};

// Builder Message
export const sendExamBuilderMessage = async (messages: ChatMessage[], input: string) => {
    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Chat is sensitive to latency, 1 retry max
    const apiCall = () => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: input }] }],
        config: { 
            systemInstruction: "Exam Builder Agent. Append ||SUGGESTIONS|| [\"opt1\"] to reply." 
        }
    });

    try {
        const response = await callWithRetry<GenerateContentResponse>(apiCall, 1);
        monitor.log('API_LATENCY', 'builderChat - Success', performance.now() - startTime);
        return response.text || "";
    } catch (e) {
        monitor.log('API_LATENCY', 'builderChat - Fail', performance.now() - startTime);
        throw e;
    }
};

// Final Build from Chat
export const generateExamFromBuilderChat = async (messages: ChatMessage[]) => {
    const startTime = performance.now();
    monitor.log('API_LATENCY', 'builderCompile - Start', 0);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const apiCall = () => ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        config: {
            systemInstruction: "Generate final exam JSON.",
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

    try {
        const response = await callWithRetry<GenerateContentResponse>(apiCall);
        const duration = performance.now() - startTime;
        monitor.log('API_LATENCY', 'builderCompile - Success', duration);
        const data = JSON.parse(cleanJson(response.text || '{"title":"Error","questions":[]}'));
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
