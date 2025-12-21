
import { ErrorCode, AppError } from '../types';

/**
 * 1. RETRY LOGIC (Exponential Backoff)
 * Wraps any async operation with retry capabilities.
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    // Don't retry on 429 (Quota) - fail fast to let UI handle "System Busy"
    if (retries === 0 || error?.message?.includes('429') || error?.status === 429) {
      throw error;
    }
    // Don't retry on AbortError (User cancelled or Timeout)
    if (error?.name === 'AbortError') {
      throw error;
    }
    
    console.warn(`Operation failed, retrying in ${delay}ms...`, error);
    await new Promise(res => setTimeout(res, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
};

/**
 * 2. ROBUST JSON PARSING
 * Extracts JSON from Markdown blocks and handles common LLM syntax errors.
 */
export const cleanAndParseJSON = (text: string): any => {
  if (!text) throw new AppError("Empty Response", ErrorCode.API_ERROR);
  
  try {
    // Remove Markdown code blocks (e.g., ```json ... ```)
    let clean = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    // Fallback: Attempt to find the first '[' and last ']' for arrays
    try {
      const arrayMatch = text.match(/\[.*\]/s);
      if (arrayMatch) return JSON.parse(arrayMatch[0]);
      
      const objectMatch = text.match(/\{.*\}/s);
      if (objectMatch) return JSON.parse(objectMatch[0]);
    } catch (innerE) {
      throw new AppError("Failed to parse AI response", ErrorCode.MALFORMED_RESPONSE, e, true);
    }
    throw new AppError("Invalid JSON structure", ErrorCode.MALFORMED_RESPONSE, e, true);
  }
};

/**
 * 3. PARTIAL DATA RECOVERY
 * Validates an array of items against a validator function.
 * Keeps valid items, logs invalid ones.
 */
export const validateAndFilter = <T>(
  data: any[],
  validator: (item: any) => boolean
): { valid: T[], corruptedCount: number } => {
  if (!Array.isArray(data)) {
      // If it's not an array, maybe it's a wrapped object? Try to extract.
      if (data && Array.isArray((data as any).questions)) {
          data = (data as any).questions;
      } else {
          throw new AppError("Expected array response", ErrorCode.MALFORMED_RESPONSE);
      }
  }
  
  const valid: T[] = [];
  let corruptedCount = 0;

  data.forEach(item => {
    if (validator(item)) {
      valid.push(item);
    } else {
      corruptedCount++;
      console.warn("Corrupted Item Dropped:", item);
    }
  });

  return { valid, corruptedCount };
};
