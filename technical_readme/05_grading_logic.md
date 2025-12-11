
# 05. Grading Logic

Grading is split into two strategies depending on the question type (`ExamRunner.tsx` & `Results.tsx`).

## 1. Deterministic Grading (Client-Side)
Used for **MCQ** and **Tracing** questions.
*   **Mechanism:** The App compares the user's input directly against the `correctOptionIndex` or `tracingOutput` stored in the Question object.
*   **Normalization:** For tracing, whitespace and case are normalized before comparison to be lenient.
*   **Speed:** Instant feedback.

## 2. AI Semantic Grading (Server-Side)
Used for **Coding** and **Short Answer** questions.
*   **Trigger:** When the user submits, or when the exam ends.
*   **Process:**
    1.  The user's answer and the Question's "Explanation/Solution" are sent to Gemini.
    2.  **System Prompt:** "You are an expert grader. Compare User Answer X to Solution Y. Ignore spelling errors. Check for functional correctness."
    3.  **Output:** The AI returns a JSON object: `{ isCorrect: boolean, feedback: string }`.
*   **Language Awareness:** The grading prompt dynamically adjusts based on the UI language. If the UI is Arabic, the feedback is requested in Arabic.

## 3. Weak Point Analysis
In `Results.tsx`:
1.  We iterate through incorrect answers.
2.  We extract the `topic` field from each failed question.
3.  We aggregate failure counts by topic (e.g., "Pointers: 3 failed").
4.  **Resource Mapping:** A hardcoded dictionary maps common topics (Recursion, OOP, Loops) to specific YouTube search queries and documentation URLs to help the user learn.
