
# 04. Rendering System

Z+ utilizes a high-fidelity rendering pipeline to transform technical data into interactive visuals.

## 🧩 Visual Component Map

| Content Type | Technology | Capability |
| :--- | :--- | :--- |
| **Circuit Schematics** | **Mermaid.js + Custom CSS** | Unique shapes for Logic Gates, MUX, Registers, and Passives. |
| **Logic Logic Architecture** | **Mermaid.js (Stepped)** | Architecture-standard "Step" wiring for Decoders/ALUs. |
| **2D Graphs** | **Function Plot (D3)** | Interactive function plotting with coordinate tracking. |
| **Code Execution** | **PrismJS** | Syntax highlighting for 5+ technical languages. |

---

## 🏗️ Digital Schematic Engine (v2)

The upgraded `DiagramRenderer` detects hardware-specific keywords and applies unique styling templates.

### Shape Mapping Protocol:
*   **Multiplexers (MUX):** Rendered as trapezoids (`[\MUX\]`).
*   **Registers/RAM:** Rendered as database-style cylinders (`[(REG)]`).
*   **Logic Gates:** Hexagonal nodes (`{{AND}}`) with color-coded signal states.
*   **Analog Components:** Resistors, Capacitors, and Batteries use standardized schematic colors (Gray/Red).

### Interaction:
-   **Architecture Pan:** Click and drag to explore wide CPU-level diagrams.
-   **Signal Zoom:** Hold `Ctrl` and scroll to inspect specific logic gate inputs.

---

## 📈 Interactive Math Graphs

For mathematical physics, Z+ generates dynamic D3-based graphs.
-   **Domains:** Automatically scaled based on the function provided by the AI.
-   **Grid Snap:** Provides a visual aid for "Solve via Graph" questions.
