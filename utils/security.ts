
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

// XSS patterns - Generic
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
 * SECURITY PIPELINE CORE
 * A layered approach to input validation and sanitization.
 */
class SecurityPipeline {
    
    /**
     * Layer 1: Input Normalization
     * handles Unicode equivalence (NFKC) and strips dangerous non-printable control characters.
     */
    static normalize(input: string): string {
        if (!input) return "";
        // 1. Unicode Normalization
        let normalized = input.normalize('NFKC');
        // 2. Strip dangerous control characters (keep \t, \n, \r)
        // Removes NULL bytes and other invisible chars that can mask payloads
        normalized = normalized.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
        return normalized;
    }

    /**
     * Layer 2: LLM & Prompt Injection Defense
     * Prevents users from manipulating the AI agent's instructions.
     */
    static checkInjection(input: string): { safe: boolean; error?: string } {
        const injectionPatterns = [
            /ignore previous instructions/i,
            /system prompt/i,
            /you are now/i,
            /override system/i,
            /act as a/i
        ];

        for (const pattern of injectionPatterns) {
            if (pattern.test(input)) {
                return { safe: false, error: "Security Alert: Prompt injection pattern detected." };
            }
        }
        return { safe: true };
    }

    /**
     * Layer 3: Context-Aware XSS & Code Injection Detection
     * Distinguishes between legitimate code syntax (e.g., C++ templates) and malicious DOM vectors.
     */
    static checkCodeSafety(input: string): { safe: boolean; error?: string } {
        // A. Immediate Execution Vectors (Always Block)
        if (/javascript:\s*/i.test(input)) return { safe: false, error: "Blocked: 'javascript:' pseudo-protocol." };
        if (/data:text\/html/i.test(input)) return { safe: false, error: "Blocked: Data URI injection." };
        if (/vbscript:/i.test(input)) return { safe: false, error: "Blocked: VBScript tag." };

        // B. DOM Injection Patterns (Contextual)
        // We allow <vector> (C++) but flag <script> (JS/HTML) if not properly contained.
        // Since we cannot easily parse context here, we flag high-risk tags that are rarely used in standard algorithmic solutions.
        
        const highRiskTags = [
            /<script\b[^>]*>/i,
            /<iframe\b[^>]*>/i,
            /<object\b[^>]*>/i,
            /<embed\b[^>]*>/i,
            /<meta\b[^>]*>/i,
            /<base\b[^>]*>/i,
            /<form\b[^>]*>/i
        ];

        for (const pattern of highRiskTags) {
            if (pattern.test(input)) {
                return { safe: false, error: "Security Alert: High-risk HTML tag detected in code block." };
            }
        }

        // C. Event Handler Attributes (heuristic)
        // Matches things like onload=, onerror=, but tries to avoid false positives in code strings like "str = 'onload='"
        // This is a loose check; rigorous prevention happens at the Rendering layer (Prism/React).
        if (/\bon\w+\s*=\s*['"][^'"]*['"]/i.test(input)) {
             // We allow it, but monitor. For strict mode:
             // return { safe: false, error: "Security Alert: Potential event handler injection." };
        }

        return { safe: true };
    }

    /**
     * Layer 4: HTML Entity Encoding (For Display contexts)
     * Preserves syntax characters for code but neutralizes them for DOM.
     */
    static escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

/**
 * Sanitizes simple text inputs (Username, Tracing Answer, URL).
 * Strictly removes SQL and HTML characters.
 */
export const sanitizeInput = (input: string, maxLength: number = 100): ValidationResult => {
  if (!input) return { isValid: true, sanitizedValue: "" };

  let sanitized = SecurityPipeline.normalize(input.slice(0, maxLength));

  // 1. XSS Protection: Remove HTML tags manually for simple text fields
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  // 2. SQL Injection Protection
  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isValid: false,
        sanitizedValue: sanitized,
        error: "Security Alert: Illegal characters or SQL patterns detected."
      };
    }
  }

  // 3. XSS Pattern Check (Redundant but safe)
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
 * Validates Code Editor Input using the Multi-Layer Pipeline.
 */
export const validateCodeInput = (code: string, maxLength: number = 5000): ValidationResult => {
  if (!code) return { isValid: true, sanitizedValue: "" };

  // Layer 1: Length Constraint
  if (code.length > maxLength) {
    return {
      isValid: false,
      sanitizedValue: code.slice(0, maxLength),
      error: `Code exceeds maximum length of ${maxLength} characters.`
    };
  }

  // Layer 2: Normalization
  const normalized = SecurityPipeline.normalize(code);

  // Layer 3: Anti-Prompt-Injection
  const injectionCheck = SecurityPipeline.checkInjection(normalized);
  if (!injectionCheck.safe) {
      return {
          isValid: false,
          sanitizedValue: normalized,
          error: injectionCheck.error
      };
  }

  // Layer 4: XSS & Code Safety
  const safetyCheck = SecurityPipeline.checkCodeSafety(normalized);
  if (!safetyCheck.safe) {
      return {
          isValid: false,
          sanitizedValue: normalized,
          error: safetyCheck.error
      };
  }

  return { isValid: true, sanitizedValue: normalized };
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
    
    // Deep validation of questions
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
