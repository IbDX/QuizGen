
import { GoogleGenAI, Type } from "@google/genai";
import { Question, ExamSettings, QuestionFormatPreference, OutputLanguage, UILanguage, ExamMode } from "../types";

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
1. EXTRACTION: Identify every single question. For the Diagnostic Demo, generate 30 diverse technical questions.
2. RENDERING: ${TECHNICAL_RENDERING_PROTOCOL}
3. FORMAT: ${preference}. If MCQ, provide 4 options. If Tracing, provide 'tracingOutput'. 
4. DE-DUPLICATION: Never include the code from 'codeSnippet' inside the 'text' property.
${langContext}`;
};

export const generateExam = async (
    files: Array<{ base64: string; mimeType: string }>,
    preference: QuestionFormatPreference,
    outputLanguage: OutputLanguage,
    instructions?: string
): Promise<Question[]> => {
    const parts: any[] = files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType } }));
    parts.push({ text: `Generate a high-fidelity technical exam. Leverage the platform capabilities (Graphs, Diagrams). Constraints: ${instructions || "None"}` });

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: {
            systemInstruction: getSystemInstruction(preference, outputLanguage),
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: getQuestionSchema() }
        }
    });
    try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};

export const sendExamBuilderMessage = async (history: ChatMessage[], message: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: message }] }] as any,
        config: {
            systemInstruction: `You are the Z+ Exam Architect. 
            Negotiate technical exams. You are aware of our platform's ability to render Dynamic Graphs, Logic Circuits, and Interactive Code.
            Propose interesting visual questions. 
            Append ||SUGGESTIONS|| ["Option 1", "Option 2"] for quick replies.`
        }
    });
    return response.text || "";
};

export const generateExamFromBuilderChat = async (history: ChatMessage[]): Promise<{ questions: Question[]; settings: Partial<ExamSettings>; title: string }> => {
    const response = await ai.models.generateContent({
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
    return JSON.parse(response.text || "{}");
};

// --- SINGLE GRADING (Legacy/Fallback) ---
export const gradeCodingAnswer = async (q: Question, answer: string, lang: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Q: ${q.text}\nSolution: ${q.explanation}\nUser Submission: ${answer}`,
        config: {
            systemInstruction: `Grade this code in ${lang}. Provide technical feedback. Return JSON {isCorrect: bool, feedback: string}`,
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{"isCorrect":false,"feedback":"Grading Error"}');
};

export const gradeShortAnswer = async (q: Question, answer: string, lang: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Q: ${q.text}\nContext: ${q.explanation}\nUser Input: ${answer}`,
        config: {
            systemInstruction: `Grade this text response in ${lang}. Return JSON {isCorrect: bool, feedback: string}`,
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{"isCorrect":false,"feedback":"Grading Error"}');
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
        const response = await ai.models.generateContent({
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

        return JSON.parse(response.text || "[]");
    } catch (e: any) {
        console.error("Batch Grading Failed", e);
        // If batch fails (rate limit), return empty to trigger retry or fallback
        if (e.message && e.message.includes('429')) throw new Error("429_RATE_LIMIT");
        return [];
    }
};

export const generateLoadingTips = async (files: any[], lang: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Generate 5 technical study tips related to these documents.",
        config: {
            systemInstruction: `Return JSON string array in ${lang}. Use Markdown.`,
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || "[]");
};

export const getAiHelperResponse = async (msg: string, lang: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: msg,
        config: { systemInstruction: `Z+ Support Agent. Help with platform features: Graphs, Diagrams, Modes. Lang: ${lang}.` }
    });
    return response.text || "";
};

export const generateExamFromWrongAnswers = async (questions: Question[], wrongIds: string[]) => {
    const wrongOnes = questions.filter(q => wrongIds.includes(q.id));
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Failed Concepts: ${JSON.stringify(wrongOnes)}. Generate 5 new remediation questions.`,
        config: {
            systemInstruction: `Remediation Expert. Use technical visuals. ${TECHNICAL_RENDERING_PROTOCOL}`,
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: getQuestionSchema() }
        }
    });
    return JSON.parse(response.text || "[]");
};
