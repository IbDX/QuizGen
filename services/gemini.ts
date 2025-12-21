
import { GoogleGenAI, Type } from "@google/genai";
import { Question, ExamSettings, QuestionFormatPreference, OutputLanguage, AppError, ErrorCode } from "../types";
import { withRetry, cleanAndParseJSON, validateAndFilter } from "../utils/errorUtils";

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export interface GradingResult {
    id: string;
    isCorrect: boolean;
    feedback: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * PLATFORM CAPABILITY MAP:
 * This tells the AI exactly what the UI can render so it creates 
 * questions that leverage our dynamic components.
 */
const TECHNICAL_RENDERING_PROTOCOL = `
**Z+ PLATFORM RENDERING CAPABILITIES (V2.8):**
Your goal is to use the most interactive modality for every concept:

1. DYNAMIC MATH GRAPHS (Use 'graphConfig'):
   - Use for: Calculus, Physics trajectories, Signal processing.
   - Format: functions: ["sin(x)", "x^2 + 2x"]. Range/Domain: [-10, 10].
   - Benefit: Renders an interactive D3 coordinate system.

2. LOGIC & HARDWARE SCHEMATICS (Use 'diagramConfig'):
   - Use for: Logic Gates, Circuits, UML, System Design.
   - Syntax: Mermaid v10.
   - Standard IDs: Use G1, G2, R1, C1 (No spaces).
   - Standard Labels: ALWAYS wrap in double quotes: G1["AND Gate"].
   - Circuit Components: Use Battery, Resistor, Capacitor, GND, ALU, MUX in labels to trigger custom hardware styling.

3. MATHEMATICAL NOTATION:
   - Use for: All formulas, variables, and equations.
   - Format: Strict LaTeX wrapped in $ ... $ for inline or $$ ... $$ for blocks.
   - Arabic Context: Even in Arabic mode, keep LaTeX symbols in LTR.

4. INTERACTIVE CODE:
   - Use for: Programming challenges and Trace logic.
   - Rule: If you provide 'codeSnippet', DO NOT repeat the code inside 'text'.
`;

const getQuestionSchema = () => ({
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING },
        type: { type: Type.STRING },
        topic: { type: Type.STRING },
        text: { type: Type.STRING },
        codeSnippet: { type: Type.STRING, nullable: true },
        options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
        correctOptionIndex: { type: Type.NUMBER, nullable: true },
        tracingOutput: { type: Type.STRING, nullable: true },
        expectedOutput: { type: Type.STRING, nullable: true },
        explanation: { type: Type.STRING },
        graphConfig: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
                title: { type: Type.STRING },
                functions: { type: Type.ARRAY, items: { type: Type.STRING } },
                domain: { type: Type.ARRAY, items: { type: Type.NUMBER }, nullable: true },
                range: { type: Type.ARRAY, items: { type: Type.NUMBER }, nullable: true }
            }
        },
        diagramConfig: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
                type: { type: Type.STRING },
                code: { type: Type.STRING }
            }
        }
    },
    required: ["id", "topic", "type", "text", "explanation"]
});

const getSystemInstruction = (preference: QuestionFormatPreference, outputLang: OutputLanguage): string => {
    let langContext = "Output: English.";
    if (outputLang === 'ar') langContext = "Output: Arabic (Keep technical terms, LaTeX, and Diagram IDs in English/LTR).";
    else if (outputLang === 'auto') langContext = "Match source document language.";

    return `
You are the Z+ Core Intelligence. 
1. EXTRACTION: Analyze the provided images/PDFs. Extract questions directly from the content. If the content is study material (not an exam), generate high-quality questions based on the key concepts found in the text.
2. RENDERING: ${TECHNICAL_RENDERING_PROTOCOL}
3. FORMAT: ${preference}. If MCQ, provide 4 options. If Tracing, provide 'tracingOutput'. 
4. DE-DUPLICATION: Never include the code from 'codeSnippet' inside the 'text' property.
${langContext}`;
};

// Generic Safe API Caller
const safeGenerate = async (
    apiCall: () => Promise<any>, 
    timeoutMs: number = 30000
) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const result = await withRetry(async () => {
            try {
                // If the SDK supports signal, pass it. If not, this is a placeholder.
                // Current GenAI SDK might not fully support signal in all methods, so we use race implicitly via withRetry timeout if needed,
                // but the wrapper here mainly handles mapping SDK errors to AppErrors.
                return await apiCall();
            } catch(e: any) {
                if (e.message?.includes('429') || e.status === 429) {
                    throw new AppError("Quota Exceeded", ErrorCode.RATE_LIMIT, e, false);
                }
                if (e.name === 'AbortError' || e.message?.includes('timeout')) {
                    throw new AppError("Network Timeout", ErrorCode.NETWORK_TIMEOUT, e, true);
                }
                throw e;
            }
        });
        return result;
    } catch(e: any) {
        if (e instanceof AppError) throw e;
        throw new AppError(e.message || "Unknown API Error", ErrorCode.UNKNOWN, e);
    } finally {
        clearTimeout(id);
    }
};

export const generateExam = async (
    files: Array<{ base64: string; mimeType: string }>,
    preference: QuestionFormatPreference,
    outputLanguage: OutputLanguage,
    instructions?: string
): Promise<Question[]> => {
    const parts: any[] = files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType } }));
    parts.push({ text: `Generate a high-fidelity technical exam based on these files. Leverage the platform capabilities (Graphs, Diagrams). Constraints: ${instructions || "None"}` });

    const response = await safeGenerate(async () => {
        return await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts },
            config: {
                systemInstruction: getSystemInstruction(preference, outputLanguage),
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: getQuestionSchema() }
            }
        });
    }, 45000); // 45s timeout for heavy generation

    const rawData = cleanAndParseJSON(response.text || "[]");
    
    // Validate Structure
    const { valid, corruptedCount } = validateAndFilter<Question>(rawData, (q: any) => {
        return typeof q.id === 'string' && typeof q.text === 'string' && typeof q.type === 'string';
    });

    if (valid.length === 0) {
        throw new AppError("No valid questions generated", ErrorCode.MALFORMED_RESPONSE);
    }

    if (corruptedCount > 0) {
        console.warn(`Dropped ${corruptedCount} corrupted questions during generation.`);
        // Ideally we could return a warning here, but for now we just return valid ones.
    }

    return valid;
};

export const sendExamBuilderMessage = async (history: ChatMessage[], message: string): Promise<string> => {
    const response = await safeGenerate(async () => {
        return await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: message }] }] as any,
            config: {
                systemInstruction: `You are the Z+ Exam Architect. 
                Negotiate technical exams. You are aware of our platform's ability to render Dynamic Graphs, Logic Circuits, and Interactive Code.
                Propose interesting visual questions. 
                Append ||SUGGESTIONS|| ["Option 1", "Option 2"] for quick replies.`
            }
        });
    }, 15000);
    return response.text || "";
};

export const generateExamFromBuilderChat = async (history: ChatMessage[]): Promise<{ questions: Question[]; settings: Partial<ExamSettings>; title: string }> => {
    const response = await safeGenerate(async () => {
        return await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: history.map(m => ({ role: m.role, parts: [{ text: m.text }] })) as any,
            config: {
                systemInstruction: `Final Compilation. Compile all discussed technical content into structured JSON.
                ${TECHNICAL_RENDERING_PROTOCOL}
                MANDATORY: Ensure code snippets are not repeated in question text.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        settings: {
                            type: Type.OBJECT,
                            properties: {
                                timeLimitMinutes: { type: Type.NUMBER },
                                mode: { type: Type.STRING }
                            }
                        },
                        questions: { type: Type.ARRAY, items: getQuestionSchema() }
                    },
                    required: ["title", "questions"]
                }
            }
        });
    }, 40000);
    
    return cleanAndParseJSON(response.text || "{}");
};

// --- SINGLE GRADING (Legacy/Fallback) ---
export const gradeCodingAnswer = async (q: Question, answer: string, lang: string) => {
    const response = await safeGenerate(async () => {
        return await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Q: ${q.text}\nSolution: ${q.explanation}\nUser Submission: ${answer}`,
            config: {
                systemInstruction: `Grade this code in ${lang}. Provide technical feedback. Return JSON {isCorrect: bool, feedback: string}`,
                responseMimeType: "application/json"
            }
        });
    }, 10000);
    return cleanAndParseJSON(response.text || '{"isCorrect":false,"feedback":"Grading Error"}');
};

export const gradeShortAnswer = async (q: Question, answer: string, lang: string) => {
    const response = await safeGenerate(async () => {
        return await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Q: ${q.text}\nContext: ${q.explanation}\nUser Input: ${answer}`,
            config: {
                systemInstruction: `Grade this text response in ${lang}. Return JSON {isCorrect: bool, feedback: string}`,
                responseMimeType: "application/json"
            }
        });
    }, 10000);
    return cleanAndParseJSON(response.text || '{"isCorrect":false,"feedback":"Grading Error"}');
};

// --- BATCH GRADING (New High-Performance) ---
export const gradeQuestionBatch = async (
    items: { id: string; question: string; context: string; userAnswer: string }[],
    lang: string
): Promise<GradingResult[]> => {
    if (items.length === 0) return [];

    const prompt = JSON.stringify(items.map(item => ({
        id: item.id,
        q: item.question,
        ctx: item.context,
        ans: item.userAnswer
    })));

    try {
        const response = await safeGenerate(async () => {
            return await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Bulk Grade these submissions. Input: ${prompt}`,
                config: {
                    systemInstruction: `You are a high-speed Batch Grading Engine.
                    Analyze the JSON input array. For each item, compare 'ans' (User Answer) against 'q' (Question) and 'ctx' (Ideal Solution/Context).
                    
                    Language: ${lang === 'ar' ? 'Arabic' : 'English'}.
                    
                    Output: A JSON Array of objects.
                    Each object MUST have:
                    - id: (Matches input ID)
                    - isCorrect: boolean
                    - feedback: string (Concise, technical justification. If wrong, explain why.)`,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                isCorrect: { type: Type.BOOLEAN },
                                feedback: { type: Type.STRING }
                            },
                            required: ["id", "isCorrect", "feedback"]
                        }
                    }
                }
            });
        }, 20000); // 20s timeout for batch

        const rawData = cleanAndParseJSON(response.text || "[]");
        return validateAndFilter<GradingResult>(rawData, (item: any) => typeof item.id === 'string' && typeof item.isCorrect === 'boolean').valid;

    } catch (e: any) {
        console.error("Batch Grading Failed", e);
        // If it was a rate limit or timeout, propagate it so the UI knows.
        if (e instanceof AppError) throw e;
        return [];
    }
};

export const generateLoadingTips = async (files: any[], lang: string) => {
    try {
        const response = await safeGenerate(async () => {
            return await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: "Generate 5 technical study tips related to these documents.",
                config: {
                    systemInstruction: `Return JSON string array in ${lang}. Use Markdown.`,
                    responseMimeType: "application/json"
                }
            });
        }, 10000);
        return cleanAndParseJSON(response.text || "[]");
    } catch(e) {
        // Silently fail for tips
        return [];
    }
};

export const getAiHelperResponse = async (msg: string, lang: string) => {
    try {
        const response = await safeGenerate(async () => {
            return await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: msg,
                config: { systemInstruction: `Z+ Support Agent. Help with platform features: Graphs, Diagrams, Modes. Lang: ${lang}.` }
            });
        }, 10000);
        return response.text || "";
    } catch(e) {
        return "System communication fault. Please try again.";
    }
};

/**
 * ADVANCED REMEDIATION ENGINE
 * Generates 'Sister Questions' based on failed concepts.
 */
export const generateExamFromWrongAnswers = async (questions: Question[], wrongIds: string[]) => {
    const wrongOnes = questions.filter(q => wrongIds.includes(q.id));
    
    // We only send the necessary data to the context window to save tokens
    const contextPayload = wrongOnes.map(q => ({
        topic: q.topic,
        type: q.type,
        concept: q.explanation, // The explanation usually contains the core concept
        original_text: q.text
    }));

    const response = await safeGenerate(async () => {
        return await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `FAILED CONCEPTS DATA: ${JSON.stringify(contextPayload)}`,
            config: {
                systemInstruction: `
You are a Psychometrician and Subject Matter Expert specializing in Concept Remediation.
Your task is to generate "Sister Questions" for each failed item provided.

*** PROTOCOL: SISTER QUESTION GENERATION ***

1. CORE EXTRACTION:
   - Identify the "Atomic Skill" tested in the original question.
   - Ignore surface-level details (e.g., if the original is about "Apples", the concept is "Counting").

2. TRANSFORMATION RULES (Apply at least one per question):
   - DOMAIN SHIFT: Change the context completely (e.g., Biology -> Engineering) while keeping the math/logic identical.
   - INVERSE LOGIC: If original asked for Output given Input, ask for Input given Output.
   - ERROR ANALYSIS: Instead of asking the user to write code, provide broken code and ask them to find the bug.
   - VALUE ROTATION: Change all numbers and variable names.

3. ANTI-CLONING GUARDRAILS:
   - DO NOT just swap nouns (e.g., changing "Car" to "Truck" is FORBIDDEN).
   - DO NOT repeat the exact same code snippet with only variable names changed.
   - The new question must feel fresh but test the exact same underlying neural pathway.

4. PLATFORM COMPATIBILITY:
   ${TECHNICAL_RENDERING_PROTOCOL}

GENERATE 1 NEW SISTER QUESTION FOR EACH FAILED CONCEPT.
`,
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: getQuestionSchema() }
            }
        });
    }, 45000);
    
    const rawData = cleanAndParseJSON(response.text || "[]");
    const { valid } = validateAndFilter<Question>(rawData, (q: any) => typeof q.id === 'string');
    return valid;
};
