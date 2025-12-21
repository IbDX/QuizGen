
/**
 * Cryptography and Compression Utilities for Z+ Files.
 * Uses native CompressionStream (GZIP) for size reduction and obfuscation.
 */

const HEADER_TAG = "ZPLUS:v1:";

/**
 * Compresses a JSON object into a GZIP-compressed Base64 string.
 * @param data The JSON object to compress
 * @returns A string starting with the header tag followed by base64 data
 */
export const compressData = async (data: any): Promise<string> => {
  try {
    const jsonString = JSON.stringify(data);
    const stream = new Blob([jsonString], { type: 'application/json' }).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const response = new Response(compressedStream);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    
    // Convert ArrayBuffer to Base64
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    return `${HEADER_TAG}${base64}`;
  } catch (e) {
    console.error("Compression Failed", e);
    throw new Error("Failed to compress exam data.");
  }
};

/**
 * Decompresses a Z+ string back into a JSON object.
 * Handles both new compressed format and legacy plain JSON.
 * @param content The raw file content
 */
export const decompressData = async (content: string): Promise<any> => {
  if (!content) return null;

  // 1. Check for Legacy JSON (Backward Compatibility)
  if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      try {
          return JSON.parse(content);
      } catch (e) {
          throw new Error("Invalid Legacy JSON format.");
      }
  }

  // 2. Process Compressed Data
  if (!content.startsWith(HEADER_TAG)) {
      throw new Error("Invalid file signature. Not a valid .zplus file.");
  }

  try {
      const base64 = content.replace(HEADER_TAG, '');
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      
      const stream = new Blob([bytes]).stream();
      const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
      const response = new Response(decompressedStream);
      const jsonString = await response.text();
      
      return JSON.parse(jsonString);
  } catch (e) {
      console.error("Decompression Failed", e);
      throw new Error("File is corrupted or encrypted with an incompatible version.");
  }
};

/**
 * Calculates SHA-256 hash of a string.
 */
export const calculateStringHash = async (message: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
