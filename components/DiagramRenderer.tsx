
import React, { useEffect, useRef, useState } from 'react';

interface DiagramRendererProps {
    code: string;
    className?: string;
}

declare global {
    interface Window {
        mermaid: any;
    }
}

export const DiagramRenderer: React.FC<DiagramRendererProps> = ({ code, className = "" }) => {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Heuristic function to clean common LLM Mermaid mistakes
    const cleanMermaidCode = (raw: string): string => {
        if (!raw) return "";
        let cleaned = raw.trim();

        // 1. Remove markdown code blocks if the AI wrapped them in ```mermaid ... ```
        cleaned = cleaned.replace(/```mermaid/gi, '').replace(/```/g, '').trim();

        // 2. Fix: "interface Name {" -> "class Name { <<interface>>"
        if (cleaned.includes('classDiagram')) {
             cleaned = cleaned.replace(/interface\s+(\w+)\s*\{/g, 'class $1 {\n<<interface>>');
        }

        // 3. Fix: "interface Name" without brackets in classDiagram context if defined separately
        if (cleaned.includes('classDiagram') && !cleaned.includes('<<interface>>')) {
             cleaned = cleaned.replace(/^\s*interface\s+(\w+)\s*$/gm, 'class $1 {\n<<interface>>\n}');
        }

        // 4. Fix: "abstract class Name {" -> "class Name { <<abstract>>"
        // LLMs often write "abstract class Name" which is invalid in Mermaid.
        if (cleaned.includes('classDiagram')) {
             cleaned = cleaned.replace(/^\s*abstract\s+class\s+(\w+)\s*\{/gm, 'class $1 {\n<<abstract>>');
             // Also handle single line definition if exists
             cleaned = cleaned.replace(/^\s*abstract\s+class\s+(\w+)\s*$/gm, 'class $1 {\n<<abstract>>\n}');
        }

        return cleaned;
    };

    useEffect(() => {
        if (!code || !window.mermaid) return;

        const renderDiagram = async () => {
            try {
                // Generate a unique ID for this diagram to prevent conflicts in DOM
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                // Initialize if needed
                window.mermaid.initialize({ 
                    startOnLoad: false, 
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
                    securityLevel: 'loose',
                    logLevel: 'error', // Reduce console noise
                });

                // Clean the code before rendering
                const safeCode = cleanMermaidCode(code);
                
                if (!safeCode) {
                    throw new Error("Empty diagram code after cleanup.");
                }

                // Render the diagram
                // mermaid.render returns an object { svg } in v10+
                const { svg } = await window.mermaid.render(id, safeCode);
                setSvg(svg);
                setError(null);
            } catch (err: any) {
                console.warn("Mermaid Render Warning:", err);
                setError(err.message || "Syntax error in diagram definition.");
            }
        };

        renderDiagram();
    }, [code]);

    if (error) {
        return (
            <div className={`p-4 border border-red-500 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-mono rounded ${className}`}>
                <div className="font-bold mb-2 flex items-center gap-2">
                    <span>⚠️</span> DIAGRAM RENDER ERROR
                </div>
                <div className="mb-2 opacity-80">{error}</div>
                <details>
                    <summary className="cursor-pointer font-bold opacity-70 hover:opacity-100">View Source Code</summary>
                    <pre className="whitespace-pre-wrap mt-2 p-2 bg-black/5 dark:bg-black/30 rounded border border-black/10 dark:border-white/10 opacity-80">{code}</pre>
                </details>
            </div>
        );
    }

    if (!svg) {
        return (
            <div className={`w-full h-32 flex items-center justify-center bg-gray-50 dark:bg-[#1a1a1a] rounded border border-dashed border-gray-300 dark:border-gray-700 ${className}`}>
                <div className="text-xs text-gray-400 animate-pulse flex flex-col items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Generating Diagram...
                </div>
            </div>
        );
    }

    return (
        <div 
            className={`w-full overflow-x-auto bg-white dark:bg-[#1a1a1a] p-4 rounded border border-gray-300 dark:border-gray-700 flex justify-center ${className}`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};
