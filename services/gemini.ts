import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";

// Schema definition for the exam generation
// Using implicit type inference for schema structure
const examSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      type: { type: Type.STRING, enum: [QuestionType.MCQ, QuestionType.TRACING, QuestionType.CODING] },
      topic: { type: Type.STRING, description: "A short topic tag for this question (e.g., 'Loops', 'Pointers', 'Recursion')" },
      text: { type: Type.STRING },
      codeSnippet: { type: Type.STRING, nullable: true },
      options: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        nullable: true 
      },
      correctOptionIndex: { type: Type.INTEGER, nullable: true },
      tracingOutput: { type: Type.STRING, nullable: true },
      explanation: { type: Type.STRING }
    },
    required: ["id", "type", "topic", "text", "explanation"]
  }
};

const gradingSchema = {
  type: Type.OBJECT,
  properties: {
    isCorrect: { type: Type.BOOLEAN },
    feedback: { type: Type.STRING }
  },
  required: ["isCorrect", "feedback"]
};

export const generateExam = async (base64Data: string, mimeType: string, instructions?: string): Promise<Question[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We select a model capable of multimodal understanding (images/pdf)
    const modelId = 'gemini-2.5-flash'; 

    const prompt = `
      Analyze the attached document content thoroughly.
      Generate a technical exam based on the content.
      
      The exam MUST contain a mix of:
      1. Multiple Choice Questions (MCQ)
      2. Code Tracing Questions (Show code, ask for output)
      3. Coding Challenge Questions (Ask user to write code)

      IMPORTANT FORMATTING RULES:
      - For 'codeSnippet' and 'explanation', ensure code is PROPERLY FORMATTED with newlines and indentation. Do not return single-line minified code.
      - Use markdown (\`\`\`) in 'explanation' for code blocks.
      - Assign a specific 'topic' tag to each question (e.g., 'Memory Management', 'Syntax', 'Logic').
      
      For Coding Challenges:
      - The 'text' should describe the problem clearly.
      - The 'explanation' should contain the correct code solution and why it works.
      
      ${instructions ? `Additional Instructions: ${instructions}` : ''}
      
      Ensure the questions assess understanding, not just recall.
      Return the response strictly as a JSON array adhering to the schema.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: examSchema,
        temperature: 0.4
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Question[];
    }
    throw new Error("No response text generated");
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export const generateExamFromWrongAnswers = async (originalQuestions: Question[], wrongIds: string[]): Promise<Question[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const wrongQuestions = originalQuestions.filter(q => wrongIds.includes(q.id));
        
        const prompt = `
          The user failed the following questions:
          ${JSON.stringify(wrongQuestions)}
          
          Generate a NEW set of questions (different from the above) that test the same concepts but from different angles or slightly simpler to build understanding.
          Maintain the same mix of types (MCQ, Tracing, Coding).
          Ensure all code snippets are properly formatted with newlines.
          Include 'topic' tags.
        `;
    
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [{ text: prompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: examSchema
          }
        });
    
        if (response.text) {
          return JSON.parse(response.text) as Question[];
        }
        throw new Error("No remediation exam generated");
    } catch (error) {
        console.error("Gemini Remediation Error:", error);
        throw error;
    }
}

export const gradeCodingAnswer = async (question: Question, code: string): Promise<{ isCorrect: boolean; feedback: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Question: ${question.text}
      Expected Concept/Solution Explanation: ${question.explanation}
      
      User Submitted Code:
      ${code}
      
      Evaluate the user's code. 
      1. Does it solve the problem?
      2. Is it syntactically valid?
      3. Provide constructive feedback using Markdown (use \`\`\` for code).
      
      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: gradingSchema
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return { isCorrect: false, feedback: "AI grading failed to parse response." };
  } catch (error) {
    return { isCorrect: false, feedback: "Error connecting to AI grading service." };
  }
};