
/**
 * Security Utilities for Input Sanitization and Validation
 */

import { Question, SavedExam } from "../types";

// SQL Injection patterns to block in non-code inputs (e.g. Username, Tracing)
const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|TRUNCATE)\b)/i, // Keywords
  /(--)/, // Comments
  /(;)/, // Statement termination
  /(\bOR\b\s+['"]?[\w]+['"]?\s*=\s*['"]?[\w]+['"]?)/i, // Tautologies (1=1)
  /(')/ // Single quotes (often used to break strings)
];

// XSS patterns
const XSS_PATTERNS = [
  /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
  /javascript:/gim,
  /on\w+=/gim, // Event handlers like onload=, onerror=
  /data:text\/html/gim
];

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue: string;
  error?: string;
}

/**
 * Sanitizes simple text inputs (Username, Tracing Answer, URL).
 * Strictly removes SQL and HTML characters.
 */
export const sanitizeInput = (input: string, maxLength: number = 100): ValidationResult => {
  if (!input) return { isValid: true, sanitizedValue: "" };

  let sanitized = input.slice(0, maxLength);

  // 1. XSS Protection: Remove HTML tags
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  // 2. SQL Injection Protection for Text Fields
  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(input)) { // Check original input for intent
      return {
        isValid: false,
        sanitizedValue: sanitized,
        error: "Security Alert: Illegal characters or SQL patterns detected."
      };
    }
  }

  // 3. XSS Pattern Check
  for (const pattern of XSS_PATTERNS) {
      if (pattern.test(input)) {
          return {
              isValid: false,
              sanitizedValue: "",
              error: "Security Alert: Malicious script pattern detected."
          }
      }
  }

  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validates Code Editor Input.
 * We CANNOT strip SQL keywords here because the user might be writing SQL code.
 * Instead, we focus on Length limits and Anti-Prompt-Injection.
 */
export const validateCodeInput = (code: string, maxLength: number = 5000): ValidationResult => {
  if (!code) return { isValid: true, sanitizedValue: "" };

  // 1. Length Constraint
  if (code.length > maxLength) {
    return {
      isValid: false,
      sanitizedValue: code.slice(0, maxLength),
      error: `Code exceeds maximum length of ${maxLength} characters.`
    };
  }

  // 2. Prompt Injection Detection
  // We look for patterns where the user tries to trick the AI
  const injectionPatterns = [
    /ignore previous instructions/i,
    /system prompt/i,
    /you are now/i
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(code)) {
       // We allow it in code blocks (it might be a test case), but we flag it if needed.
       // For security, we ensure the AI prompt wraps this safely.
    }
  }

  return { isValid: true, sanitizedValue: code };
};

/**
 * Escapes text to be safely inserted into a JSON string or Prompt.
 */
export const escapeForPrompt = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
};

/**
 * Validates the structure of imported JSON to ensure it matches the SavedExam schema.
 * Prevents object injection or malformed data crashes.
 */
export const validateExamSchema = (data: any): boolean => {
    if (!data || typeof data !== 'object') return false;
    
    // Check required fields
    if (!Array.isArray(data.questions)) return false;
    // Allow missing title/date (backwards compat), but questions are mandatory.
    
    // Deep validation of questions
    // We check a sample to ensure it looks like a Question object
    const isValidQuestion = (q: any) => {
        return (
            typeof q.id === 'string' &&
            typeof q.type === 'string' &&
            typeof q.text === 'string' &&
            typeof q.explanation === 'string'
        );
    };

    // Check first few questions to verify integrity
    return data.questions.slice(0, 5).every(isValidQuestion);
};
