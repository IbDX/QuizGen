
# Z+ Terminal Exam Gen 🖥️

An AI-powered, terminal-themed examination platform that generates technical assessments from uploaded documents (PDF/Images). Built with React, Tailwind CSS, and Google Gemini 2.5.

## ✨ Features

### 1. Intelligent Exam Generation
-   **Multi-File Batching:** Upload and process multiple PDFs or Images simultaneously.
-   **Global Context Scanning:** The AI analyzes the entire document stack to understand context before generating questions.
-   **VirusTotal Integration:** Files are hashed and verified securely against the VirusTotal database.
-   **Smart Deduplication:** Prevents duplicate file uploads and duplicate questions in the exam output.

### 2. Exam Modes & Formats
-   **Mixed Mode (Default):** Automatically selects the best question type (MCQ, Coding, Tracing) based on content.
-   **Original Mode:** Strictly adheres to the source document's format (e.g., keeps True/False as is).
-   **Format Overrides:** Force the entire exam into a specific format:
    -   **MCQ Only:** Converts coding challenges into multiple-choice questions.
    -   **Coding Only:** Converts theory into practical coding tasks.
    -   **Tracing Only:** Focuses purely on code output analysis.

### 3. Interactive Exam Experience
-   **One-Way Mode:** Standard exam style; submit all answers at the end.
-   **Two-Way Mode:** Instant feedback after every question.
-   **Rich Code Editor:** Integrated syntax highlighting (PrismJS) for coding questions.
-   **Code Window:** Dedicated, syntax-highlighted canvas for reading code snippets.
-   **Mini-Games:** Play Snake, Tic-Tac-Toe, Sokoban, or Memory Match while the AI generates your exam.

### 4. Grading & Analytics
-   **AI Grading:** Automated analysis of custom code submissions.
-   **Weak Point Analysis:** Identifies specific topics where you struggled and provides curated learning resources (Video + Reading).
-   **Remediation:** One-click generation of a *new* makeup exam focusing only on your weak points.
-   **Leaderboard:** Track your high scores locally.

### 5. Advanced UI/UX
-   **Cyberpunk / Terminal Theme:** Immersive dark mode with optional matrix rain background.
-   **Responsive Design:** Optimized for both Desktop and Mobile (touch-friendly controls).
-   **Custom Cursor:** Terminal-themed pointer options.
-   **PDF Export:** Download comprehensive reports including questions, your answers, and detailed explanations.
-   **Question Library:** Save specific questions for later review.

## 🚀 How to Run

### Prerequisites
-   Node.js installed.
-   A Google Gemini API Key.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/terminal-exam-gen.git
    cd terminal-exam-gen
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set Environment Variable:**
    Create a `.env` file (or set in your environment) with your Google Gemini API Key:
    ```
    API_KEY=your_google_gemini_api_key
    ```

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

5.  **Build for Production:**
    ```bash
    npm run build
    ```

## 🛠️ Tech Stack

-   **Frontend:** React 18+, TypeScript
-   **Styling:** Tailwind CSS
-   **AI Model:** Google Gemini 2.5 Flash
-   **Editor:** React Simple Code Editor + PrismJS
-   **PDF Generation:** jsPDF
-   **Security:** VirusTotal API, Input Sanitization

---
*Built with <3 by Z+ Team*
