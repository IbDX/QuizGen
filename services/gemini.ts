
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
  const seenSignatures = new Set<string>();

  for (const q of questions) {
    // 1. Normalize Text: Lowercase, remove markdown flair, collapse spaces
    const normalizedText = q.text
      .toLowerCase()
      .replace(/[\*\*_`~]/g, '') // Strip common markdown chars
      .replace(/\s+/g, ' ')
      .trim();

    // 2. Normalize Code: Remove all whitespace (ignore formatting diffs)
    const normalizedCode = q.codeSnippet 
        ? q.codeSnippet.replace(/\s+/g, '').toLowerCase() 
        : 'no_code';

    // 3. Normalize Options: Sort them so order doesn't matter for uniqueness
    const normalizedOptions = q.options 
        ? [...q.options].sort().map(o => o.replace(/\s+/g, '').toLowerCase()).join('|') 
        : 'no_options';

    // Composite Signature: Type + Text + Code + Options
    // This ensures questions with generic text like "What is the output?" are distinguished by their code snippet.
    const signature = `${q.type}::${normalizedText}::${normalizedCode}::${normalizedOptions}`;

    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      // Ensure unique ID for React rendering
      uniqueQuestions.push({
        ...q,
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      });
    }
  }
  return uniqueQuestions;
};

export const generateExam = async (files: { base64: string, mimeType: string }[], instructions?: string): Promise<Question[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We select a model capable of multimodal understanding (images/pdf)
    const modelId = 'gemini-2.5-flash'; 

    const prompt = `
      Analyze the provided document(s) (images/PDFs) and extract the exam questions contained within them.
      
      **1. STRICT FIDELITY - REFLECT THE SOURCE**: 
      - **Do Not Balance Types**: If the document contains 100% MCQs, return 100% MCQs. If it contains 5 Coding questions, return 5. Do not invent questions to fill quotas.
      - **NO DUPLICATES**: Process the documents. If a question is repeated (e.g. on a summary slide), IGNORE the duplicate. Return unique questions only.

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

    // Construct multi-part content
    const parts: any[] = files.map(file => ({
        inlineData: {
            mimeType: file.mimeType,
            data: file.base64.replace(/\s/g, '') // Ensure clean base64
        }
    }));
    
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: parts
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
          const questions = JSON.parse(response.text) as Question[];
          return deduplicateQuestions(questions);
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
