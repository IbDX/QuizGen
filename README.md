
# Z+ Terminal Exam Gen 🖥️

An AI-powered, terminal-themed examination platform that generates technical assessments from uploaded documents (PDF/Images). Built with React, Tailwind CSS, and Google Gemini 2.5.

## ✨ Features

### 1. Intelligent Exam Generation
-   **Multi-File Batching:** Upload and process multiple PDFs or Images simultaneously to create comprehensive exams.
-   **Global Context Scanning:** The AI analyzes the entire document stack to understand context before generating questions, ensuring high fidelity.
-   **Quick Diagnostic Test:** Instant "Demo Mode" that loads a simulated C++ environment to test the system without needing files.
-   **VirusTotal Integration:** Files are hashed and verified securely against the VirusTotal database before processing.
-   **Smart Deduplication:** Automatically detects and prevents duplicate file uploads using SHA-256 hashing.

### 2. Exam Modes & Formats
-   **Original Mode (Default):** Strictly adheres to the source document's format (e.g., preserves True/False, Fill-in-the-Blank).
-   **Mixed Mode:** Automatically selects the best question type based on content optimization.
-   **Format Overrides:** Force the entire exam into a specific format:
    -   **MCQ Only:** Converts coding challenges and open-ended questions into multiple-choice.
    -   **Coding Only:** Converts theory into practical coding tasks.
    -   **Tracing Only:** Focuses purely on code output analysis.

### 3. Interactive Exam Experience
-   **One-Way Mode:** Standard exam style; submit all answers at the end.
-   **Two-Way Mode:** Instant feedback after every question.
-   **Rich Code Editor:** Integrated syntax highlighting (PrismJS) for coding questions.
-   **Code Canvas:** dedicated, syntax-highlighted window for reading complex code snippets without visual clutter.
-   **Mini-Games:** Play Snake, Tic-Tac-Toe, Sokoban, or Memory Match during the AI generation phase.

### 4. Grading & Analytics
-   **AI Grading:** Automated analysis of custom code submissions with detailed feedback.
-   **Z+ Elite Badge:** Achieve a perfect 100% score to unlock the exclusive "Elite Agent" badge on the leaderboard.
-   **Weak Point Analysis:** Identifies specific topics where you struggled and provides curated learning resources (Video + Reading).
-   **Remediation:** One-click generation of a *new* tactical makeup exam focusing only on your weak points.

### 5. Advanced UI/UX
-   **Cyberpunk / Terminal Theme:** Immersive dark mode with optional, togglable matrix rain background.
-   **Mobile-First Design:**
    -   Responsive hamburger menu containing all critical actions.
    -   Auto-hiding headers and footers to maximize screen real estate.
    -   Touch-optimized controls.
-   **Smart Previews:** Hover over uploaded files to see instant PDF or Image previews within the configuration menu.
-   **Custom Cursor:** Terminal-themed pointer options (Wait, Grab, Text, Crosshair).
-   **PDF Export:** Download comprehensive reports including questions, your answers, and detailed explanations.

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
-   **Security:** VirusTotal API, Input Sanitization, SHA-256 Hashing

---
*Built with <3 by Z+ Team*
