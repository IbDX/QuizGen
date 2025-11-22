
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuestionType, QuestionFormatPreference } from "../types";

// Helper to generate schema based on preference
// NOTE: We avoid strict 'enum' in the schema definition to prevent 500 Internal Server Errors
// that sometimes occur with the GenAI SDK when processing complex multimodal inputs with strict enum constraints.
// We enforce the types via the prompt description instead.
const getExamSchema = (preference: QuestionFormatPreference): Schema => {
  let allowedDescription = "One of: 'MCQ', 'TRACING', 'CODING'";
  
  if (preference === QuestionFormatPreference.MCQ) {
    allowedDescription = "Must be 'MCQ'";
  } else if (preference === QuestionFormatPreference.TRACING) {
    allowedDescription = "Must be 'TRACING'";
  } else if (preference === QuestionFormatPreference.CODING) {
    allowedDescription = "Must be 'CODING'";
  }
  // ORIGINAL and MIXED allow all types

  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        type: { 
          type: Type.STRING, 
          description: `The type of the question. ${allowedDescription}.` 
        },
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
      
      // CLEANUP: Check if text contains the codeSnippet. If so, remove it from text to prevent display duplication.
      // Also check if the code snippet is accidentally embedded as a markdown block inside text
      let cleanText = q.text;

      // Remove raw code string if present
      if (q.codeSnippet && q.codeSnippet.length > 10 && cleanText.includes(q.codeSnippet)) {
          cleanText = cleanText.replace(q.codeSnippet, '').trim();
      }

      // Remove markdown code blocks from text if they contain the logic
      // This cleans up cases where the AI puts the code in 'codeSnippet' AND in 'text' as ```code```
      cleanText = cleanText.replace(/```[\s\S]*?```/g, (match) => {
         // If the block is very similar to the codeSnippet, remove it. 
         // For safety, we generally remove large code blocks from text if a separate snippet exists.
         return q.codeSnippet ? "[See Code Window Below]" : match;
      });

      // Ensure unique ID for React rendering
      uniqueQuestions.push({
        ...q,
        text: cleanText,
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      });
    }
  }
  return uniqueQuestions;
};

export const generateExam = async (
    files: { base64: string, mimeType: string }[], 
    preference: QuestionFormatPreference = QuestionFormatPreference.MIXED,
    instructions?: string
): Promise<Question[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const modelId = 'gemini-2.5-flash'; 

    // Construct Format Logic based on Preference
    let formatInstruction = "";
    
    if (preference === QuestionFormatPreference.MCQ) {
        formatInstruction = `
        **STRICT FORMAT ENFORCEMENT: MCQ ONLY**
        1.  You MUST convert EVERY question into a Multiple Choice Question (MCQ).
        2.  **Coding Problems -> MCQ**:
            -   Create a scenario: "Which of the following code snippets correctly implements X?"
            -   Provide 4 distinct code snippets as options A, B, C, D.
        3.  **Tracing Problems -> MCQ**:
            -   Ask "What is the output?"
            -   Provide 4 possible output values as options.
        4.  **Open Ended -> MCQ**:
            -   Create a conceptual question with 4 distinct definitions or statements.
        5.  **REQUIREMENT**: Set "type" to "MCQ".
        `;
    } else if (preference === QuestionFormatPreference.CODING) {
        formatInstruction = `
        **STRICT FORMAT ENFORCEMENT: CODING ONLY**
        1.  You MUST convert EVERY question into a Coding Challenge.
        2.  **MCQ -> Coding**:
            -   Ignore the options. Take the core concept (e.g., "Loops") and ask the user to "Write a function that..." demonstrates that concept.
        3.  **Tracing -> Coding**:
            -   Instead of asking for the output, provide the function signature and ask the user to "Implement the logic to achieve X".
        4.  **REQUIREMENT**: Set "type" to "CODING". Do NOT provide options.
        `;
    } else if (preference === QuestionFormatPreference.TRACING) {
        formatInstruction = `
        **STRICT FORMAT ENFORCEMENT: TRACING ONLY**
        1.  You MUST convert EVERY question into a Code Tracing problem.
        2.  **MCQ -> Tracing**:
            -   Create a code snippet that demonstrates the concept in the MCQ.
            -   Ask "What is the output of this code?".
        3.  **Coding -> Tracing**:
            -   Take the solution code, introduce a specific logic flow (or a bug), and ask "What does this print?" or "What is the value of X at the end?".
        4.  **REQUIREMENT**: Set "type" to "TRACING" and provide a "codeSnippet".
        `;
    } else if (preference === QuestionFormatPreference.ORIGINAL) {
        formatInstruction = `
        **STRICT FIDELITY MODE (ORIGINAL)**
        
        **PHASE 1: GLOBAL CONTEXT SCAN**
        Before extracting a single question, read the ENTIRE document(s) to understand the layout.
        - Distinguish between "Instructions" (e.g. "Answer all questions") and actual Questions.
        - Identify patterns: Are code blocks part of the question? Are options listed below or to the side?
        
        **PHASE 2: EXACT EXTRACTION**
        Extract questions EXACTLY as they appear in the document. Do NOT transform question formats.
        
        **RULES:**
        1. If the original question has options (A, B, C, D or checkboxes):
           - Set "type" to "MCQ".
           - Extract the options exactly.
           
        2. If the original question provides code and asks for the Output/Result (and has NO options):
           - Set "type" to "TRACING".
           
        3. If the original question asks the user to Write, Implement, or Create code (and has NO options):
           - Set "type" to "CODING".
           
        **CRITICAL:** 
        - Do NOT try to make the exam diverse. 
        - If the document contains 50 MCQs, return 50 "MCQ" questions. 
        - If the document contains 10 Coding problems, return 10 "CODING" questions.
        - Maintain the original numbering and text.
        `;
    } else {
        // Mixed / Default (Smart Extraction)
        formatInstruction = `
        **UNIVERSAL SMART EXTRACTION (MIXED MODE)**
        
        **PHASE 1: GLOBAL CONTEXT SCAN**
        Before extracting a single question, read the ENTIRE document(s) to understand the layout.
        - Distinguish between "Instructions" (e.g. "Answer all questions") and actual Questions.
        - Identify patterns: Are code blocks part of the question? Are options listed below or to the side?
        
        **PHASE 2: INDIVIDUAL CLASSIFICATION**
        For EACH question found, determine its "Original Type" based strictly on visual evidence.
        
        **CRITICAL: The output array MUST contain a mix of types ("MCQ", "TRACING", "CODING") corresponding to the actual content.**
        
        1. **MCQ (Multiple Choice)**
           - **Visual Cue**: Presence of distinct options (A, B, C, D), checkboxes, or radio buttons.
           - **Action**: Set "type": "MCQ", extract text, and extract "options" array.
           - **Note**: Even if the question contains a code snippet, IF IT HAS OPTIONS, IT IS AN MCQ.
        
        2. **TRACING (Output/Analysis)**
           - **Visual Cue**: A code snippet is provided, and the question asks for the "output", "result", or "value of X".
           - **Visual Cue**: NO distinct options are provided to select from (User must type the answer).
           - **Action**: Set "type": "TRACING", extract "codeSnippet", leave "options" null.
        
        3. **CODING (Implementation)**
           - **Visual Cue**: The question asks to "Write", "Implement", "Create", "Complete", or "Fix" code.
           - **Visual Cue**: Often followed by a large blank space or an empty editor box in the original document.
           - **Action**: Set "type": "CODING". Do not include solution code in the prompt.
           
        **STRICT RULES**:
        - Do not transform questions. Extract them exactly as they are.
        - If a question has options, it MUST be "MCQ".
        - If a question requires writing code, it MUST be "CODING".
        - If a question requires analyzing code for a specific string answer (without options), it is "TRACING".
        `;
    }

    const prompt = `
      Analyze the provided document(s) (images/PDFs) and extract the exam questions.
      
      ${formatInstruction}

      **GENERAL RULES**:
      - **Code Snippets**: Preserve newlines, indentation, and headers (#include). Put code in 'codeSnippet' field ONLY.
      - **Text Separation**: The 'text' field must ONLY contain the question prompt. **DO NOT include the code in the 'text' field.**
      - **Explanation**: Provide a step-by-step solution derivation.
      
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
        responseSchema: getExamSchema(preference), // Dynamic Schema (Relaxed Enum)
        thinkingConfig: { thinkingBudget: 0 }, 
        temperature: 0.2 
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
        
        // Remediation always uses Mixed schema to find best fit for learning
        const schema = getExamSchema(QuestionFormatPreference.MIXED);

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
            responseSchema: schema,
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
