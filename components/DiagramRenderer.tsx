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

    const cleanMermaidCode = (raw: string): string => {
        if (!raw) return "";
        let cleaned = raw.trim();
        cleaned = cleaned.replace(/```mermaid/gi, '').replace(/```/g, '').trim();

        // 1. Repair common AI syntax issues (Nested shapes and unquoted labels)
        // Fix A -->|label| B(("Text")) where label has illegal chars
        cleaned = cleaned.split('\n').map(line => {
            let l = line.trim();
            if (!l) return "";
            // Quote box/rounded labels
            l = l.replace(/(\w+)\[([^"\]\s]+(?:\s+[^"\]\s]+)*)\]/g, '$1["$2"]');
            l = l.replace(/(\w+)\(\(([^" \)]+(?:\s+[^" \)]+)*)\)\)/g, '$1(("$2"))');
            // Quote arrow labels
            l = l.replace(/--+>\|([^"\|]+)\|/g, '-->|"$1"|');
            return l;
        }).join('\n');

        const isFlowchart = /^(graph|flowchart)/i.test(cleaned);
        
        if (!isFlowchart && !/^(sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|mindmap)/i.test(cleaned)) {
            cleaned = `graph LR\n${cleaned}`;
        }

        // 2. Safe Styler: Instead of inline ::: which breaks connectors/semicolons, 
        // we use the 'class ID classname' definition at the bottom.
        if (isFlowchart || !/^(sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|mindmap)/i.test(cleaned)) {
            const classDefs = `
  classDef logic fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#0d47a1;
  classDef power fill:#ffebee,stroke:#c62828,stroke-width:3px,color:#b71c1c;
  classDef memory fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#1b5e20;
  classDef mux fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#4a148c;
  classDef decoder fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#bf360c;
  classDef passive fill:#fafafa,stroke:#424242,stroke-width:1px,color:#212121;
            `;

            // Collect all IDs found in the diagram to apply generic classes safely
            const nodeIds = Array.from(new Set(cleaned.match(/\b\w+\b/g) || []));
            const classAssignments: string[] = [];

            nodeIds.forEach(id => {
                if (/Battery|BATT|VCC|Source|Vdd|Vss/i.test(id)) classAssignments.push(`class ${id} power`);
                else if (/Reg|RAM|ROM|PC|Stack|Cache|Memory|D-FF/i.test(id)) classAssignments.push(`class ${id} memory`);
                else if (/AND|OR|XOR|NOT|NAND|NOR|Gate|Flip|FF|Latch/i.test(id)) classAssignments.push(`class ${id} logic`);
                else if (/MUX|DEMUX|Multiplexer/i.test(id)) classAssignments.push(`class ${id} mux`);
                else if (/Decoder|Encoder|3:8|2:4|ALU/i.test(id)) classAssignments.push(`class ${id} decoder`);
                else if (/Resistor|Capacitor|Inductor|R\d|C\d|L\d|Ohm/i.test(id)) classAssignments.push(`class ${id} passive`);
            });

            return cleaned + '\n' + classAssignments.join('\n') + '\n' + classDefs;
        }

        return cleaned;
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
                        useMaxWidth: false
                    }
                });

                const safeCode = cleanMermaidCode(code);
                const { svg: renderedSvg } = await window.mermaid.render(id, safeCode);
                
                const styledSvg = renderedSvg.replace('<style>', `
                    <style>
                        .node rect, .node polygon, .node circle, .node ellipse, .node path {
                            filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.1));
                        }
                        svg { 
                           background-image: radial-gradient(#888 0.3px, transparent 0.3px);
                           background-size: 20px 20px;
                        }
                        .edgePath path { stroke-width: 2.5px !important; }
                        .dark .edgePath path { stroke: #00ff41 !important; }
                        .dark .node rect { fill: #0a0a0a !important; stroke: #00ff41 !important; }
                        .dark .node .label { color: #00ff41 !important; }
                        .dark .label foreignObject { color: #00ff41 !important; }
                `);

                setSvg(styledSvg);
                setError(null);
            } catch (err: any) {
                console.error("Mermaid Render Error:", err);
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
                <div className="font-bold mb-2 flex items-center gap-2 uppercase tracking-tighter">⚠️ Diagram Protocol Fault</div>
                <pre className="bg-black/10 p-2 rounded mb-2 overflow-x-auto whitespace-pre text-[8px] max-h-32">{code}</pre>
                <div className="opacity-70 italic text-[8px]">{error}</div>
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