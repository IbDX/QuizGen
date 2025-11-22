
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuestionType, QuestionFormatPreference } from "../types";

// Helper to generate schema based on preference
// NOTE: We avoid strict 'enum' in the schema definition to prevent 500 Internal Server Errors
// that sometimes occur with the GenAI SDK when processing complex multimodal inputs with strict enum constraints.
// We enforce the types via the prompt description instead.
const getExamSchema = (preference: QuestionFormatPreference): Schema => {
  let allowedDescription = "One of: 'MCQ', 'TRACING', 'CODING'";
  
  if (preference === QuestionFormatPreference.MCQ) {
    allowedDescription = "MUST be strictly 'MCQ'. Do not return any other type.";
  } else if (preference === QuestionFormatPreference.TRACING) {
    allowedDescription = "MUST be strictly 'TRACING'. Do not return any other type.";
  } else if (preference === QuestionFormatPreference.CODING) {
    allowedDescription = "MUST be strictly 'CODING'. Do not return any other type.";
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
        **STRICT MODE: FORCED MCQ TRANSFORMATION**
        You MUST convert EVERY question in the document into a Multiple Choice Question (MCQ), regardless of its original format.
        
        **TRANSFORMATION RULES:**
        1.  **IF Source is Coding/Writing (e.g., "Write a function to...")**:
            -   **ACTION**: Create a scenario: "Which of the following implementations correctly [solves the problem]?"
            -   **OPTIONS**: Generate 4 code snippets: 1 Correct, 3 with subtle logic/syntax errors.
            -   **TYPE**: Set to 'MCQ'.
        
        2.  **IF Source is Tracing (e.g., "What is the output?")**:
            -   **ACTION**: Use the existing code.
            -   **OPTIONS**: Generate 4 possible output values (1 correct, 3 distractors).
            -   **TYPE**: Set to 'MCQ'.
            
        3.  **IF Source is Open Ended / Short Answer**:
            -   **ACTION**: Frame it as "Which statement best defines [concept]?".
            -   **OPTIONS**: Generate 4 distinct textual definitions.
            
        **CONSTRAINT**: The output array must ONLY contain questions with "type": "MCQ". Do not output CODING or TRACING types.
        `;
    } else if (preference === QuestionFormatPreference.CODING) {
        formatInstruction = `
        **STRICT MODE: FORCED CODING TRANSFORMATION**
        You MUST convert EVERY question in the document into a Coding Challenge, regardless of its original format.
        
        **TRANSFORMATION RULES:**
        1.  **IF Source is MCQ**:
            -   **ACTION**: Strip the options. Extract the core problem.
            -   **PROMPT**: Rewrite as "Write a program/function that [solves the problem described in the MCQ]".
            -   **TYPE**: Set to 'CODING'. leave 'options' null.
            
        2.  **IF Source is Tracing**:
            -   **ACTION**: Reverse the problem.
            -   **PROMPT**: Provide the target output and ask: "Write the code that produces this output: [Output Value]".
            -   **TYPE**: Set to 'CODING'.
            
        3.  **IF Source is Theory/Open**:
            -   **PROMPT**: "Write a code example that demonstrates [Concept]".
            
        **CONSTRAINT**: The output array must ONLY contain questions with "type": "CODING". Do not output MCQ or TRACING types.
        `;
    } else if (preference === QuestionFormatPreference.TRACING) {
        formatInstruction = `
        **STRICT MODE: FORCED TRACING TRANSFORMATION**
        You MUST convert EVERY question in the document into a Code Tracing problem.
        
        **TRANSFORMATION RULES:**
        1.  **IF Source is MCQ/Theory**:
            -   **ACTION**: Create a code snippet that demonstrates the concept.
            -   **PROMPT**: "What is the output of this code?"
            -   **TYPE**: Set to 'TRACING'.
            
        2.  **IF Source is Coding**:
            -   **ACTION**: Take the solution code, hardcode specific input variables.
            -   **PROMPT**: "What is the return value/output of this function?"
            -   **TYPE**: Set to 'TRACING'.
            
        **CONSTRAINT**: The output array must ONLY contain questions with "type": "TRACING". Do not output MCQ or CODING types.
        `;
    } else if (preference === QuestionFormatPreference.ORIGINAL) {
        formatInstruction = `
        **STRICT FIDELITY MODE (ORIGINAL)**
        
        **PHASE 1: GLOBAL CONTEXT SCAN**
        Scan the ENTIRE document layout. Identify questions, their numbering, and where options are located (below, side, or separate key).
        
        **PHASE 2: CLASSIFICATION & EXTRACTION**
        For EACH question, determine its type based on visual evidence and map to the closest category:
        
        1. **MCQ (Multiple Choice / True-False)**
           - **IF** the question has choices (A, B, C, D), checkboxes, or "True/False":
           - **SET** "type": "MCQ".
           - **ACTION**: Extract options exactly. If "True/False", options are ["True", "False"].
           
        2. **TRACING (Output Prediction)**
           - **IF** the question provides code and asks for the output/result (and has NO options):
           - **SET** "type": "TRACING".
           - **ACTION**: Extract code to 'codeSnippet'.
           
        3. **CODING (Writing Code)**
           - **IF** the question asks to write/implement code (and has NO options):
           - **SET** "type": "CODING".
           
        4. **SHORT ANSWER / OPEN ENDED (Fallback)**
           - **IF** the question asks for a definition, explanation, or short text answer (and has NO options):
           - **SET** "type": "MCQ" (We use this as a container for text answers).
           - **ACTION**: Leave 'options' field empty/null.
           
        **CRITICAL RULES**:
        - **ALWAYS check for options first.** Even if it looks like a coding question, if it has options A/B/C/D, it IS an MCQ.
        - Do not skip questions. Extract every question found.
        - Preserve C++ pointers (*ptr) and references (&ref).
        `;
    } else {
        // Mixed / Default (Smart Extraction)
        formatInstruction = `
        **UNIVERSAL SMART EXTRACTION (MIXED MODE)**
        
        **PHASE 1: GLOBAL CONTEXT SCAN**
        Understand the document structure. Group options with their questions.
        
        **PHASE 2: BEST-FIT CLASSIFICATION**
        Classify each question into the best fitting category.
        
        1. **MCQ (Priority 1)**
           - **Condition**: Presence of Options (A-D), True/False, Yes/No.
           - **Type**: "MCQ".
           - **Note**: This overrides other types. Code + Options = MCQ.
           
        2. **CODING (Priority 2)**
           - **Condition**: "Write", "Implement", "Create" code.
           - **Type**: "CODING".
           
        3. **TRACING (Priority 3)**
           - **Condition**: "What is the output?", "Calculate result" of code.
           - **Type**: "TRACING".
           
        4. **TEXT / THEORY (Fallback)**
           - **Condition**: Any question not fitting above (e.g. "Define X", "Fill in the blank").
           - **Type**: "MCQ" (with empty options).
           
        **STRICT RULES**:
        - Extract questions exactly.
        - Ensure 'options' array is populated if choices exist.
        - Ensure 'codeSnippet' is populated if code exists.
        - Preserve C++ pointers (*ptr) and references (&ref).
        `;
    }

    const prompt = `
      Analyze the provided document(s) (images/PDFs) and extract the exam questions.
      
      **GLOBAL CONTEXT SCAN**: First, read the entire document to understand the layout, question numbering, and answer key location (if any).
      
      ${formatInstruction}

      **GENERAL RULES**:
      - **Code Snippets**: Preserve newlines, indentation, and headers (#include). Put code in 'codeSnippet' field ONLY.
      - **Text Separation**: The 'text' field must ONLY contain the question prompt. **DO NOT include the code in the 'text' field.**
      - **Explanation**: Provide a step-by-step solution derivation.
      - **C++ Syntax**: Do NOT strip asterisks (*) used for pointers or ampersands (&) used for references. Treat them as code syntax, not markdown.
      
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
        responseSchema: getExamSchema(preference), // Dynamic Schema (Relaxed Enum but Strict Desc)
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
