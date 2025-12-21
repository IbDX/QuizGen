import { AppError, ErrorCode } from "../types";

/**
 * MATH CACHE SERVICE
 * 
 * Strategy:
 * 1. Global Font Cache: MathJax is configured with { fontCache: 'global' }.
 *    This ensures glyphs are defined once in <defs> and referenced via <use>, acting as a sprite sheet.
 * 2. Formula Cache: We map LaTeX strings -> SVG HTML Strings.
 *    This avoids running the expensive TeX parser and Layout engine for repeated formulas.
 */

declare global {
    interface Window {
        MathJax: any;
    }
}

// Common expressions to pre-render during app initialization
const COMMON_EXPRESSIONS = [
    "x", "y", "z", "t", 
    "x^2", "y^2", "a^2 + b^2 = c^2",
    "\\int", "\\sum", "\\frac{dy}{dx}", 
    "\\infty", "\\pi", "\\theta", "\\alpha", "\\beta",
    "\\sqrt{x}", "\\frac{1}{2}", "f(x)",
    "\\sin(x)", "\\cos(x)", "\\tan(x)",
    "\\in", "\\forall", "\\exists", "\\to"
];

class MathCacheService {
    private cache: Map<string, string>;
    private isReady: boolean;
    private initPromise: Promise<void> | null;

    constructor() {
        this.cache = new Map();
        this.isReady = false;
        this.initPromise = null;
    }

    /**
     * Ensures MathJax is loaded and ready before we attempt to render.
     */
    private async ensureInit() {
        if (this.isReady) return;
        
        if (!this.initPromise) {
            this.initPromise = new Promise((resolve) => {
                const check = () => {
                    if (window.MathJax && window.MathJax.tex2svgPromise) {
                        this.isReady = true;
                        this.warmup(); // Start background warmup
                        resolve();
                    } else {
                        setTimeout(check, 50);
                    }
                };
                check();
            });
        }
        await this.initPromise;
    }

    /**
     * Pre-renders common math symbols into the cache in the background.
     * This moves the 200ms parsing cost to application load time (or idle time).
     */
    private async warmup() {
        // Run in idle callback to not block main thread interactiveness
        const runWarmup = async () => {
            console.log("🔥 Warming up Math Cache...");
            const start = performance.now();
            for (const latex of COMMON_EXPRESSIONS) {
                await this.getSVG(latex);
            }
            console.log(`✅ Math Cache Warmed: ${COMMON_EXPRESSIONS.length} items in ${(performance.now() - start).toFixed(2)}ms`);
        };

        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(runWarmup);
        } else {
            setTimeout(runWarmup, 1000);
        }
    }

    /**
     * Returns the SVG string for a LaTeX formula.
     * 1. Checks Cache (O(1) lookup).
     * 2. If Miss: Calls MathJax (Expensive).
     * 3. Stores result.
     */
    public async getSVG(latex: string, displayMode: boolean = false): Promise<string> {
        await this.ensureInit();
        
        const key = `${displayMode ? 'D:' : 'I:'}${latex.trim()}`;
        
        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }

        try {
            const options = {
                display: displayMode,
                em: 16,
                ex: 8,
                containerWidth: 80 * 16
            };

            // This is the expensive step (~10-50ms per call depending on complexity)
            const svgElement = await window.MathJax.tex2svgPromise(latex, options);
            const svgString = svgElement.outerHTML;

            this.cache.set(key, svgString);
            return svgString;
        } catch (e) {
            console.warn(`MathJax Failed for: ${latex}`, e);
            // Fallback: Return raw text in error styling
            return `<span class="text-red-500 font-mono text-xs">[Math Error: ${latex}]</span>`;
        }
    }

    /**
     * Synchronous check if we have it (for instant rendering scenarios)
     */
    public has(latex: string, displayMode: boolean = false): boolean {
        const key = `${displayMode ? 'D:' : 'I:'}${latex.trim()}`;
        return this.cache.has(key);
    }
}

export const mathCache = new MathCacheService();