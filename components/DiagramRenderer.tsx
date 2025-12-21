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
    const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });
    const viewportRef = useRef<HTMLDivElement>(null);

    const cleanMermaidCode = (raw: string): string => {
        if (!raw) return "";
        let cleaned = raw.trim();
        cleaned = cleaned.replace(/```mermaid/gi, '').replace(/```/g, '').trim();

        if (!/^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|mindmap)/i.test(cleaned)) {
            cleaned = `graph LR\n${cleaned}`;
        }

        const classDefs = `
  classDef logic fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#0d47a1;
  classDef power fill:#ffebee,stroke:#c62828,stroke-width:3px,color:#b71c1c;
  classDef memory fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#1b5e20;
  classDef mux fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#4a148c;
  classDef decoder fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#bf360c;
  classDef passive fill:#fafafa,stroke:#424242,stroke-width:1px,color:#212121;
        `;

        const lines = cleaned.split('\n');
        const enrichedLines = lines.map(line => {
            if (/AND|OR|XOR|NOT|NAND|NOR|Gate/i.test(line)) line += ':::logic';
            if (/MUX|DEMUX|Multiplexer/i.test(line)) line += ':::mux';
            if (/Decoder|Encoder|3:8|2:4/i.test(line)) line += ':::decoder';
            if (/Reg|RAM|ROM|PC|Stack|Cache|Memory/i.test(line)) line += ':::memory';
            if (/Battery|BATT|VCC|Source|Vdd|Vss/i.test(line)) line += ':::power';
            if (/Resistor|Capacitor|Inductor|R\d|C\d|L\d/i.test(line)) line += ':::passive';
            return line;
        });

        return enrichedLines.join('\n') + '\n' + classDefs;
    };

    useEffect(() => {
        if (!code || !window.mermaid) return;

        const renderDiagram = async () => {
            try {
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                window.mermaid.initialize({ 
                    startOnLoad: false, 
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral',
                    securityLevel: 'loose',
                    flowchart: {
                        curve: 'stepBefore',
                        padding: 30,
                        nodeSpacing: 60,
                        rankSpacing: 60,
                        useMaxWidth: false
                    }
                });

                const safeCode = cleanMermaidCode(code);
                const { svg: renderedSvg } = await window.mermaid.render(id, safeCode);
                
                const styledSvg = renderedSvg.replace('<style>', `
                    <style>
                        .node rect, .node polygon, .node circle, .node ellipse, .node path {
                            filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.15));
                        }
                        /* Custom symbols for electronics */
                        .passive rect { rx: 0; ry: 0; }
                        .power circle { stroke-dasharray: 4; }
                        svg { 
                           background-image: radial-gradient(#666 0.4px, transparent 0.4px);
                           background-size: 25px 25px;
                           background-color: transparent;
                        }
                        .edgePath path { stroke-width: 2px !important; }
                        .dark .edgePath path { stroke: #00ff41 !important; }
                        .dark .node rect { fill: #0a0a0a !important; stroke: #00ff41 !important; }
                        .dark .node .label { color: #00ff41 !important; }
                `);

                setSvg(styledSvg);
                setError(null);
            } catch (err: any) {
                setError(err.message || "Diagram syntax error.");
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
            <div className={`p-4 border border-red-500 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 text-xs font-mono rounded ${className}`}>
                <div className="font-bold mb-1 uppercase tracking-tighter">Diagram Protocol Error</div>
                <pre className="whitespace-pre-wrap opacity-80">{code}</pre>
            </div>
        );
    }

    return (
        <div className={`relative w-full border-2 border-gray-300 dark:border-terminal-green/30 rounded-xl overflow-hidden bg-gray-50 dark:bg-[#080808] shadow-2xl ${className}`} style={{ minHeight: '400px' }}>
            <div className="absolute top-0 left-0 w-full h-10 bg-white/60 dark:bg-black/40 backdrop-blur-lg border-b dark:border-terminal-green/20 flex items-center justify-between px-4 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-terminal-green shadow-[0_0_8px_#00ff41]"></div>
                    <span className="text-[10px] font-bold font-mono text-gray-500 dark:text-terminal-green uppercase tracking-widest">Visual Analysis Core</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleZoomIn} className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-terminal-green/10 rounded-full text-gray-500 dark:text-terminal-green transition-all">+</button>
                    <button onClick={handleZoomOut} className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-terminal-green/10 rounded-full text-gray-500 dark:text-terminal-green transition-all">-</button>
                    <button onClick={handleReset} className="px-2 h-7 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-terminal-green/10 rounded text-gray-500 dark:text-terminal-green text-[9px] font-bold">RESET</button>
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
                        transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0,0,0.2,1)',
                        transformOrigin: 'center center',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: '40px'
                    }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            </div>
            
            <div className="absolute bottom-3 right-4 text-[9px] font-bold font-mono text-gray-400 dark:text-terminal-green/40 pointer-events-none uppercase tracking-widest">
                Schematic v2.4 // Active
            </div>
        </div>
    );
};