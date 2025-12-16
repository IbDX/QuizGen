
import React, { useEffect, useState } from 'react';

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

        // 1. GLOBAL STRIPPING
        // Remove markdown code blocks
        cleaned = cleaned.replace(/^```\s*mermaid\s*$/gim, '').replace(/^```\s*$/gim, '').trim(); 
        cleaned = cleaned.replace(/```mermaid/gi, '').replace(/```/g, '').trim();

        // 2. TYPE DETECTION & NORMALIZATION
        
        // Fix: "packageDiagram" -> "classDiagram" (Common LLM Hallucination)
        if (/^packageDiagram/i.test(cleaned)) {
            cleaned = cleaned.replace(/^packageDiagram/i, 'classDiagram');
        }

        // Fix: "stateDiagram" -> "stateDiagram-v2" (Better rendering engine)
        if (/^stateDiagram\s*$/im.test(cleaned)) {
            cleaned = cleaned.replace(/^stateDiagram/im, 'stateDiagram-v2');
        }

        // 3. SPECIFIC DIAGRAM FIXES

        // A. CLASS DIAGRAM FIXES
        if (/^classDiagram/i.test(cleaned)) {
             // Replace 'package' with 'namespace' (Mermaid doesn't support 'package' keyword in class diagrams properly)
             cleaned = cleaned.replace(/\bpackage\b/g, 'namespace');

             // Fix: namespace "Name" { -> namespace Name_ {
             // Handle quoted namespaces which cause syntax errors. Replace spaces with underscores inside the name.
             cleaned = cleaned.replace(/namespace\s+"([^"]+)"\s*\{/g, (match, content) => {
                 return `namespace ${content.replace(/\s+/g, '_')} {`;
             });

             // Fix: "interface Name {" -> "class Name { <<interface>>"
             // Detect interface definitions that lack the <<interface>> stereotype usage pattern
             cleaned = cleaned.replace(/^\s*interface\s+(\w+)\s*\{/gm, 'class $1 {\n<<interface>>\n');
             
             // Fix: "interface Name" (standalone)
             cleaned = cleaned.replace(/^\s*interface\s+(\w+)\s*$/gm, 'class $1 {\n<<interface>>\n}');

             // Fix: "abstract class Name {" -> "class Name { <<abstract>>"
             cleaned = cleaned.replace(/^\s*abstract\s+class\s+(\w+)\s*\{/gm, 'class $1 {\n<<abstract>>\n');
             
             // Fix: Relationships using dots "Namespace.Class" -> "Namespace_Class"
             // Mermaid struggles with dots in IDs unless quoted, easiest to flatten.
             cleaned = cleaned.replace(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g, '$1_$2');
             
             // Fix: "class Name : member" -> "Name : member" (The 'class' keyword is implied inside namespace or root)
             cleaned = cleaned.replace(/^\s*class\s+(\w+)\s*:/gm, '$1 :');

             // Fix: Ensure newlines between '}' and next block to prevent "Expecting 'CLASS', got 'STRUCT_STOP'"
             // This happens when LLM outputs "package A {} package B" on one line.
             cleaned = cleaned.replace(/\}\s*(class|namespace|Note)/gi, '}\n$1');
        }

        // B. FLOWCHART / GRAPH FIXES
        if (/^(graph|flowchart)/i.test(cleaned)) {
            // Fix: Quote labels containing special characters to prevent parse errors.
            // Pattern: ID[Text with space] -> ID["Text with space"]
            // We specifically look for unquoted brackets containing spaces or parens.
            
            // 1. Square Brackets: ID[Content]
            // Replace [Unquoted Content] with ["Unquoted Content"] if it contains spaces
            cleaned = cleaned.replace(/\[([^"\]\n]*?\s[^"\]\n]*?)\]/g, '["$1"]');
            
            // 2. Round Brackets: ID(Content)
            cleaned = cleaned.replace(/\(([^"\)\n]*?\s[^"\)\n]*?)\)/g, '("$1")');

            // 3. Mixed quotes fix: sometimes LLMs output ID["Label"] but miss the closing quote or mix them
            // This is harder to regex safely without breaking valid code, relying on 1 & 2 mainly.

            // Inject Layout Config if missing to ensure readability for logic circuits
            if (!cleaned.includes('%%{init')) {
                // stepAfter curve creates cleaner orthogonal lines for logic circuits
                // Increased nodeSpacing and rankSpacing prevents overlapping
                cleaned = `%%{init: {"flowchart": {"curve": "stepAfter", "nodeSpacing": 50, "rankSpacing": 50, "padding": 15}}}%%\n${cleaned}`;
            }
        }

        // C. ER DIAGRAM FIXES
        if (/^erDiagram/i.test(cleaned)) {
            // Process attribute blocks {}
            cleaned = cleaned.replace(/\{([\s\S]*?)\}/g, (match, content) => {
                // 1. Replace commas with newlines (Mermaid ER doesn't support comma separation)
                let safeContent = content.replace(/,/g, '\n');
                
                // 2. Process lines to ensure "Type Name Key" format
                const lines = safeContent.split('\n').filter((l: string) => l.trim().length > 0);
                const processedLines = lines.map((line: string) => {
                    let l = line.trim();
                    // Remove SQL constraints that confuse Mermaid
                    l = l.replace(/NOT NULL/gi, '').replace(/NULL/gi, '').replace(/AUTO_INCREMENT/gi, '').trim();
                    
                    const parts = l.split(/\s+/);
                    
                    // Case: "Name" (1 word) -> "string Name" (Default type)
                    if (parts.length === 1 && parts[0]) return `    string ${parts[0]}`;
                    
                    // Case: "Name PK" (2 words, 2nd is key) -> "string Name PK"
                    if (parts.length === 2 && /^(PK|FK|UK)$/i.test(parts[1])) {
                        return `    string ${parts[0]} ${parts[1]}`;
                    }
                    
                    return `    ${l}`;
                });
                
                return `{\n${processedLines.join('\n')}\n}`;
            });
        }

        // D. SEQUENCE DIAGRAM FIXES
        if (/^sequenceDiagram/i.test(cleaned)) {
            // Ensure autonumber is lowercase if present
            cleaned = cleaned.replace(/^AutoNumber/im, 'autonumber');
        }

        // E. MINDMAP FIXES
        if (/^mindmap/i.test(cleaned)) {
            // Mindmaps rely strictly on indentation. Trimming might have ruined it if not careful.
            // However, the initial .trim() only affects start/end. 
            // We ensure there's a newline after 'mindmap'
            cleaned = cleaned.replace(/^mindmap\s*/i, 'mindmap\n');
        }

        return cleaned;
    };

    useEffect(() => {
        if (!code || !window.mermaid) return;

        const renderDiagram = async () => {
            try {
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                // Initialize with safe defaults, but allow graph-specific overrides via directives
                window.mermaid.initialize({ 
                    startOnLoad: false, 
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
                    securityLevel: 'loose',
                    logLevel: 'error',
                    flowchart: {
                        htmlLabels: true,
                        curve: 'linear', // Default, overridden by init directive for logic gates
                    },
                    er: {
                        useMaxWidth: true,
                    },
                    sequence: {
                        useMaxWidth: true,
                    }
                });

                const safeCode = cleanMermaidCode(code);
                
                if (!safeCode) {
                    throw new Error("Empty diagram code after cleanup.");
                }

                // Mermaid render returns { svg, bindFunctions } in v10+
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
                <div className="mb-2 opacity-80 break-words">{error}</div>
                <details>
                    <summary className="cursor-pointer font-bold opacity-70 hover:opacity-100">View Source Code</summary>
                    <pre className="whitespace-pre-wrap mt-2 p-2 bg-black/5 dark:bg-black/30 rounded border border-black/10 dark:border-white/10 opacity-80 overflow-x-auto">{code}</pre>
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
