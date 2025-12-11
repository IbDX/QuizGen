
# 04. Rendering System

The application supports rich media rendering to simulate a real exam environment.

## 1. Markdown & Math (`MarkdownRenderer.tsx`)
Rendering mixed content (Markdown + LaTeX + Code) is difficult, especially with Right-to-Left (Arabic) text.
*   **Pipeline:**
    1.  **Extraction:** We use Regex to pull out Code Blocks and LaTeX Math (`$x^2$`) into placeholders.
    2.  **Sanitization:** The remaining text is HTML-escaped.
    3.  **Markdown:** Simple markdown symbols (bold, italic) are processed.
    4.  **Re-injection:** Math placeholders are injected back into `<span>` tags with `dir="ltr"` and `unicode-bidi: isolate`.
*   **Library:** We use **MathJax 3** for rendering LaTeX. We manually trigger `window.MathJax.typesetPromise` when content changes to ensure dynamic updates without page reloads.

## 2. Digital Graphs (`GraphRenderer.tsx`)
Instead of generating static images of graphs, the AI generates a `GraphConfig` JSON object (e.g., `{ functions: ["x^2", "sin(x)"], domain: [-10, 10] }`).
*   **Library:** `function-plot` (a D3.js wrapper).
*   **Benefit:** This allows the user to hover over the graph, zoom, and pan, providing a truly interactive math experience.

## 3. Diagrams (`DiagramRenderer.tsx`)
For UML, Flowcharts, and Sequences, the AI generates **Mermaid.js** syntax.
*   **Library:** `mermaid`.
*   **Process:** The `DiagramRenderer` takes the code string, renders it to an SVG string using `mermaid.render()`, and injects it into the DOM.
*   **Heuristics:** We include a `cleanMermaidCode` function to fix common LLM syntax errors (e.g., fixing abstract class definitions) before passing them to the renderer.

## 4. Code Editor (`CodeWindow.tsx` & Editor)
*   **Display:** `CodeWindow` uses **PrismJS** for syntax highlighting. It includes a heuristic to detect minified code and "prettify" it by inserting newlines after semicolons/braces.
*   **Input:** The input editor uses `react-simple-code-editor` combined with PrismJS for a lightweight, syntax-highlighted typing experience.
