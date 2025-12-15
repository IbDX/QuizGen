
# Z+ Terminal Exam Gen 🖥️

An advanced, terminal-themed AI examination platform that parses documents to create multi-format technical assessments with intelligent grading. Built with **React 19**, **Tailwind CSS**, and the **Google GenAI SDK** (Gemini 2.5).

## ✨ Features

### 1. Intelligent Exam Generation
-   **Multi-File Batching:** Upload and process multiple PDFs or Images simultaneously.
-   **Context-Aware Analysis:** The AI scans the entire document stack to understand context before generating questions.
-   **AI Exam Builder:** An interactive chat agent (`ExamBuilder`) that helps you negotiate and design custom exams through conversation.
-   **Quick Diagnostic Mode:** Instant "Demo Mode" for testing system capabilities without file uploads.
-   **Security First:** Integrated **VirusTotal** scanning to hash and verify files before processing.

### 2. Modes & Formats
-   **Flexible Formats:**
    -   **Original:** Preserves source document style.
    -   **Mixed:** AI selects the best format for the concept.
    -   **Forced Modes:** Convert content strictly to **MCQ**, **Coding Challenges**, **Tracing**, or **Short Answer**.
-   **Exam Styles:**
    -   **One-Way:** Standard testing environment.
    -   **Two-Way:** Interactive mode with immediate feedback per question.

### 3. Rich Interactive Experience
-   **Digital Graph Engine:** Renders mathematical functions ($y=x^2$) dynamically using `function-plot` rather than static images.
-   **Code Environment:**
    -   **Syntax Highlighting:** Integrated PrismJS editor for coding questions.
    -   **Code Window:** Specialized view for reading complex snippets.
-   **Mini-Games:** Play Snake, Tic-Tac-Toe, Sokoban, or Memory Match during AI generation loading times.
-   **Multilingual Support:** Full support for **English** and **Arabic** (RTL), including interface translations and content generation.

### 4. Grading & Analytics
-   **AI Grading:** Automated analysis of custom code submissions with semantic feedback.
-   **Smart Result Filtering:** By default, results focus on mistakes for efficient review. Toggle "View Full Exam" to see correct answers.
-   **Weak Point Analysis:** Identifies struggle areas and provides curated video/reading resources.
-   **Tactical Remediation:** One-click generation of specific makeup exams targeting your weak points.
-   **Leaderboard & Badges:** Track performance and earn the **Z+ Elite Badge** for perfect scores.
-   **Library System:**
    -   **Persistence:** Save individual questions or full exams.
    -   **History:** Automatically saves the last 3 sessions for quick retakes.
    -   **Smart Import:** 
        -   Detects duplicate exams and alerts with conflict details.
        -   Scans imported files with VirusTotal for malware.
        -   Validates JSON schema integrity.

### 5. Advanced UI/UX
-   **Themes:** Choose between **Light**, **Terminal (Dark)**, and **Palestine** themes.
-   **Theme-Adaptive Controls:** UI elements like the Photo Fetcher and Mode Selection buttons adapt colors dynamically to the selected theme (Blue/Gray for Light, Neon Green for Terminal, Red/Green for Palestine).
-   **AI System Agent:** A floating support bot (`AiHelper`) available to assist with platform navigation and troubleshooting.
-   **Responsive Design:** Mobile-first architecture with touch-optimized controls and auto-hiding menus.
-   **PDF Reports:** Generate professional PDF reports of your exam performance.
-   **Issue Reporting:** Integrated link to GitHub Issues for bug tracking via Advanced Settings.

---

## 📚 Technical Documentation

For a deep dive into how the system works internally, please refer to the technical documentation files:

1.  [**Architecture & Stack**](technical_readme/01_architecture_stack.md) - Overview of the React state machine, routing, and tech stack.
2.  [**AI Generation Engine**](technical_readme/02_ai_generation_engine.md) - How Gemini 2.5 is prompted, schema validation, and context parsing.
3.  [**Security & Validation**](technical_readme/03_security_validation.md) - VirusTotal integration, Magic Byte checking, library hashing, and input sanitization.
4.  [**Rendering System**](technical_readme/04_rendering_visuals.md) - How Graphs, Diagrams (Mermaid), and Markdown/Math (LaTeX) are rendered.
5.  [**Grading Logic**](technical_readme/05_grading_logic.md) - The hybrid grading system (Deterministic vs. LLM-based evaluation).

---

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
    Create a `.env` file with your API Key:
    ```
    API_KEY=your_google_gemini_api_key
    ```

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

## 🛠️ Tech Stack

-   **Frontend:** React 19, TypeScript
-   **Styling:** Tailwind CSS
-   **AI Integration:** @google/genai SDK (Gemini 2.5 Flash)
-   **Rendering:** jsPDF (Reporting), html2canvas, Function Plot (Graphs)
-   **Editor:** React Simple Code Editor + PrismJS
-   **Security:** VirusTotal API, Input Sanitization (SHA-256)

---
*Built with <3 by Z+ Team*
