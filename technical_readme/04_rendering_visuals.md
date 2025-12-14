
# 04. Rendering System

Z+ moves beyond static text by implementing a rich, dynamic rendering engine. This allows for interactive graphs, syntax-highlighted code, and complex mathematical notation.

## 🧩 Render Component Map

Different question types utilize specific React components for display:

| Content Type | Data Source | Component | Library |
| :--- | :--- | :--- | :--- |
| **Rich Text** | `question.text` | `MarkdownRenderer.tsx` | Custom Parsing |
| **Math / LaTeX** | `$E=mc^2$` | `MarkdownRenderer.tsx` | **MathJax 3** |
| **Code Block** | `question.codeSnippet` | `CodeWindow.tsx` | **PrismJS** |
| **Graphs** | `question.graphConfig` | `GraphRenderer.tsx` | **Function Plot** (D3) |
| **Diagrams** | `question.diagramConfig` | `DiagramRenderer.tsx` | **Mermaid.js** |
| **Static Images** | `question.visual` (Base64) | `ExamRunner.tsx` | Native `<img>` |

---

## 1. Markdown & Math (`MarkdownRenderer.tsx`)

Rendering mixed Markdown and LaTeX is complex, especially with Right-to-Left (RTL) Arabic text.

### The RTL Math Problem
In standard HTML, Arabic text sets the direction to `rtl`. This reverses the order of Math equations (e.g., $x^2 + y$ becomes $y + x^2$).

### The Solution: Isolation Strategy
1.  **Preprocessing:** We use Regex to identify math delimiters (`$`, `$$`, `\[`).
2.  **Protection:** Detected math is wrapped in a specific span: `<span dir="ltr" style="unicode-bidi: isolate;">...</span>`.
3.  **MathJax Processing:** MathJax parses the isolated span, rendering the SVG equation correctly from Left-to-Right, even while the surrounding text flows Right-to-Left.

---

## 2. Digital Graphs (`GraphRenderer.tsx`)

Instead of static images, Z+ renders interactive graphs.

*   **Input JSON (from AI):**
    ```json
    {
      "functions": ["x^2", "sin(x)"],
      "domain": [-10, 10],
      "yAxisLabel": "Amplitude"
    }
    ```
*   **Rendering:**
    The `GraphRenderer` component passes this config to `function-plot`.
*   **Interactivity:** Users can:
    *   Hover to see $(x,y)$ coordinates.
    *   Zoom in/out with the scroll wheel.
    *   Pan the graph by dragging.

---

## 3. Diagrams (`DiagramRenderer.tsx`)

For system design questions, the AI generates **Mermaid.js** code.

### Robustness (Self-Healing)
LLMs sometimes generate slightly invalid Mermaid syntax (e.g., using "interface" keyword incorrectly in class diagrams). The `DiagramRenderer` includes a `cleanMermaidCode` heuristic function:

1.  **Markdown Stripping:** Removes ` ```mermaid ` and ` ``` ` delimiters if the AI includes them in the raw string. This handles variations with spaces and case sensitivity.
2.  **Abstract Classes:** Converts invalid `abstract class X` syntax to valid Mermaid `class X { <<abstract>> }`.
3.  **Interfaces:** Fixes bracket definitions for interfaces.

---

## 4. PDF Report Generation (`utils/pdfGenerator.ts`)

Generating a PDF that matches the web UI requires mapping HTML concepts to PDF primitives using `pdfMake`.

### Challenges & Solutions
*   **Custom Font:** Standard PDF fonts don't support Arabic. We fetch **Cairo** or **Amiri** fonts from a CDN, convert them to Base64 on the fly, and inject them into the PDF Virtual File System (VFS).
*   **LaTeX to Text:** `pdfMake` does not natively support LaTeX. We use a sanitizer (`cleanTextForPdf`) that maps common LaTeX commands to Unicode equivalents:
    *   `\alpha` $\to$ `α`
    *   `\rightarrow` $\to$ `→`
    *   `\frac{a}{b}` $\to$ `(a)/(b)`
