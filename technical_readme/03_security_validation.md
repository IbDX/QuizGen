
# 03. Security & Validation Protocols

Z+ implements a multi-layered security approach, even though it is a client-side application.

## 1. File Validation (`utils/fileValidation.ts`)
Before a file is even processed, it undergoes strict checks:
*   **Size Limit:** Hard cap of 10MB per file / 20MB batch to prevent memory crashes.
*   **Magic Bytes Check:** We do **not** rely on file extensions (e.g., `.pdf`). We read the first 4 bytes of the file buffer to verify the hexadecimal signature:
    *   PDF: `25 50 44 46`
    *   JPG: `FF D8 FF`
    *   PNG: `89 50 4E 47`
    This prevents users from renaming an `.exe` to `.pdf` and uploading it.

## 2. VirusTotal Integration (`utils/virusTotal.ts`)
We use the VirusTotal API to scan files for malware.
1.  **Hashing:** The file is hashed using **SHA-256** in the browser (`crypto.subtle.digest`).
2.  **Lookup:** We query VirusTotal to see if this hash is already known.
3.  **Analysis:** If the hash is known and flagged as malicious by >0 vendors, the file is rejected immediately.
4.  **Upload (Fallback):** If the file is unknown, we upload it to VirusTotal for a fresh scan (subject to API limits).

## 3. Input Sanitization (`utils/security.ts`)
To prevent XSS (Cross-Site Scripting) and Prompt Injection:
*   **Text Inputs:** Usernames and simple text answers are stripped of HTML tags (`<script>`) and SQL-like patterns (`SELECT`, `DROP`).
*   **Prompt Injection:** The `validateCodeInput` function scans for patterns like "Ignore previous instructions" or "System Prompt". While we allow code, we flag these patterns to the AI context to ensure the AI treats them as *data*, not *instructions*.

## 4. Browser Protections
*   **Sandboxing:** Code execution (in the user's mind) is simulated. We do not actually `eval()` user code in the browser. It is sent to the AI for static analysis.
*   **Local Storage:** Data saved to `localStorage` is purely JSON text, preventing execution risks upon retrieval.
