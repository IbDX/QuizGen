
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

const deduplicateQuestions = (questions: Question[]): Question[] => {
  const uniqueQuestions: Question[] = [];
  const seenTexts = new Set<string>();

  for (const q of questions) {
    // Create a normalized signature to check for duplicates.
    // We use the first 100 chars of the text + type to avoid false positives on very short "What is the output?" questions.
    const normalizedText = q.text.replace(/\s+/g, ' ').trim().toLowerCase();
    const signature = `${q.type}|${normalizedText.substring(0, 100)}`;

    if (!seenTexts.has(signature)) {
      seenTexts.add(signature);
      uniqueQuestions.push(q);
    }
  }
  return uniqueQuestions;
};

export const generateExam = async (base64Data: string, mimeType: string, instructions?: string): Promise<Question[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We select a model capable of multimodal understanding (images/pdf)
    const modelId = 'gemini-2.5-flash'; 
    
    // Ensure base64 data is clean (no newlines, no headers)
    const cleanBase64 = base64Data.replace(/\s/g, '');

    const prompt = `
      Analyze the provided document (image/PDF) and extract the exam questions contained within it.
      
      **1. STRICT FIDELITY - REFLECT THE SOURCE**: 
      - **Do Not Balance Types**: If the document contains 100% MCQs, return 100% MCQs. If it contains 5 Coding questions, return 5. Do not invent questions to fill quotas.
      - **NO DUPLICATES**: Process the document sequentially. If a question is repeated (e.g. on a summary slide), IGNORE the duplicate. Return unique questions only.

      **2. MULTIPLE CHOICE (MCQ) - PRECISION REQUIRED**:
      - **EXTRACT ALL OPTIONS**: You MUST extract every single option visible (A, B, C, D). Check for multi-column layouts (e.g., A/C on left, B/D on right).
      - **SYMBOL PRESERVATION**: Pay extreme attention to special characters in C++ or code options.
        - **DO NOT** treat "*" as a Markdown bullet point.
        - If Option A is "*", return "*".
        - If Option B is "**", return "**".
        - If Option C is "***", return "***".
      - **EMPTY OPTIONS**: If an option looks empty, check if it's a whitespace character, a symbol, or "Nothing to Print". Do not return empty strings unless the option is literally blank.

      **3. CLASSIFICATION**:
      - **MCQ**: Has explicit choices (A, B, C, D) or a list of options.
      - **TRACING**: Asks for output/result with NO provided choices.
      - **CODING**: Asks to write/implement code.

      **FORMATTING**:
      - **Code Snippets**: Preserve newlines and indentation.
      - **Explanation**: Provide a step-by-step solution derivation.
      - **Correct Answer**: Solve the problem yourself to determine the 'correctOptionIndex'.

      ${instructions ? `User Instructions: ${instructions}` : ''}
      
      Return the response strictly as a JSON array adhering to the schema.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: examSchema,
        // OPTIMIZATION: Disable thinking for lower latency to speed up parsing
        thinkingConfig: { thinkingBudget: 0 }, 
        temperature: 0.2 // Lower temperature for more deterministic extraction
      }
    });

    if (response.text) {
      const questions = JSON.parse(response.text) as Question[];
      return deduplicateQuestions(questions);
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
          
          Generate a NEW set of remedial questions that test the same underlying concepts.
          - Do not force specific types (MCQ/Coding/Tracing). Use the best format for the concept.
          - Ensure code snippets are correctly formatted.
          - Focus on clearing up misconceptions shown by failing the original questions.
        `;
    
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [{ text: prompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: examSchema,
            thinkingConfig: { thinkingBudget: 0 }
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
      Expected Concept/Solution: ${question.explanation}
      
      User Code Submission:
      <USER_CODE>
      ${code}
      </USER_CODE>
      
      Evaluate validity and correctness. Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: gradingSchema,
        thinkingConfig: { thinkingBudget: 0 }
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
