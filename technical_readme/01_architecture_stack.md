
# 01. Architecture & Technology Stack

## 🏗️ System Overview

**Z+ Terminal Exam Gen** is a high-performance **Client-Side Single Page Application (SPA)** built with React 19. It is designed to be "Serverless" in the sense that it relies on the client's browser for processing and Google's Gemini API for intelligence, without an intermediate backend database for session storage.

### Core Philosophy
1.  **Stateless Logic:** The backend (Gemini) provides intelligence on demand; the state is held transiently in the React Client.
2.  **Persistence Strategy:** `localStorage` is used for the "Library", "History", "Leaderboard", and "User Profile" to persist data across reloads without requiring user authentication.
3.  **Mobile-First Design:** The UI structure (seen in `Layout.tsx` and `ExamBuilder.tsx`) prioritizes touch targets, safe areas, and responsive constraints.

---

## 📂 Project Structure

```ascii
terminal-exam-gen/
├── components/          # UI Components
│   ├── AiHelper.tsx     # Floating Support Bot
│   ├── CodeWindow.tsx   # PrismJS Wrapper
│   ├── ExamBuilder.tsx  # Chat Interface
│   ├── ExamRunner.tsx   # Core Testing Engine
│   ├── GamificationUI.tsx # HUD & Profile Badges
│   ├── PerformanceDashboard.tsx # System Diagnostics Panel
│   ├── Results.tsx      # Grading Engine & Dashboard
│   └── ...
├── services/            # Business Logic & API Calls
│   ├── gamification.ts  # XP, Levels & Badge Logic
│   ├── gemini.ts        # Gemini API Integration (Prompts & Schema)
│   ├── library.ts       # LocalStorage Wrapper
│   └── monitor.ts       # Telemetry & Performance Logging
├── utils/               # Helper Functions
│   ├── fileValidation.ts # Magic Byte detection
│   ├── pdfGenerator.ts   # pdfMake configuration
│   ├── security.ts       # Input sanitization
│   └── virusTotal.ts     # Security scanning
├── types.ts             # TypeScript Interfaces (Question, ExamSettings)
└── App.tsx              # Main State Machine
```

---

## 🔄 State Management (Finite State Machine)

The application flow is strictly controlled by the `appState` variable in `App.tsx`. This ensures the user cannot be in an undefined state.

```mermaid
stateDiagram-v2
    [*] --> UPLOAD
    
    state "UPLOAD State" as UPLOAD {
        [*] --> Idle
        Idle --> Scanning : User drops file
        Scanning --> VirusTotalCheck
        VirusTotalCheck --> Idle : Success/Fail
    }

    UPLOAD --> CONFIG : File Accepted
    UPLOAD --> BUILDER : User clicks AI Builder

    state "BUILDER State" as BUILDER {
        Chatting --> Negotiating
        Negotiating --> GeneratingJSON
    }
    BUILDER --> EXAM : JSON Generated

    CONFIG --> GENERATING : Settings Confirmed
    GENERATING --> EXAM_READY : Gemini returns Questions
    EXAM_READY --> EXAM : User Starts

    state "EXAM State" as EXAM {
        TakingTest --> TimerRunning
        TimerRunning --> Submitting
    }

    EXAM --> RESULTS : Submit / Timeout
    
    state "RESULTS State" as RESULTS {
        [*] --> GradingLoop : Calculating Scores
        GradingLoop --> Analysis : AI Feedback Ready
        Analysis --> Remediation
        Analysis --> Gamification : XP Awarded
    }

    RESULTS --> EXAM : Retake / Remediation
    RESULTS --> UPLOAD : Restart
```

### Component Hierarchy & Data Flow

*   **App.tsx (Root):** Holds the "Truth" (`questions`, `userAnswers`, `uploadedFiles`, `userProfile`).
*   **Props Drilling:** Data is passed down to:
    *   `ExamRunner`: Receives `questions`, manages local `currentIndex` and `timer`.
    *   `Results`: Receives `userAnswers`, manages the **Post-Exam Grading Phase**, calculates final scores, triggers `gamification.ts` updates, and calls `gemini.ts` for deep evaluation.

---

## 🛠️ Technology Stack Deep Dive

### 1. Frontend Framework
*   **React 19:** Utilizes the latest concurrent features.
    *   **Hooks:** Extensive use of `useRef` for scrolling/focus management and `useEffect` for lifecycle events.
    *   **Portals:** Used for `PerformanceDashboard` and `ConfirmModal` to break out of the z-index stacking context.

### 2. AI Integration
*   **Google GenAI SDK (`@google/genai`):**
    *   **Model:** `gemini-2.5-flash` (Chosen for speed) and `gemini-3-pro-preview` (for complex logic).
    *   **Features Used:** `generateContent`, `responseSchema` (JSON enforcement), and `systemInstruction`.

### 3. Rendering Engine
*   **Visuals:**
    *   **PDF.js:** Used for rendering PDF pages to HTML Canvas for coordinate-based cropping.
    *   **Function Plot:** D3-based library for interactive math graphs ($y=x^2$).
    *   **Mermaid.js:** Renders text-based diagrams (UML, Flowcharts) dynamically.
*   **Typography:**
    *   **MathJax 3:** Renders LaTeX equations. Configured specifically to handle RTL (Arabic) math context isolation.
    *   **PrismJS:** Syntax highlighting for code blocks.

### 4. Persistence & Output
*   **jsPDF / pdfMake:** Generates client-side PDF reports with support for embedded fonts (Cairo/Amiri) for Arabic support.
*   **LocalStorage:** Stores:
    *   `zplus_question_library`: JSON array of individual saved questions.
    *   `zplus_exam_library`: JSON array of full exam snapshots.
    *   `zplus_exam_history`: JSON array of the last 3 completed exams.
    *   `zplus_user_profile_v1`: User gamification state (XP, Badges, Level).

### 5. Telemetry
*   **PerformanceMonitor (`services/monitor.ts`):** A custom singleton class that tracks API latency, storage usage, and interaction events. Feeds data to the `PerformanceDashboard` visualizer.

---

## ⚡ Performance Considerations

1.  **Asynchronous Grading:** To prevent UI freezing during an exam, complex AI grading (for Coding questions) is deferred to the `RESULTS` phase (in One-Way mode).
2.  **Lazy Loading:** Heavy libraries (PDF.js worker) are loaded only when required via CDN injection.
3.  **Visual Processing:** `PerformanceDashboard` uses `requestAnimationFrame` for smooth 60fps rendering of its stress tests and live logs.
4.  **Math Caching:** `MarkdownRenderer` implements a caching layer for MathJax SVGs to prevent re-rendering common symbols.
