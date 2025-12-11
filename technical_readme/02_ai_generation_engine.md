
# 02. AI Generation Engine (`services/gemini.ts`)

The heart of the application lies in `services/gemini.ts`. It acts as the bridge between the raw user files and the structured exam data.

## 1. Prompt Engineering Strategy
We use a **Phased System Instruction** to ensure high-fidelity output. The prompt is structured into phases:

*   **Phase 0 (Sanitization):** Explicit instructions to detect if the source file contains answers (e.g., an answer key) and strip them from the question text to prevent spoilers.
*   **Phase 1 (Parsing):** Text extraction and cleanup (removing page numbers, headers).
*   **Phase 2 (Visual Analysis):**
    *   **Math:** Detects functions like $y=x^2$ and requests a `graphConfig` JSON object instead of an image.
    *   **Diagrams:** Detects flowcharts/UML and requests `mermaid.js` code in `diagramConfig`.
    *   **Images:** If it's a generic image, requests `visualBounds` (coordinates).
*   **Phase 3 (Classification):** Determines if a question is MCQ, Coding, Tracing, or Short Answer.
*   **Phase 4 (Formatting):** Enforces the user's preferred format (e.g., forcing a text question to become an MCQ by generating distractors).

## 2. Structured Output (JSON Schema)
We utilize Gemini's `responseSchema` capability to enforce strict typing. This guarantees the API returns a valid JSON Array of `Question` objects, preventing parsing errors.

```typescript
// Example Schema Constraint
expectedOutput: {
    type: Type.STRING,
    description: "For CODING/TRACING, capture sample output verbatim."
}
```

## 3. Visual Processing Pipeline
This is a unique feature of Z+:
1.  **AI Detection:** The model analyzes the PDF page and identifies a visual.
2.  **Coordinate Return:** Instead of returning the image bytes, it returns `[ymin, xmin, ymax, xmax]` (0-1000 scale).
3.  **Client-Side Crop:** The frontend (`services/gemini.ts` -> `cropImage`) uses `PDF.js` to render the specific page to an HTML Canvas, then slices the canvas based on the coordinates.
4.  **Result:** A clean, high-resolution image of just the diagram/figure is displayed to the user.

## 4. The Exam Builder (Chat Agent)
The `ExamBuilder.tsx` uses a conversational history approach.
1.  **Persona:** The AI is instructed to be a "System Architect" that negotiates requirements.
2.  **Accumulation:** It chats with the user until the user says "Generate".
3.  **Override:** When finalized, a hidden system message is sent: `SYSTEM OVERRIDE: Generate JSON now based on previous chat`. This flips the model from "Chat Mode" to "JSON Generation Mode".
