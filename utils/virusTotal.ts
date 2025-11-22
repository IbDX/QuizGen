
const API_KEY = "40db05fc89dc6b0735840be6127a78e91f4ed8cf10984014a6c4968ab489ef2c";

export interface ScanResult {
  safe: boolean;
  message: string;
  threatLabel?: string;
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

    // Handle 404: File not found in VT database (New file)
    // This is technically "safe" regarding known threats, but we haven't scanned it.
    if (response.status === 404) {
      return {
        safe: true,
        message: "Hash not in VirusTotal database. Local analysis only (Caution advised)."
      };
    }

    // Handle 401: Unauthorized (Wrong API Key)
    if (response.status === 401) {
       console.error("VirusTotal API Key Invalid");
       return {
         safe: true,
         message: "VirusTotal Config Error (401). Skipped."
       };
    }

    // Handle 429: Quota Exceeded (Rate Limit)
    if (response.status === 429) {
       console.warn("VirusTotal Rate Limit Exceeded");
       return {
         safe: true,
         message: "VirusTotal Rate Limit Exceeded. Skipped."
       };
    }

    const data = await response.json();

    // Check if the API returned a logical error inside the JSON
    if (data.error) {
        throw new Error(data.error.message || "Unknown API Error");
    }

    // Defensive coding: Ensure data structure exists
    if (!data.data || !data.data.attributes) {
        throw new Error("Invalid API Response Structure");
    }

    const attributes = data.data.attributes;
    const stats = attributes.last_analysis_stats;
    
    if (!stats) {
        return { safe: true, message: "No analysis stats available." };
    }

    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    
    // Extract specific threat label if available (e.g. "eicar/test", "trojan.win32...")
    // We safely check for the nested property
    const threatLabel = attributes.popular_threat_classification?.suggested_threat_label || 
                        (malicious > 0 ? "Malicious Content" : undefined);

    if (malicious > 0 || suspicious > 0) {
      return {
        safe: false,
        message: `SECURITY ALERT: ${malicious}/${malicious + (stats.undetected || 0) + (stats.harmless || 0)} vendors flagged this file.`,
        threatLabel: threatLabel,
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
    
    // Check for likely CORS error (common in browser-to-api calls without proxy)
    const isCors = error.name === 'TypeError' && error.message === 'Failed to fetch';
    
    return {
      safe: true, 
      message: isCors 
        ? "VirusTotal Scan Skipped (CORS/Network). Browser blocked request." 
        : `VirusTotal Error: ${error.message || 'Unknown'}`
    };
  }
};
