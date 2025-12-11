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
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Heuristic function to clean common LLM Mermaid mistakes
    const cleanMermaidCode = (raw: string): string => {
        let cleaned = raw.trim();

        // Fix: "interface Name {" -> "class Name { <<interface>>"
        // This regex looks for 'interface Word {' pattern and replaces it
        if (cleaned.includes('classDiagram')) {
             cleaned = cleaned.replace(/interface\s+(\w+)\s*\{/g, 'class $1 {\n<<interface>>');
        }

        // Fix: "interface Name" without brackets in classDiagram context if defined separately
        if (cleaned.includes('classDiagram') && !cleaned.includes('<<interface>>')) {
             cleaned = cleaned.replace(/^\s*interface\s+(\w+)\s*$/gm, 'class $1 {\n<<interface>>\n}');
        }

        // Fix: "abstract class Name {" -> "class Name { <<abstract>>"
        // LLMs often write "abstract class Name" which is invalid in Mermaid.
        // We convert it to "class Name { \n <<abstract>>"
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
                // Generate a unique ID for this diagram
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                
                // Initialize if needed
                window.mermaid.initialize({ 
                    startOnLoad: false, 
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
                    securityLevel: 'loose'
                });

                // Clean the code before rendering
                const safeCode = cleanMermaidCode(code);

                // Render the diagram
                const { svg } = await window.mermaid.render(id, safeCode);
                setSvg(svg);
                setError(null);
            } catch (err) {
                console.error("Mermaid Render Error", err);
                setError("Failed to render diagram syntax.");
            }
        };

        renderDiagram();
    }, [code]);

    if (error) {
        return (
            <div className={`p-4 border border-red-500 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-mono rounded ${className}`}>
                <div className="font-bold mb-2">DIAGRAM RENDER ERROR</div>
                <div className="mb-2">{error}</div>
                <details>
                    <summary className="cursor-pointer font-bold opacity-70">View Source Code</summary>
                    <pre className="whitespace-pre-wrap mt-2 opacity-80">{code}</pre>
                </details>
            </div>
        );
    }

    if (!svg) {
        return <div className="text-xs text-gray-500 animate-pulse">Rendering Diagram...</div>;
    }

    return (
        <div 
            className={`w-full overflow-x-auto bg-white dark:bg-[#1a1a1a] p-4 rounded border border-gray-300 dark:border-gray-700 flex justify-center ${className}`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};