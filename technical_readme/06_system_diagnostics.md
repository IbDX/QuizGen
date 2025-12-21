
# 06. System Diagnostics & Telemetry

Z+ includes a sophisticated **System Diagnostics** subsystem designed to provide transparency into the application's internal state, performance metrics, and resource consumption. This system is crucial for debugging client-side AI interactions and verifying hardware capabilities.

## 📡 The Telemetry Pipeline

The telemetry system is built around a Singleton service class: `PerformanceMonitor` (`services/monitor.ts`).

```mermaid
graph LR
    App[Application Components] -->|Log Event| Monitor[PerformanceMonitor Class]
    Gemini[Gemini Service] -->|Log Latency/Error| Monitor
    Storage[Library Service] -->|Log Quota| Monitor
    
    Monitor -->|Buffer| MemoryBuffer[Circular Log Buffer]
    Monitor -->|Stats| Aggregates[Running Averages]
    
    Dashboard[PerformanceDashboard UI] -->|Poll (1s)| Monitor
    Dashboard -->|Visualize| User[User Interface]
```

### 1. `PerformanceMonitor` Service

This service acts as a centralized event bus for technical metrics. It tracks:

*   **API_LATENCY:** Time taken for Gemini API calls. Tracks Success/Failure/Rate Limits.
*   **STORAGE_USAGE:** LocalStorage consumption in bytes vs. browser quota.
*   **INTERACTION:** User clicks and navigation events (useful for UX analysis).
*   **RENDER_TIME:** Component render cycles (for heavy components like Graphs).

It maintains a **Circular Buffer** of the last 1000 logs to prevent memory leaks during long sessions.

### 2. Performance Dashboard UI

The `PerformanceDashboard.tsx` component is a complex visualization tool accessible via the Settings menu. It operates in two modes:

#### A. Standard View
Designed for quick checks.
*   **Neural Link Status:** Visualizes API success rate and average latency.
*   **Memory Core:** Bar charts for LocalStorage and JS Heap usage (Chrome only).
*   **Graphics Benchmark:** A built-in stress test that renders 400 dynamic DOM nodes to calculate an FPS score, verifying if the device can handle complex SVG graphs.
*   **Network Uplink:** Displays effective connection type (4G/WiFi) and real-time Ping latency to a CDN.

#### B. Advanced Deep-Dive
Designed for developers and power users.
*   **Subsystem Breakdown:** Categorizes metrics into **NEURAL**, **RENDER**, **MEMORY**, and **KERNEL**.
*   **Live Execution Feed:** A scrolling log of system events using intuitive emojis (🧠 for AI, 💾 for Storage, 🎨 for Render).
*   **Specific Visualizers:**
    *   *Neural:* Token Consumption Sparklines.
    *   *Render:* VRAM Fragmentation Map (Simulated).
    *   *Kernel:* Event Loop Stream.

### 3. Stress Testing Logic

The Dashboard includes a `Stress Test` button. When activated:
1.  It triggers a high-frequency `requestAnimationFrame` loop.
2.  It renders a grid of 400 `div` elements with rapidly changing HSL colors.
3.  It measures the time delta between frames to calculate **FPS** and a **Stability Score**.

This helps users determine if lag is caused by their device or the application.

## 🚦 Error Handling & Quota Detection

The monitoring system is tightly integrated with the app's error handling strategy.

1.  **Detection:** If `monitor.ts` logs an error with a message containing `429` or `Quota`, it increments the `rateLimited` counter.
2.  **Feedback:** The Dashboard's Neural Status indicator turns **Red (Unstable)**.
3.  **Global Alert:** In the main app, if a 429 error bubbles up from `gemini.ts`, the global `SystemStatus` is set to `QUOTA_LIMIT`, changing the header color to red and warning the user to pause.

## 💾 Data Export

Users can export the full telemetry session as a `.json` file from the Dashboard. This export includes:
*   Browser User Agent & Hardware Concurrency.
*   Full event log with timestamps.
*   Aggregated API statistics.
*   Storage usage snapshots.

This is invaluable for debugging issues reported by users in different environments.
