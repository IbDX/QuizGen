# 04. Rendering System

Z+ utilizes a high-fidelity rendering pipeline to transform technical data into interactive visuals.

## 🧩 Visual Component Map

| Content Type | Technology | Capability |
| :--- | :--- | :--- |
| **Circuit Schematics** | **Mermaid.js + Custom CSS** | Unique shapes for Logic Gates, MUX, Registers, and Passives. |
| **Logic Architecture** | **Mermaid.js (Stepped)** | Architecture-standard "Step" wiring for Decoders/ALUs. |
| **2D Graphs** | **Function Plot (D3)** | Interactive function plotting with high-contrast terminal styling. |
| **Code Execution** | **PrismJS** | Syntax highlighting for 5+ technical languages. |

---

## 🏗️ Digital Schematic Engine (v2.5)

The upgraded `DiagramRenderer` detects hardware-specific keywords and applies unique styling templates via **Mermaid.js**.

### 🛡️ Schematic Hardening & Auto-Repair
To prevent **Mermaid Syntax Errors** (using version 10.9.0), the system performs:
1.  **Label Escaping:** AI is forced to quote all labels.
2.  **Client-Side Patching:** The renderer scans Mermaid strings and wraps unquoted text containing symbols (`=`, `:`, `-`) in double quotes before execution.
3.  **Theme Adaptation:** Detects the current application theme (Dark/Light) and adjusts the Mermaid theme config (`neutral` vs `dark`) and CSS variables (`stroke`, `fill`) accordingly.

### Shape Mapping Protocol:
*   **Multiplexers (MUX):** Rendered as trapezoids (`[\MUX\]`).
*   **Registers/RAM:** Rendered as database-style cylinders (`[(REG)]`).
*   **Logic Gates:** Hexagonal nodes (`{{AND}}`) with color-coded signal states.
*   **Analog Components:** Resistors, Capacitors, and Batteries use standardized schematic colors (Gray/Red).

---

## 📈 Interactive Math Graphs

For mathematical physics, Z+ generates dynamic D3-based graphs using `function-plot`.

-   **Dynamic Domain:** X and Y axis domains are configured via the JSON from the AI, defaulting to `[-10, 10]`.
-   **Terminal Contrast:** Graphs use specific colors (`#00ff41` for primary functions) to ensure readability against the dark terminal background.
-   **Stroke Thickness:** All plot lines use a 3px stroke to remain legible on mobile devices.
-   **Grid Snap:** Provides a visual aid for "Solve via Graph" questions.
-   **Theme Response:** The `GraphRenderer` listens for theme changes to invert grid lines and background colors (White vs Black) instantly.

---

## 📝 Markdown & Math

All text content is passed through `MarkdownRenderer.tsx`.

*   **MathJax 3:** Used for rendering LaTeX.
*   **RTL Protection:** Arabic text with embedded math formulas often breaks layout engines. We wrap all LaTeX content in `<span dir="ltr" style="unicode-bidi: isolate;">` to ensure formulas read correctly (Left-to-Right) even when the surrounding text is Right-to-Left (Arabic).
