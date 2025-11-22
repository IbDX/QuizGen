
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

// Calculate SHA-256 hash locally
const calculateSHA256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// Helper for delay/sleep
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main Entry Point for Scanning
 */
export const scanFileWithVirusTotal = async (file: File): Promise<ScanResult> => {
  try {
    // 1. FAST PATH: Check if file hash exists (GET /files/{hash})
    const hash = await calculateSHA256(file);
    const headers = { 'x-apikey': API_KEY, 'accept': 'application/json' };
    
    const reportRes = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, { method: 'GET', headers });
    
    if (reportRes.status === 200) {
        const data = await reportRes.json();
        return parseVTResponse(data.data.attributes, "Hash Lookup");
    }
    
    if (reportRes.status === 401) return { safe: true, message: "VT API Key Invalid (401)" };
    if (reportRes.status === 429) return { safe: true, message: "VT Rate Limit Exceeded (429)" };

    // 2. SLOW PATH: File not known (404), so we Upload and Scan (POST /files)
    if (reportRes.status === 404) {
        return await uploadAndPoll(file);
    }

    throw new Error(`Unexpected VT Status: ${reportRes.status}`);

  } catch (error: any) {
    console.warn("VirusTotal Check Failed:", error);
    const isCors = error.name === 'TypeError' && error.message === 'Failed to fetch';
    
    return {
      safe: true, 
      message: isCors 
        ? "Scan Skipped (Browser CORS blocked VT API). Running in offline mode." 
        : `Scan Error: ${error.message || 'Unknown'}`
    };
  }
};

/**
 * Uploads file to /files endpoint and polls /analyses/{id}
 */
const uploadAndPoll = async (file: File): Promise<ScanResult> => {
    const formData = new FormData();
    formData.append("file", file);

    // Step A: POST /files
    const uploadRes = await fetch("https://www.virustotal.com/api/v3/files", {
        method: "POST",
        headers: { 'x-apikey': API_KEY, 'accept': 'application/json' },
        body: formData
    });

    if (!uploadRes.ok) {
        if (uploadRes.status === 429) return { safe: true, message: "VT Rate Limit Exceeded during Upload" };
        throw new Error(`Upload Failed: ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();
    const analysisId = uploadData.data.id; // e.g., "OTFiMDcw..."

    // Step B: Poll GET /analyses/{id}
    // We poll for up to 15 seconds (approx 5 attempts)
    let attempts = 0;
    const MAX_ATTEMPTS = 5; 
    
    while (attempts < MAX_ATTEMPTS) {
        await delay(3000); // Wait 3s between polls
        
        const analysisRes = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
            method: 'GET',
            headers: { 'x-apikey': API_KEY, 'accept': 'application/json' }
        });

        if (analysisRes.ok) {
            const analysisData = await analysisRes.json();
            const attributes = analysisData.data.attributes;
            const status = attributes.status; // "queued", "in_progress", "completed"

            if (status === 'completed') {
                // Analysis endpoint returns 'stats' or 'results', slightly different from /files
                // We construct a compatible stats object
                return parseVTResponse(attributes, "Cloud Scan");
            }
        }
        attempts++;
    }

    // If we time out, we assume safe but warn user
    return { 
        safe: true, 
        message: "Scan initiated but analysis pending. Proceeding with caution." 
    };
};

/**
 * Parses the attributes from either /files or /analyses response
 */
const parseVTResponse = (attributes: any, source: string): ScanResult => {
    // /files/{hash} uses 'last_analysis_stats'
    // /analyses/{id} uses 'stats'
    const stats = attributes.last_analysis_stats || attributes.stats;

    if (!stats) {
        return { safe: true, message: `VT Analysis (${source}): No stats available.` };
    }

    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const total = (malicious + suspicious + (stats.harmless || 0) + (stats.undetected || 0));

    // Try to find a specific threat label if available
    let threatLabel = undefined;
    if (attributes.popular_threat_classification?.suggested_threat_label) {
        threatLabel = attributes.popular_threat_classification.suggested_threat_label;
    }

    if (malicious > 0 || suspicious > 0) {
      return {
        safe: false,
        message: `THREAT DETECTED (${source}): ${malicious}/${total} vendors flagged this.`,
        threatLabel: threatLabel,
        scans: stats
      };
    }

    return {
      safe: true,
      message: `VirusTotal Scan Passed (${source}). Clean.`,
      scans: stats
    };
};
