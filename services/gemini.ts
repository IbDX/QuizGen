import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuestionType, QuestionFormatPreference, OutputLanguage, UILanguage, ExamMode, ExamSettings } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema Definition for Question List
const questionSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      type: { type: Type.STRING, enum: [QuestionType.MCQ, QuestionType.TRACING, QuestionType.CODING, QuestionType.SHORT_ANSWER] },
      text: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctOptionIndex: { type: Type.NUMBER },
      tracingOutput: { type: Type.STRING },
      codeSnippet: { type: Type.STRING },
      explanation: { type: Type.STRING },
      topic: { type: Type.STRING },
      expectedOutput: { type: Type.STRING },
      graphConfig: {
        type: Type.OBJECT,
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
          properties: {
              type: { type: Type.STRING },
              code: { type: Type.STRING }
          }
      }
    },
    required: ['id', 'type', 'text', 'explanation', 'topic']
  }
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const generateExam = async (
  files: Array<{base64: string, mimeType: string}>,
  format: QuestionFormatPreference,
  outputLanguage: OutputLanguage,
  instructions?: string
): Promise<Question[]> => {
  
  const fileParts = files.map(f => ({
    inlineData: {
      data: f.base64,
      mimeType: f.mimeType
    }
  }));

  let formatPrompt = "";
  if (format === QuestionFormatPreference.MCQ) formatPrompt = "Force ALL questions to be Multiple Choice (MCQ).";
  else if (format === QuestionFormatPreference.TRACING) formatPrompt = "Force ALL questions to be Code Tracing (predict output).";
  else if (format === QuestionFormatPreference.CODING) formatPrompt = "Force ALL questions to be Coding Challenges (write code).";
  else if (format === QuestionFormatPreference.SHORT_ANSWER) formatPrompt = "Force ALL questions to be Short Answer/Open text.";
  else formatPrompt = "Mix question types (MCQ, Tracing, Coding, Graph, Diagram) appropriately based on content.";

  let langPrompt = "";
  if (outputLanguage === 'ar') langPrompt = "Output language for Questions and Explanations MUST be Arabic. Code must remain in English.";
  else if (outputLanguage === 'en') langPrompt = "Output language must be English.";
  
  const systemPrompt = `
    You are an expert Exam Generator. 
    Analyze the provided documents (Images/PDFs) and generate a comprehensive exam.
    
    RULES:
    1. ${formatPrompt}
    2. ${langPrompt}
    3. ${instructions ? `User Instructions: ${instructions}` : "Cover key concepts found in the documents."}
    4. Generate 5-10 high-quality questions.
    5. If mathematical functions are found, use 'graphConfig' to visualize them (e.g. "x^2").
    6. If system architectures or flows are found, use 'diagramConfig' with MermaidJS code.
    7. For CODING questions, provide 'expectedOutput'.
    8. For TRACING questions, provide 'tracingOutput'.
    9. Ensure 'id' is unique (e.g., "q1", "q2").
    10. 'topic' should be a short string like "Arrays", "Physics", "Calculus".
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [...fileParts, { text: "Generate the exam now." }]
    },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: questionSchema,
      maxOutputTokens: 8192
    }
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("No response from AI");
  return JSON.parse(jsonText) as Question[];
};

export const generateExamFromWrongAnswers = async (originalQuestions: Question[], wrongIds: string[]): Promise<Question[]> => {
  const wrongQuestions = originalQuestions.filter(q => wrongIds.includes(q.id));
  
  const context = JSON.stringify(wrongQuestions.map(q => ({
    topic: q.topic,
    text: q.text,
    type: q.type
  })));

  const systemPrompt = `
    The user failed the following questions: ${context}.
    Generate a REMEDIATION exam (3-5 questions) specifically targeting these weak topics.
    Make the questions slightly easier or focused on fundamentals.
    Output JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: "Generate remediation exam." }] },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: questionSchema
    }
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("No response from AI");
  return JSON.parse(jsonText) as Question[];
};

export const gradeCodingAnswer = async (question: Question, userAnswer: string, lang: UILanguage): Promise<{isCorrect: boolean, feedback: string}> => {
  const systemPrompt = `
    You are a Coding Grader.
    Question: ${question.text}
    Expected Code/Logic: ${question.explanation}
    Expected Output: ${question.expectedOutput}
    
    User Answer: ${userAnswer}
    
    Evaluate the user's code. 
    Return JSON: { "isCorrect": boolean, "feedback": string }
    Feedback language: ${lang === 'ar' ? 'Arabic' : 'English'}.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: "Grade this." }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING }
        }
      }
    }
  });

  const jsonText = response.text;
  if (!jsonText) return { isCorrect: false, feedback: "Error grading." };
  return JSON.parse(jsonText);
};

export const gradeShortAnswer = async (question: Question, userAnswer: string, lang: UILanguage): Promise<{isCorrect: boolean, feedback: string}> => {
  const systemPrompt = `
    You are an Exam Grader.
    Question: ${question.text}
    Correct Answer/Explanation: ${question.explanation}
    
    User Answer: ${userAnswer}
    
    Determine if the user's answer is factually correct based on the explanation.
    Return JSON: { "isCorrect": boolean, "feedback": string }
    Feedback language: ${lang === 'ar' ? 'Arabic' : 'English'}.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: "Grade this." }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING }
        }
      }
    }
  });

  const jsonText = response.text;
  if (!jsonText) return { isCorrect: false, feedback: "Error grading." };
  return JSON.parse(jsonText);
};

export const generateLoadingTips = async (files: Array<{base64: string, mimeType: string}>, lang: UILanguage): Promise<string[]> => {
  const fileParts = files.slice(0, 2).map(f => ({
    inlineData: { data: f.base64, mimeType: f.mimeType }
  }));

  const systemPrompt = `
    Analyze these documents briefly.
    Generate 3 short, interesting facts or "Pro Tips" related to the content.
    These will be displayed while loading.
    Language: ${lang === 'ar' ? 'Arabic' : 'English'}.
    Return JSON array of strings.
  `;

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [...fileParts, { text: "Generate tips." }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
  } catch (e) {
      return lang === 'ar' 
        ? ["جاري تحليل البيانات...", "يقوم الذكاء الاصطناعي ببناء الأسئلة...", "استعد للاختبار!"]
        : ["Analyzing data...", "AI is constructing your exam...", "Get ready!"];
  }
};

export const sendExamBuilderMessage = async (history: ChatMessage[], newMessage: string): Promise<string> => {
  const systemPrompt = `
    You are the "Exam Builder Agent". You chat with the user to design an exam.
    Current Phase: Gathering Requirements.
    Ask about: Subject, Difficulty, Number of Questions, Topics, Types (MCQ, Coding, etc.).
    
    If the user has provided enough info, ask if they are ready to generate.
    
    IMPORTANT: If you have a good idea of what they want, append ||SUGGESTIONS|| followed by a JSON array of 3 short suggested replies for the user to click.
    Example output:
    "Great! I'll focus on Arrays. What difficulty? ||SUGGESTIONS|| ["Easy", "Medium", "Hard"]"
  `;

  const chatHistoryStr = history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
  const fullPrompt = `${systemPrompt}\n\nCHAT HISTORY:\n${chatHistoryStr}\nUSER: ${newMessage}\nMODEL:`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: fullPrompt }] },
    config: { maxOutputTokens: 500 }
  });

  return response.text || "";
};

export const generateExamFromBuilderChat = async (history: ChatMessage[]): Promise<{questions: Question[], settings: Partial<ExamSettings>, title: string}> => {
    const chatHistoryStr = history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    
    const systemPrompt = `
      Based on the CHAT HISTORY, generate a full exam.
      1. Extract the Topic/Title.
      2. Extract preferences (Difficulty, Language, etc.).
      3. Generate the Questions JSON.
      
      Return JSON with this structure:
      {
        "title": "Exam Title",
        "settings": { "timeLimitMinutes": number, "mode": "ONE_WAY" | "TWO_WAY" },
        "questions": [ ... Question Schema ... ]
      }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: chatHistoryStr + "\n\nGENERATE EXAM JSON NOW." }] },
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    settings: { 
                        type: Type.OBJECT,
                        properties: {
                            timeLimitMinutes: { type: Type.NUMBER },
                            mode: { type: Type.STRING, enum: ['ONE_WAY', 'TWO_WAY'] }
                        }
                    },
                    questions: questionSchema
                }
            }
        }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Failed to generate exam from chat.");
    return JSON.parse(jsonText);
};

export const getAiHelperResponse = async (message: string, lang: UILanguage): Promise<string> => {
    try {
      const systemPrompt = `
        You are the "Z+ System Support Unit" for the "Terminal Exam Gen" web application.
        
        **YOUR GOAL**: Assist the user with specific troubleshooting, features, and usage of THIS website only.
        
        **APP KNOWLEDGE BASE**:
        - **Upload**: Supports PDF/IMG (Max 15MB/file, 50MB batch). Securely scans files via VirusTotal.
        - **.ZPLUS Files**: The app now uses a compressed, secure format (.zplus) for saving exams. It is GZIP-compressed and Base64 encoded.
        - **Modes**: 
           - *One-Way*: Standard exam, no feedback until end. 
           - *Two-Way*: Interactive, instant feedback per question.
        - **Formats**: 
           - *Original*: Keeps source format.
           - *MCQ Only*: Forces all questions to multiple choice.
           - *Coding*: Forces write-code style.
           - *Tracing*: Forces output prediction.
           - *Short Answer*: Open-ended text response.
        - **Library**: Saves questions/exams locally in the browser (LocalStorage).
        - **Z+ Badge**: Awarded for 100% score (Elite status).
        
        **STRICT RULES**:
        1. **REFUSE** any request unrelated to using this website.
        2. **LANGUAGE**: Respond in ${lang === 'ar' ? 'Arabic' : 'English'}.
        3. Keep answers short, robotic, professional, and helpful within the app context.
      `;
  
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: message }] },
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 200
        }
      });
  
      return response.text || "System Error: No response data.";
    } catch (error) {
      return "Connection Failure: Unable to reach Z+ Neural Core.";
    }
};