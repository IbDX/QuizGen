
# 05. Grading Logic

Grading in Z+ is a hybrid system designed for both speed and depth. It utilizes **Deterministic Grading** for objective questions and **Asynchronous AI Grading** for subjective questions to maintain a smooth user experience.

## ⚖️ Grading Architecture

```mermaid
graph TD
    Submit[User Submits Answer] --> ModeCheck{Exam Mode?}
    
    ModeCheck -- Two-Way --> ImmediateCheck[Lock UI & Grade]
    ModeCheck -- One-Way --> StoreLocally[Store Answer & Continue]
    
    StoreLocally --> ExamFinish[Exam Finished]
    ExamFinish --> ResultsPhase[Enter Results Component]
    
    ResultsPhase --> FilterPending[Identify Coding/Short Answer Questions]
    FilterPending --> BatchGrade[Batch AI Grading Loop]
    BatchGrade --> FinalScore[Calculate Final Score]
    
    ImmediateCheck --> AI_API[Call Gemini API]
    BatchGrade --> AI_API
    
    AI_API --> Feedback[Return JSON: {isCorrect, feedback}]
```

---

## 1. Deterministic Grading (Client-Side)

Used for **MCQ** and **Tracing**. These are graded instantly (0ms latency).

*   **MCQ:** `userAnswer (index) === question.correctOptionIndex`
*   **Tracing:** `userString.trim().toLowerCase() === expectedString.trim().toLowerCase()`

---

## 2. Asynchronous AI Grading Strategy

Used for **CODING** and **SHORT_ANSWER**. Since these require an API call to Gemini (1-3 seconds), simply blocking the user during a "One-Way" exam is poor UX. We solve this with a deferred grading pipeline.

### A. One-Way Mode (Deferred)
1.  **During Exam:** User answers are stored raw in `userAnswers`. No grading happens.
2.  **On Submit:** The app transitions to the `RESULTS` state.
3.  **Grading Phase:** 
    *   The `Results.tsx` component mounts a "Loading/Grading" overlay.
    *   It filters for questions that are (1) Subjective and (2) Not yet graded.
    *   It iterates through them, calling `gemini.gradeCodingAnswer` or `gemini.gradeShortAnswer`.
    *   **Visual Feedback:** A progress bar shows "Analyzing Submission 1 of X...".
    *   **Optimization:** Empty answers are failed locally to save API quota.

### B. Two-Way Mode (Immediate with Lock)
1.  **During Exam:** The user clicks "Check Answer".
2.  **UI Locking:** The `ExamRunner` immediately sets `isGrading = true`.
    *   **CRITICAL:** Navigation buttons (Next/Prev) and the Answer Input are **DISABLED**. This prevents race conditions where a user might move to the next question while the previous one is still being graded, causing state mismatches.
3.  **API Call:** The single answer is sent to Gemini.
4.  **Feedback:** The result is displayed immediately, and the UI is unlocked.

---

## 3. The "Grader" Prompts (`services/gemini.ts`)

We send a specialized prompt package to Gemini to ensure fair and constructive grading.

### Coding Grader Prompt
```text
ROLE: Expert Code Grader.
INPUT: 
1. Question Text
2. Ideal Solution (Reference)
3. User's Code

CRITERIA:
1. Correctness: Does it solve the problem?
2. Syntax: Is it valid code?
3. Constraints: Did they use recursion if requested?

OUTPUT: JSON
{
  "isCorrect": boolean,
  "feedback": "Concise explanation..."
}
```

### Robustness
*   **Language Awareness:** The system explicitly instructs the AI to provide feedback in the user's selected UI language (English/Arabic), while keeping technical terms in English.
*   **JSON Enforcement:** We use `responseSchema` and fallback Regex parsing (`replace(/```json/, '')`) to handle cases where the model wraps the JSON in Markdown blocks.

---

## 4. Weak Point Analysis

When grading is complete, the system performs an aggregated analysis.

1.  **Topic Aggregation:** Iterate through wrong answers and collect `question.topic` tags (e.g., "Pointers", "Recursion").
2.  **Resource Generation:**
    *   Dynamic links are generated for YouTube and Google Search based on the topic and the user's language.
3.  **Remediation Loop:**
    *   The user can click **"Remediate"**.
    *   The app sends the *IDs* of the failed questions to `generateExamFromWrongAnswers`.
    *   Gemini generates **new** questions testing the *same concepts* but with different values/contexts.
