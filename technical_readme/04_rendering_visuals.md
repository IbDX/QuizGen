
# 04. Rendering System

Z+ utilizes a high-fidelity rendering pipeline to transform technical data into interactive visuals.

## 🧩 Visual Component Map

| Content Type | Technology | Capability |
| :--- | :--- | :--- |
| **Circuit Schematics** | **Mermaid.js + Custom CSS** | Unique shapes for Logic Gates, MUX, Registers, and Passives. |
| **Logic Logic Architecture** | **Mermaid.js (Stepped)** | Architecture-standard "Step" wiring for Decoders/ALUs. |
| **2D Graphs** | **Function Plot (D3)** | Interactive function plotting with high-contrast terminal styling. |
| **Code Execution** | **PrismJS** | Syntax highlighting for 5+ technical languages. |

---

## 🏗️ Digital Schematic Engine (v2.5)

The upgraded `DiagramRenderer` detects hardware-specific keywords and applies unique styling templates.

### 🛡️ Schematic Hardening & Auto-Repair
To prevent **Mermaid Syntax Errors** (version 10.9.0), the system now performs:
1.  **Label Escaping:** AI is forced to quote all labels.
2.  **Client-Side Patching:** The renderer scans Mermaid strings and wraps unquoted text containing symbols (`=`, `:`, `-`) in double quotes before execution.

### Shape Mapping Protocol:
*   **Multiplexers (MUX):** Rendered as trapezoids (`[\MUX\]`).
*   **Registers/RAM:** Rendered as database-style cylinders (`[(REG)]`).
*   **Logic Gates:** Hexagonal nodes (`{{AND}}`) with color-coded signal states.
*   **Analog Components:** Resistors, Capacitors, and Batteries use standardized schematic colors (Gray/Red).

---

## 📈 Interactive Math Graphs

For mathematical physics, Z+ generates dynamic D3-based graphs.
-   **Terminal Contrast:** Graphs use `#00ff41` (Green) and `#ff3333` (Red) to ensure readability in dark mode.
-   **Stroke Thickness:** All plot lines use a 3px stroke to remain legible on mobile devices.
-   **Grid Snap:** Provides a visual aid for "Solve via Graph" questions.
