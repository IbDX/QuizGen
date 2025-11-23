

/**
 * Validates file size and magic bytes to ensure it is PDF, JPG, or PNG.
 */
export const validateFile = async (file: File): Promise<{ valid: boolean; error?: string; mimeType?: string }> => {
  const MAX_SIZE_MB = 10; // Updated to 10MB limit
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `File size exceeds ${MAX_SIZE_MB}MB limit.` };
  }

  const detectedMime = await checkMagicBytes(file);
  if (!detectedMime) {
    return { valid: false, error: 'Invalid file format. Only PDF, JPG, and PNG are allowed based on file signature.' };
  }

  return { valid: true, mimeType: detectedMime };
};

const checkMagicBytes = async (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      if (!e.target || !e.target.result) {
        resolve(null);
        return;
      }
      
      const arr = (new Uint8Array(e.target.result as ArrayBuffer)).subarray(0, 4);
      let header = "";
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16).padStart(2, '0');
      }
      
      // Magic Numbers
      // PDF: 25 50 44 46 (%PDF)
      // JPG: FF D8 FF
      // PNG: 89 50 4E 47
      
      if (header.startsWith('25504446')) { 
        resolve('application/pdf');
      } else if (header.startsWith('ffd8ff')) { 
        resolve('image/jpeg');
      } else if (header.startsWith('89504e47')) { 
        resolve('image/png');
      } else {
        resolve(null);
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
    let mimeType = blob.type;
    
    // Fallback for generic types: If MIME is generic, try to deduce from URL extension first
    const urlLower = url.toLowerCase();
    if (mimeType === 'application/octet-stream' || mimeType === 'binary/octet-stream' || !mimeType) {
        if (urlLower.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (urlLower.endsWith('.png')) mimeType = 'image/png';
        else if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) mimeType = 'image/jpeg';
    }

    // If MIME type is STILL invalid or generic, double check with Magic Bytes
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
       const tempFile = new File([blob], "temp_check", { type: mimeType });
       const detected = await checkMagicBytes(tempFile);
       
       if (detected) {
           mimeType = detected;
       } else {
           throw new Error(`Invalid file type: ${mimeType || 'Unknown'}. URL must point to a PDF or Image.`);
       }
    }

    const base64 = await fileToBase64(new File([blob], "downloaded_file", { type: mimeType }));
    const name = url.split('/').pop() || 'url_file';
    
    return { base64, mimeType, name };
  } catch (error: any) {
    console.error(error);
    throw new Error(error.message || 'CORS error or invalid URL. Ensure the server allows cross-origin requests.');
  }
};
