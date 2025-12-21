
import { GoogleGenAI, Type } from "@google/genai";
import { Question, ExamSettings, QuestionFormatPreference, OutputLanguage, UILanguage, ExamMode } from "../types";

// Exporting ChatMessage interface to resolve missing member error in ExamBuilder.tsx
export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DIAGRAM_PROTOCOL = `
**SCHEMATIC & ARCHITECTURE PROTOCOL (STRICT):**
If a question involves hardware, logic, or circuits, you MUST provide a 'diagramConfig' using Mermaid.js syntax.
USE THESE UNIQUE SHAPES:
- Logic Gates (AND, OR, XOR, etc.): {{GateName}} [Hexagon]
- Multiplexers (MUX/DEMUX): [/Label/] or [\\Label\\] [Trapezoid]
- Registers/Memory (PC, RAM, Stack): [(Label)] [Cylinder]
- Decoders/Encoders: [[Label]] [Subroutine shape]
- Power/Battery: ((Label)) [Circle]
- Ground: GND[⏚ Ground]
- Passives (Resistor, Capacitor): [Label] with clear naming (R1, C1).

LAYOUT: Use 'graph LR' for logic/electronics, 'graph TD' for system architecture.
`;

const getSystemInstruction = (preference: QuestionFormatPreference, outputLang: OutputLanguage): string => {
    let langContext = "Output language: English.";
    if (outputLang === 'ar') langContext = "Output language: Arabic (technical terms in English).";
    else if (outputLang === 'auto') langContext = "Match source document language.";

    return `
You are the Z+ Core Intelligence. Your mission is to generate high-fidelity technical assessments.

PHASE 1: EXTRACTION
- Parse documents for logic, math, and code.
- Wrap all Physics/Math units in LaTeX: $12\,V$, $500\,\Omega$, $10\,\mu F$.

PHASE 2: VISUAL REPRESENTATION
${DIAGRAM_PROTOCOL}
- If you find a 2D math function, use 'graphConfig'.

PHASE 3: BATCH GENERATION
- Format Preference: ${preference}.
- Always include ID, topic, type, text, explanation.
- For Tracing/Coding, provide 'expectedOutput'.

${langContext}`;
};

export const generateExam = async (
    files: Array<{ base64: string; mimeType: string }>,
    preference: QuestionFormatPreference,
    outputLanguage: OutputLanguage,
    instructions?: string
): Promise<Question[]> => {
    const systemInstruction = getSystemInstruction(preference, outputLanguage);
    // Explicitly typing parts as any[] to fix inference issue where 'text' property was rejected on push
    const parts: any[] = files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType } }));
    parts.push({ text: `Generate exam. Constraints: ${instructions || "None"}` });

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
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
                                functions: { type: Type.ARRAY, items: { type: Type.STRING } }
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
                }
            }
        }
    });

    try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};

export const sendExamBuilderMessage = async (history: ChatMessage[], message: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: message }] }] as any,
        config: {
            systemInstruction: `You are the Z+ Exam Architect. Discuss technical exam design.
            CAPABILITIES: 
            - Logic Diagrams (MUX, Decoders, Registers, ALU).
            - Electronic Circuits (Batteries, Capacitors, Gates).
            - Coding/Tracing.
            
            ALWAYS offer to include these diagrams if relevant.
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
            systemInstruction: `Final Generation Mode. Compile the discussed requirements into a full JSON object.
            ${DIAGRAM_PROTOCOL}
            Ensure math uses $ delimiters. Return title, settings, and questions array.`,
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
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                type: { type: Type.STRING },
                                topic: { type: Type.STRING },
                                text: { type: Type.STRING },
                                explanation: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                                correctOptionIndex: { type: Type.NUMBER, nullable: true },
                                diagramConfig: {
                                    type: Type.OBJECT,
                                    nullable: true,
                                    properties: {
                                        type: { type: Type.STRING },
                                        code: { type: Type.STRING }
                                    }
                                }
                            },
                            required: ["id", "type", "topic", "text", "explanation"]
                        }
                    }
                },
                required: ["title", "questions"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
};

export const gradeCodingAnswer = async (q: Question, answer: string, lang: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Q: ${q.text}\nSolution: ${q.explanation}\nUser: ${answer}`,
        config: {
            systemInstruction: `Grade user code. Lang: ${lang}. Return JSON {isCorrect: bool, feedback: string}`,
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{"isCorrect":false,"feedback":"Error"}');
};

export const gradeShortAnswer = async (q: Question, answer: string, lang: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Q: ${q.text}\nContext: ${q.explanation}\nUser: ${answer}`,
        config: {
            systemInstruction: `Grade text answer. Lang: ${lang}. Return JSON {isCorrect: bool, feedback: string}`,
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{"isCorrect":false,"feedback":"Error"}');
};

export const generateLoadingTips = async (files: any[], lang: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Generate 5 technical study tips.",
        config: {
            systemInstruction: `Lang: ${lang}. Return JSON string array.`,
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || "[]");
};

export const getAiHelperResponse = async (msg: string, lang: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: msg,
        config: { systemInstruction: `You are Z+ Support. Lang: ${lang}.` }
    });
    return response.text || "";
};

export const generateExamFromWrongAnswers = async (questions: Question[], wrongIds: string[]) => {
    const wrongOnes = questions.filter(q => wrongIds.includes(q.id));
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Failed questions: ${JSON.stringify(wrongOnes)}. Generate 5 new remediation questions.`,
        config: {
            systemInstruction: `Remediation Expert. Use standard JSON schema. ${DIAGRAM_PROTOCOL}`,
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || "[]");
};
