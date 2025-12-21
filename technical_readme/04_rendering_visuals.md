
# 04. Rendering System

Z+ moves beyond static text by implementing a rich, dynamic rendering engine. This allows for interactive graphs, syntax-highlighted code, and complex technical notation.

## 🧩 Render Component Map

| Content Type | Data Source | Component | Library |
| :--- | :--- | :--- | :--- |
| **Rich Text** | `question.text` | `MarkdownRenderer.tsx` | Custom Parsing |
| **Math / LaTeX** | `$E=mc^2$` | `MarkdownRenderer.tsx` | **MathJax 3** |
| **Schematics** | `question.diagramConfig`| `DiagramRenderer.tsx` | **Mermaid.js** (Circuit Theme) |
| **Code Block** | `question.codeSnippet` | `CodeWindow.tsx` | **PrismJS** |
| **Graphs** | `question.graphConfig` | `GraphRenderer.tsx` | **Function Plot** (D3) |

---

## 1. Markdown & Math (`MarkdownRenderer.tsx`)

### Physics Formatting Protocol
To ensure units like $V$ (Volts), $\Omega$ (Ohms), and $A$ (Amperes) render correctly:
1.  **AI Delimiters:** The generation engine is instructed to wrap every unit and technical value in single dollar signs (`$`).
2.  **RTL Math Fix:** For Arabic UI, math is wrapped in a `<span dir="ltr">` with `unicode-bidi: isolate`. This prevents the "order reversal" bug where $4\,V$ might display as $V\,4$.

---

## 2. Digital Schematic Viewer (`DiagramRenderer.tsx`)

For Physics and Electronics exams, the system identifies circuit-related keywords and triggers a specialized visual layer.

### Schematic Interpretation
When `DiagramRenderer` detects circuit components in the Mermaid code, it injects custom CSS classes:
*   **Resistors:** Styled as distinct blocks with bold borders and high contrast.
*   **Sources:** Circular nodes with color coding for voltage/current sources.
*   **Ground:** Specialized "symbol" node.
*   **Logic Gates:** Logic gate labels (AND, OR, NOT) are highlighted in blue tones to distinguish them from wiring.

### User Interaction
*   **Dynamic Zoom:** Use the mouse wheel while holding `Ctrl` to zoom into complex circuit wiring.
*   **Tactical Pan:** Click and drag to navigate large schematic diagrams.

---

## 3. Interactive Graphs (`GraphRenderer.tsx`)

Instead of static images, Z+ renders interactive graphs for mathematical physics.
*   **interactivity:** Users can hover to see $(x,y)$ coordinates, which is essential for "Find the slope" or "Identify the intercept" questions.
