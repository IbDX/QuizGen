# Z+ Terminal Exam Gen 🖥️

An AI-powered, terminal-themed examination platform that generates technical assessments from uploaded documents (PDF/Images). Built with React, Tailwind CSS, and Google Gemini 2.5.

## ✨ Features

### 1. Intelligent Exam Generation
-   **Multi-Format Support:** Parses **PDF**, **JPG**, and **PNG** files (Max 15MB).
-   **Magic Byte Validation:** Ensures strict file type security beyond simple extension checks.
-   **VirusTotal Integration:** Hashes files locally and verifies them against the VirusTotal database before processing.
-   **URL Fetching:** Supports fetching documents directly from public URLs.

### 2. Question Types
The AI generates a mix of questions to test deep understanding:
-   **MCQ (Multiple Choice):** Standard knowledge checks.
-   **Code Tracing:** Displays a code snippet and asks for the output. Includes a specialized Code Window renderer.
-   **Coding Challenges:** Asks the user to write code in an embedded editor. The AI validates the user's code submission and provides feedback.

### 3. Exam Modes
-   **One-Way (Standard):** Users complete the entire exam before submitting. Feedback is given at the end.
-   **Two-Way (Interactive):** Users can check their answer for immediate feedback on every question. Ideal for practice.
-   **Optional Timer:** Set a time limit (5m - 120m) or disable it for untimed practice.

### 4. Grading & Analytics
-   **AI Grading:** Automatically grades code submissions for correctness and logic.
-   **Weak Point Analysis:** Identifies specific topics (e.g., "Recursion", "Pointers") where the user failed and highlights them.
-   **Remediation:** Generates a *new* exam focused specifically on the user's weak points.
-   **Leaderboard:** Local-storage based leaderboard to track high scores.

### 5. Tools & Utilities
-   **Question Library:** Save specific questions to a favorites library for later review.
-   **PDF Report Export:** Download a professionally formatted PDF containing questions, user answers, and the full answer key/explanations.
-   **Settings:**
    -   **Font Scaling:** Adjust global font size.
    -   **Visual Effects:** Toggle CRT scanlines and Dark/Light mode.
    -   **Layout:** Toggle between boxed container and full-width view.

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
    *Note: In the provided code, `process.env.API_KEY` is used. Ensure your build tool (Vite/Webpack) exposes this.*

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

5.  **Build for Production:**
    ```bash
    npm run build
    ```

## 📖 Usage Guide

1.  **Upload Source:** Drag and drop a lecture slide (PDF) or code screenshot (PNG) onto the landing zone. The app scans it for threats.
2.  **Configure Exam:**
    -   Select **Mode** (One-Way or Two-Way).
    -   Set **Time Limit** or toggle "Enable Timer" off.
3.  **Take Exam:**
    -   Use the code editor for coding questions.
    -   Use the "Save" (Heart icon) to add interesting questions to your library.
4.  **Review Results:**
    -   See your score and letter grade (A+ to F).
    -   Click **"View Weak Points"** to see topic breakdown.
    -   Click **"Remediate Weakness"** to generate a makeup exam.
    -   Click **"PDF Report"** to save a copy of the exam.

## 🛠️ Tech Stack

-   **Frontend:** React 18+, TypeScript
-   **Styling:** Tailwind CSS (Terminal Theme)
-   **AI Model:** Google Gemini 2.5 Flash
-   **Syntax Highlighting:** PrismJS
-   **PDF Generation:** jsPDF
-   **Security:** VirusTotal API (Hash-based scanning)

---
*Built with <3 by Z+ Team*
