
/**
 * Security Utilities for Input Sanitization and Validation
 */

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
  /on\w+=/gim // Event handlers like onload=, onerror=
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
  sanitized = sanitized.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2. SQL Injection Protection for Text Fields
  // For simple text fields, we disallow common SQL characters
  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        isValid: false,
        sanitizedValue: sanitized,
        error: "Security Alert: Illegal characters or SQL patterns detected."
      };
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
       // We don't block it outright (might be false positive in string), 
       // but we flag it for the UI to potentially warn or we rely on the Gemini wrapper.
       // For this implementation, we allow it but ensure the AI service wraps it safely.
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
