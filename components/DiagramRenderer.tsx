
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
    
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ startX: 0, startY: 0, posX: position.x, posY: position.y });
    const viewportRef = useRef<HTMLDivElement>(null);

    /**
     * Advanced Mermaid Syntax Repair Engine
     * Fixes common AI hallucinations without requiring a re-generation call.
     */
    const repairMermaidSyntax = (raw: string): string => {
        if (!raw) return "";
        let lines = raw
            .replace(/```mermaid/gi, '')
            .replace(/```/g, '')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);

        // 1. Detect Diagram Type (Default to graph LR if missing)
        const isFlowchart = lines.some(l => /^(graph|flowchart)/i.test(l));
        const isSequence = lines.some(l => /^sequenceDiagram/i.test(l));
        const isClass = lines.some(l => /^classDiagram/i.test(l));
        const isKnownType = isFlowchart || isSequence || isClass || lines.some(l => /^(erDiagram|stateDiagram|gantt|pie|mindmap)/i.test(l));

        if (!isKnownType) {
            // Heuristic: If it looks like nodes/edges, treat as flowchart
            if (lines.some(l => l.includes('-->') || l.includes('->'))) {
                lines.unshift('graph LR');
            }
        }

        // Processing Logic varies by diagram type
        const processedLines = lines.map(line => {
            let cleanLine = line;

            if (isFlowchart || !isKnownType) {
                // A. Fix Invalid Node IDs with spaces: "Node One[Label]" -> "Node_One[Label]"
                // Only matches if it looks like a definition line
                if (/^[a-zA-Z0-9]+\s+[a-zA-Z0-9]+\s*[\[\(\{\<]/.test(cleanLine)) {
                    cleanLine = cleanLine.replace(/^([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+)(\s*[\[\(\{\<])/, '$1_$2$3');
                }

                // B. Auto-Quote Unquoted Labels (Crucial for AI output)
                // Fixes: A[User: Login] -> A["User: Login"]
                // Matches ID followed by bracket, capture content, ensure it's not already quoted
                const shapeRegex = /^([a-zA-Z0-9_]+)(\s*)([\[\(\{\<]+)(?!")(.+?)(?!")([\]\)\}\>]+)(\s*.*)$/;
                const match = cleanLine.match(shapeRegex);
                
                if (match) {
                    const [full, id, space, open, content, close, rest] = match;
                    
                    // Check if content needs quoting (has spaces or special chars)
                    // and isn't a subgraph or specific keyword
                    if (/[:,\-\(\)\{\}\[\]]/.test(content) || (content.includes(' ') && !content.startsWith('"'))) {
                        // Correct bracket mismatches if necessary (e.g. A[Text) -> A[Text])
                        let safeClose = close;
                        if(open.includes('[') && !close.includes(']')) safeClose = ']';
                        if(open.includes('(') && !close.includes(')')) safeClose = ')';
                        if(open.includes('{') && !close.includes('}')) safeClose = '}';
                        
                        cleanLine = `${id}${space}${open}"${content.replace(/"/g, "'")}"${safeClose}${rest}`;
                    }
                }

                // C. Fix Broken Edge Labels
                // Fixes: -->|Text with : chars| -> -->|"Text with : chars"|
                if (cleanLine.includes('|')) {
                    cleanLine = cleanLine.replace(/(--+|==+)\|([^"\|]+)\|/g, (m, arrow, label) => {
                        return `${arrow}|"${label.replace(/"/g, "'")}"|`;
                    });
                }
            }

            return cleanLine;
        });

        // 3. Append Styling Classes safely
        if (isFlowchart || !isKnownType) {
            const classDefs = `
classDef logic fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#0d47a1;
classDef power fill:#ffebee,stroke:#c62828,stroke-width:3px,color:#b71c1c;
classDef memory fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#1b5e20;
classDef mux fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#4a148c;
classDef passive fill:#fafafa,stroke:#424242,stroke-width:1px,color:#212121;
            `.trim();

            const fullText = processedLines.join('\n');
            const nodeIds = Array.from(new Set(fullText.match(/^\s*([a-zA-Z0-9_]+)[\[\(\{\<]/gm)?.map(s => s.split(/[\[\(\{\<]/)[0].trim()) || []));
            const classAssignments: string[] = [];

            nodeIds.forEach(id => {
                // Determine class based on ID conventions or Label content
                // We grep the line defining this ID to check its label content
                const defLine = processedLines.find(l => l.startsWith(id));
                const content = defLine ? defLine.toLowerCase() : id.toLowerCase();

                if (/battery|vcc|gnd|source|power/.test(content)) classAssignments.push(`class ${id} power`);
                else if (/reg|ram|rom|memory|cache/.test(content)) classAssignments.push(`class ${id} memory`);
                else if (/and|or|xor|not|nand|gate/.test(content)) classAssignments.push(`class ${id} logic`);
                else if (/mux|demux/.test(content)) classAssignments.push(`class ${id} mux`);
                else if (/resistor|capacitor|inductor/.test(content)) classAssignments.push(`class ${id} passive`);
            });

            if (classAssignments.length > 0) {
                return processedLines.join('\n') + '\n' + classAssignments.join('\n') + '\n' + classDefs;
            }
        }

        return processedLines.join('\n');
    };

    useEffect(() => {
        if (!code || !window.mermaid) return;

        const renderDiagram = async () => {
            try {
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const isDark = document.documentElement.classList.contains('dark');
                
                window.mermaid.initialize({ 
                    startOnLoad: false, 
                    theme: isDark ? 'dark' : 'neutral',
                    securityLevel: 'loose',
                    fontFamily: 'Fira Code, monospace',
                    flowchart: {
                        curve: 'stepBefore',
                        padding: 20,
                        useMaxWidth: false,
                        htmlLabels: true
                    }
                });

                const safeCode = repairMermaidSyntax(code);
                
                // Attempt Render
                const { svg: renderedSvg } = await window.mermaid.render(id, safeCode);
                
                // Post-Process SVG for Theme Consistency
                const styledSvg = renderedSvg.replace('<style>', `
                    <style>
                        .node rect, .node polygon, .node circle, .node ellipse, .node path {
                            filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.1));
                        }
                        svg { 
                           background-image: radial-gradient(#888 0.3px, transparent 0.3px);
                           background-size: 20px 20px;
                        }
                        /* Hardware Schematic Colors */
                        .dark .edgePath path { stroke: #00ff41 !important; }
                        .dark .node rect, .dark .node polygon { fill: #0a0a0a !important; stroke: #00ff41 !important; }
                        .dark .node .label { color: #00ff41 !important; fill: #00ff41 !important; }
                        .dark .label foreignObject { color: #00ff41 !important; }
                        .dark .marker { fill: #00ff41 !important; stroke: #00ff41 !important; }
                `);

                setSvg(styledSvg);
                setError(null);
            } catch (err: any) {
                console.error("Mermaid Render Error:", err);
                console.debug("Failed Code:", code);
                setError(err.message || "Logic Rendering Violation.");
            }
        };

        renderDiagram();
    }, [code]);

    const handleZoomIn = () => setScale(s => Math.min(s * 1.2, 5));
    const handleZoomOut = () => setScale(s => Math.max(s / 1.2, 0.2));
    const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = { startX: e.clientX, startY: e.clientY, posX: position.x, posY: position.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;
        setPosition({ x: dragStartRef.current.posX + dx, y: dragStartRef.current.posY + dy });
    };

    if (error) {
        return (
            <div className={`p-4 border border-red-500 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 text-[10px] font-mono rounded-lg ${className}`}>
                <div className="font-bold mb-2 flex items-center gap-2 uppercase tracking-tighter">
                    <span>⚠️</span> Diagram Protocol Fault
                </div>
                <div className="mb-2 opacity-80">The generated schematic contained syntax errors. Raw output displayed:</div>
                <pre className="bg-black/10 dark:bg-black/50 p-2 rounded mb-2 overflow-x-auto whitespace-pre text-[8px] max-h-32 border border-red-500/30">
                    {code}
                </pre>
                <div className="opacity-70 italic text-[8px] border-t border-red-500/20 pt-1 mt-1">{error}</div>
            </div>
        );
    }

    return (
        <div className={`relative w-full border-2 border-gray-300 dark:border-terminal-green/40 rounded-xl overflow-hidden bg-gray-50 dark:bg-[#080808] shadow-lg ${className}`} style={{ minHeight: '350px' }}>
            <div className="absolute top-0 left-0 w-full h-8 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b dark:border-terminal-green/20 flex items-center justify-between px-3 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-terminal-green shadow-[0_0_5px_#00ff41]"></div>
                    <span className="text-[9px] font-bold font-mono text-gray-500 dark:text-terminal-green tracking-widest uppercase">Schematic Core</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleZoomIn} className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-terminal-green/10 rounded-full text-gray-500 dark:text-terminal-green">+</button>
                    <button onClick={handleZoomOut} className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-terminal-green/10 rounded-full text-gray-500 dark:text-terminal-green">-</button>
                    <button onClick={handleReset} className="px-2 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-terminal-green/10 rounded text-gray-500 dark:text-terminal-green text-[8px] font-bold uppercase">Reset</button>
                </div>
            </div>

            <div
                ref={viewportRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
            >
                <div
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0,0,0.2,1)',
                        transformOrigin: 'center center',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: '30px'
                    }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            </div>
            
            <div className="absolute bottom-2 right-3 text-[8px] font-bold font-mono text-gray-400 dark:text-terminal-green/30 pointer-events-none uppercase">
                Render V2.8 // Hardened
            </div>
        </div>
    );
};
