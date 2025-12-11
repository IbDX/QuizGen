
# 01. Architecture & Technology Stack

## Core Architecture
The application is a **Client-Side Single Page Application (SPA)** built with React 19. It operates without a traditional backend database. Persistence is handled via `localStorage` for the Library and Leaderboard, while heavy computational logic (Exam Generation, Grading) is offloaded to the **Google Gemini API**.

### State Management (`App.tsx`)
The app uses a finite state machine pattern within `App.tsx` to manage the user journey. The `appState` variable controls the main view:

1.  **UPLOAD:** File selection, VirusTotal scanning, and demo loading.
2.  **CONFIG:** Exam settings (Time, Mode, Language, Format).
3.  **BUILDER:** The AI Chatbot interface for custom exam negotiation.
4.  **GENERATING:** The loading screen with mini-games while the LLM processes data.
5.  **EXAM:** The active testing interface (`ExamRunner`).
6.  **RESULTS:** Scoring, grading analysis, and remediation options.
7.  **LIBRARY:** Viewing saved content (overlay state).

### Component Hierarchy
*   **Layout:** Wraps the app, handling Themes (Light/Dark/Palestine), Header/Footer, and the AI Helper bot.
*   **FileUpload:** Handles drag-and-drop, URL fetching, and initial security checks.
*   **ExamConfig:** Configuration form for tailoring the exam generation prompt.
*   **ExamRunner:** The core exam engine. Handles timers, pagination, input capture, and distinct rendering for MCQ vs Code vs Tracing.
*   **Results:** Computes scores and calls the AI for grading open-ended questions.

### Technology Choices
*   **React 19:** Leverages modern hooks (`useRef`, `useCallback`) and memoization for performance.
*   **Tailwind CSS:** Utility-first styling with dynamic CSS variables for theme switching (`var(--color-term-green)`).
*   **Google GenAI SDK:** Direct integration with Gemini 2.5 Flash for low-latency, high-token context windows.
*   **PDF.js:** Used technically for two things:
    1.  Rendering previews.
    2.  **Visual Cropping:** The AI returns bounding box coordinates, and we use PDF.js to render the page to a canvas and crop the specific image on the client side.
