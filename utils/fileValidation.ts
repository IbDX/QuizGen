/**
 * Validates file size and magic bytes to ensure it is PDF, JPG, or PNG.
 */
export const validateFile = async (file: File): Promise<{ valid: boolean; error?: string }> => {
  const MAX_SIZE_MB = 15;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `File size exceeds ${MAX_SIZE_MB}MB limit.` };
  }

  const magicByteValid = await checkMagicBytes(file);
  if (!magicByteValid) {
    return { valid: false, error: 'Invalid file format. Only PDF, JPG, and PNG are allowed based on file signature.' };
  }

  return { valid: true };
};

const checkMagicBytes = async (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      if (!e.target || !e.target.result) {
        resolve(false);
        return;
      }
      
      const arr = (new Uint8Array(e.target.result as ArrayBuffer)).subarray(0, 4);
      let header = "";
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16);
      }
      
      // Magic Numbers
      // PDF: 25 50 44 46 (%PDF)
      // JPG: FF D8 FF
      // PNG: 89 50 4E 47
      
      if (header.startsWith('25504446')) { // PDF
        resolve(true);
      } else if (header.startsWith('ffd8ff')) { // JPG
        resolve(true);
      } else if (header.startsWith('89504e47')) { // PNG
        resolve(true);
      } else {
        resolve(false);
      }
    };
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        // Remove data url prefix (e.g. "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const urlToBase64 = async (url: string): Promise<{ base64: string, mimeType: string, name: string }> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch URL');
    
    const blob = await response.blob();
    const mimeType = blob.type;
    
    // Basic validation
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      throw new Error('URL must point to a PDF or Image');
    }

    const base64 = await fileToBase64(new File([blob], "downloaded_file", { type: mimeType }));
    const name = url.split('/').pop() || 'url_file';
    
    return { base64, mimeType, name };
  } catch (error) {
    console.error(error);
    throw new Error('CORS error or invalid URL. Ensure the server allows cross-origin requests.');
  }
};