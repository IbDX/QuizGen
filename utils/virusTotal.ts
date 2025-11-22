const API_KEY = "40db05fc89dc6b0735840be6127a78e91f4ed8cf10984014a6c4968ab489ef2c";

export interface ScanResult {
  safe: boolean;
  message: string;
  scans?: {
    malicious: number;
    suspicious: number;
    harmless: number;
    undetected: number;
  };
}

// Calculate SHA-256 hash locally to avoid uploading sensitive files if already scanned
const calculateSHA256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

export const scanFileWithVirusTotal = async (file: File): Promise<ScanResult> => {
  try {
    const fileHash = await calculateSHA256(file);
    
    const response = await fetch(`https://www.virustotal.com/api/v3/files/${fileHash}`, {
      method: 'GET',
      headers: {
        'x-apikey': API_KEY,
        'Accept': 'application/json'
      }
    });

    if (response.status === 404) {
      // File not found in VT database. 
      // Since we cannot easily upload files from client-side (CORS restrictions on VT upload endpoints),
      // we will treat unknown files as "Unverified" but allow them with a warning.
      return {
        safe: true,
        message: "File hash not found in VirusTotal database. Proceeding with caution (Local Analysis Only)."
      };
    }

    if (!response.ok) {
      throw new Error(`VirusTotal API Error: ${response.status}`);
    }

    const data = await response.json();
    const stats = data.data.attributes.last_analysis_stats;
    
    const malicious = stats.malicious;
    const suspicious = stats.suspicious;

    if (malicious > 0 || suspicious > 0) {
      return {
        safe: false,
        message: `THREAT DETECTED: ${malicious} security vendors flagged this file as malicious.`,
        scans: stats
      };
    }

    return {
      safe: true,
      message: "VirusTotal Scan Passed: No threats detected.",
      scans: stats
    };

  } catch (error: any) {
    console.warn("VirusTotal Check Failed:", error);
    // If API fails (e.g., quota exceeded or CORS), we default to allowing but warning.
    return {
      safe: true, // Fail open for demo purposes, but in prod this might be false
      message: "VirusTotal Scan Skipped (API/Network Error). Proceeding."
    };
  }
};