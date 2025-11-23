
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuestionType, QuestionFormatPreference, OutputLanguage, UILanguage } from "../types";

// Helper to generate schema based on preference
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
        text: { type: Type.STRING, description: "The question text. Do NOT include the code snippet here." },
        codeSnippet: { type: Type.STRING, nullable: true, description: "Code block if applicable. REQUIRED for TRACING." },
        options: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          nullable: true,
          description: "List of choices. REQUIRED for MCQ type." 
        },
        correctOptionIndex: { type: Type.INTEGER, nullable: true, description: "Index of correct option. REQUIRED for MCQ." },
        tracingOutput: { type: Type.STRING, nullable: true, description: "The expected output string. REQUIRED for TRACING." },
        explanation: { type: Type.STRING, description: "Detailed step-by-step solution." }
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

const tipsSchema = {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description: "A list of short, interesting technical facts or tips."
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
    const signature = `${q.type}::${normalizedText}::${normalizedCode}::${normalizedOptions}`;

    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      
      let cleanText = q.text;

      // Remove raw code string if present in text
      if (q.codeSnippet && q.codeSnippet.length > 10 && cleanText.includes(q.codeSnippet)) {
          cleanText = cleanText.replace(q.codeSnippet, '').trim();
      }

      // Remove markdown code blocks from text if they contain the logic
      cleanText = cleanText.replace(/```[\s\S]*?```/g, (match) => {
         return q.codeSnippet ? "[See Code Window Below]" : match;
      });

      uniqueQuestions.push({
        ...q,
        text: cleanText,
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      });
    }
  }
  return uniqueQuestions;
};

const getSystemInstruction = (preference: QuestionFormatPreference, outputLang: OutputLanguage): string => {
    let langInstruction = "";
    
    if (outputLang === 'ar') {
        langInstruction = `
        **LANGUAGE REQUIREMENT: TECHNICAL ARABIC**
        - You MUST generate the "text" (Question), "options", and "explanation" in **Arabic**.
        - However, **ALL CODE SNIPPETS, VARIABLE NAMES, and PROGRAMMING SYNTAX MUST REMAIN IN ENGLISH**.
        - Use standard computer science terminology in Arabic (e.g., use 'مصفوفة' for Array, 'دالة' for Function, 'مؤشر' for Pointer) but keep the code strictly English.
        - Example: "ما هي مخرجات الكود التالي؟" instead of "What is the output?".
        - Do NOT translate code keywords (e.g., 'int', 'void', 'for', 'if').
        `;
    } else if (outputLang === 'auto') {
        langInstruction = `
        **LANGUAGE REQUIREMENT: SOURCE MATCHING (MULTI-FILE BATCH SUPPORT)**
        - You are likely processing a batch of files that may be in **DIFFERENT languages**.
        - For **EACH** individual question you extract, detect the language of the specific source text/file it comes from.
        - If File A is Arabic and File B is English, questions extracted from File A **MUST** be in Arabic, and questions from File B **MUST** be in English.
        - **Do NOT** standardize the language across the whole exam. Preserve the original language of each individual question.
        - **ALWAYS** keep code snippets and syntax in ENGLISH/Technical format regardless of the question language.
        `;
    } else {
        langInstruction = `**LANGUAGE REQUIREMENT: ENGLISH**
           - Generate all content in English.`;
    }

    const BASE_INSTRUCTION = `
    ${langInstruction}

    **PHASE 1: GLOBAL CONTEXT SCAN**
    - First, analyze ALL attached files from start to finish.
    - Understand the document layout, question numbering, and answer keys (if present).
    - Identify EVERY question in the document. Do not skip any.
    - Preserve C++ syntax like pointers (*ptr) and references (&ref). Do not interpret them as Markdown italics.
    `;

    switch (preference) {
        case QuestionFormatPreference.MCQ:
            return `
            ${BASE_INSTRUCTION}
            
            **PHASE 2: FORCED MCQ TRANSFORMATION**
            You MUST output EVERY question as "type": "MCQ". 
            If a question is NOT originally an MCQ, you must creatively transform it.

            **TRANSFORMATION RULES:**
            1. **Source: Coding Challenge (Write code...)**
               - *Transformation:* Generate 4 code snippets as options.
               - *Option A:* The Correct Code.
               - *Options B, C, D:* Plausible code with syntax errors or logic bugs.
               - *Prompt:* "Which of the following implementations correctly solves: [Problem]?"

            2. **Source: Tracing (What is output?)**
               - *Transformation:* Keep the code snippet.
               - *Options:* Generate 4 possible outputs (1 correct, 3 distractors).
               - *Prompt:* "What is the output of the following code?"

            3. **Source: Open Ended (Define X...)**
               - *Transformation:* Create 4 definition statements.
               - *Prompt:* "Which statement best describes [Concept]?"

            **CONSTRAINT:** Output JSON must ONLY contain "type": "MCQ". All other fields (tracingOutput) are ignored.
            `;

        case QuestionFormatPreference.CODING:
            return `
            ${BASE_INSTRUCTION}
            
            **PHASE 2: FORCED CODING TRANSFORMATION**
            You MUST output EVERY question as "type": "CODING".
            
            **TRANSFORMATION RULES:**
            1. **Source: MCQ (Choose the correct code...)**
               - *Transformation:* Strip the options. Extract the problem statement.
               - *Prompt:* "Write a function/program that [Original Goal]."
               - *Action:* Set 'options' to null.

            2. **Source: Tracing (What is the output of this code?)**
               - *Transformation:* Reverse engineering.
               - *Prompt:* "Write a program that produces exactly the following output: [Output Value]."
               
            3. **Source: Theory (What is recursion?)**
               - *Prompt:* "Write a simple code example that demonstrates the concept of Recursion."

            **CONSTRAINT:** Output JSON must ONLY contain "type": "CODING". 'options' and 'tracingOutput' must be null.
            `;

        case QuestionFormatPreference.TRACING:
            return `
            ${BASE_INSTRUCTION}
            
            **PHASE 2: FORCED TRACING TRANSFORMATION**
            You MUST output EVERY question as "type": "TRACING".
            
            **TRANSFORMATION RULES:**
            1. **Source: Theory / MCQ**
               - *Transformation:* Create a code snippet that demonstrates the concept being asked.
               - *Prompt:* "What is the output of this code?"
               - *Result:* Put the result in 'tracingOutput'.

            2. **Source: Coding (Write a function...)**
               - *Transformation:* Take the solution code. Hardcode specific inputs (e.g., func(5)).
               - *Prompt:* "What does this function return when called with input 5?"

            **CONSTRAINT:** Output JSON must ONLY contain "type": "TRACING". 'tracingOutput' field is REQUIRED.
            `;

        case QuestionFormatPreference.ORIGINAL:
            return `
            ${BASE_INSTRUCTION}
            
            **PHASE 2: STRICT FIDELITY EXTRACTION**
            Extract questions exactly as they appear. Do NOT change their type.

            1. **MCQ**: If visual options (A,B,C,D) or True/False exist -> Type: "MCQ".
            2. **TRACING**: If code exists and asks for output (No options) -> Type: "TRACING".
            3. **CODING**: If prompt asks to Write/Implement code (No options) -> Type: "CODING".
            4. **SHORT ANSWER**: If prompt is text-based (No options) -> Type: "MCQ" (Leave options empty).

            **PRIORITY:** Always check for Options first. If options exist, it IS an MCQ, even if it contains code.
            `;

        default: // MIXED / AUTO
            return `
            ${BASE_INSTRUCTION}
            
            **PHASE 2: SMART CLASSIFICATION**
            Analyze each question and assign the most appropriate type for learning.

            1. **MCQ**: Use if options are present. (Priority #1)
            2. **CODING**: Use if the question asks to "Write" or "Implement".
            3. **TRACING**: Use if the question asks for "Output" or "Result".
            4. **FALLBACK**: Use "MCQ" with empty options for fill-in-the-blank or short answer.

            **GOAL:** Provide a diverse mix of question types if the document supports it.
            `;
    }
};

export const generateExam = async (
    files: { base64: string, mimeType: string }[], 
    preference: QuestionFormatPreference = QuestionFormatPreference.MIXED,
    outputLanguage: OutputLanguage = 'en',
    instructions?: string
): Promise<Question[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const modelId = 'gemini-2.5-flash'; 

    const systemPrompt = getSystemInstruction(preference, outputLanguage);

    const userPrompt = `
      Analyze the attached **${files.length} file(s)**.
      
      **INSTRUCTION**: 
      Process EVERY file from start to finish. Extract ALL questions found.
      
      ${instructions ? `Additional User Instructions: ${instructions}` : ''}
      
      Return a JSON array adhering to the schema.
    `;

    // Construct multi-part content
    const parts: any[] = files.map(file => ({
        inlineData: {
            mimeType: file.mimeType,
            data: file.base64.replace(/\s/g, '') // Ensure clean base64
        }
    }));
    
    parts.push({ text: userPrompt });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: parts
      },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: getExamSchema(preference), 
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

// --- NEW FEATURE: DYNAMIC TIP GENERATION ---
export const generateLoadingTips = async (fileNames: string[], lang: UILanguage = 'en'): Promise<string[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const context = fileNames.length > 0 ? fileNames.join(', ') : "Programming, Computer Science, and Technology";
        
        let prompt = "";
        if (lang === 'ar') {
             prompt = `
                Generate 3 unique, obscure, and interesting technical facts or tips related to: ${context}.
                
                Rules:
                1. **OUTPUT MUST BE IN ARABIC**.
                2. Keep each tip short (under 25 words).
                3. If including code, wrap it in backticks and keep the code in English.
                4. Do not use generic advice. Make it sound like a system log or advanced hint.
                5. Randomize the topics slightly within the domain.
            `;
        } else {
             prompt = `
                Generate 3 unique, obscure, and interesting technical facts or tips related to: ${context}.
                
                Rules:
                1. Keep each tip short (under 25 words).
                2. If including code, wrap it in backticks.
                3. Do not use generic "Hello World" advice. Make it sound like a system log or advanced hint.
                4. Randomize the topics slightly within the domain.
            `;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: tipsSchema,
                temperature: 1.0 // High temperature for maximum randomness
            }
        });

        if (response.text) {
            return JSON.parse(response.text) as string[];
        }
        return [];
    } catch (e) {
        console.warn("Failed to generate AI tips", e);
        return [];
    }
};
