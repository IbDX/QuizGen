
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
    
    // State for zoom and pan
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });
    const viewportRef = useRef<HTMLDivElement>(null);

    // Heuristic function to clean common LLM Mermaid mistakes
    const cleanMermaidCode = (raw: string): string => {
        if (!raw) return "";
        let cleaned = raw.trim();

        // 1. Remove markdown code blocks
        cleaned = cleaned.replace(/^```\s*mermaid\s*$/gim, '').replace(/^```\s*$/gim, '').trim(); 
        cleaned = cleaned.replace(/```mermaid/gi, '').replace(/```/g, '').trim();

        // 2. Locate start of diagram
        const diagramTypes = ['classDiagram', 'graph', 'sequenceDiagram', 'erDiagram', 'stateDiagram', 'gantt', 'pie', 'flowchart', 'mindmap', 'logicDiagram'];
        let startIndex = -1;
        
        for (const type of diagramTypes) {
            const match = new RegExp(`(^|\\n)\\s*${type}\\b`, 'i').exec(cleaned);
            if (match) {
                const keywordIndex = match.index + match[1].length;
                if (startIndex === -1 || keywordIndex < startIndex) {
                    startIndex = keywordIndex;
                }
            }
        }

        if (startIndex !== -1) {
            cleaned = cleaned.substring(startIndex).trim();
        }

        // Fix invalid diagram types
        cleaned = cleaned.replace(/^\s*logicDiagram/i, 'graph TD');

        // CIRCUIT SCHEMATIC THEMING (Custom CSS Injection for Mermaid)
        const isCircuit = /Resistor|Capacitor|Inductor|Voltage|Current|Ohm|Gate/i.test(cleaned);
        
        if (isCircuit && /graph/i.test(cleaned)) {
            // Apply schematic styling to specific node types
            cleaned += '\n  classDef resistor fill:#fff,stroke:#000,stroke-width:2px,rx:2,ry:2;';
            cleaned += '\n  classDef source fill:#fef,stroke:#909,stroke-width:2px;';
            cleaned += '\n  classDef gate fill:#eef,stroke:#00a,stroke-width:2px;';
            cleaned += '\n  classDef ground fill:#333,stroke:#333,stroke-width:4px;';
            
            // Assign classes based on labels
            cleaned = cleaned.replace(/(\w+)\[Resistor:[^\]]+\]/gi, '$1["$1<br/>Resistor"]:::resistor');
            cleaned = cleaned.replace(/(\w+)\[Voltage:[^\]]+\]/gi, '$1["$1<br/>Source"]:::source');
            cleaned = cleaned.replace(/(\w+)\[Gate:[^\]]+\]/gi, '$1["$1<br/>Gate"]:::gate');
            cleaned = cleaned.replace(/(\w+)\[Ground\]/gi, '$1["⏚ Ground"]:::ground');
        }

        return cleaned;
    };

    useEffect(() => {
        if (!code || !window.mermaid) return;

        const renderDiagram = async () => {
            try {
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                window.mermaid.initialize({ 
                    startOnLoad: false, 
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
                    securityLevel: 'loose',
                    logLevel: 'error',
                    flowchart: {
                        curve: 'basis',
                        padding: 20
                    }
                });

                const safeCode = cleanMermaidCode(code);
                
                if (!safeCode) {
                    throw new Error("Empty diagram code after cleanup.");
                }

                const { svg } = await window.mermaid.render(id, safeCode);
                setSvg(svg);
                setError(null);
                handleReset(); // Reset view when code changes
            } catch (err: any) {
                console.warn("Mermaid Render Warning:", err);
                setError(err.message || "Syntax error in diagram definition.");
            }
        };

        renderDiagram();
    }, [code]);

    // Zoom and Pan handlers
    const handleZoomIn = () => setScale(s => Math.min(s * 1.25, 4));
    const handleZoomOut = () => setScale(s => Math.max(s / 1.25, 0.2));
    const handleReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            posX: position.x,
            posY: position.y,
        };
        if(viewportRef.current) viewportRef.current.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;
        setPosition({
            x: dragStartRef.current.posX + dx,
            y: dragStartRef.current.posY + dy,
        });
    };

    const handleMouseUpOrLeave = () => {
        setIsDragging(false);
        if(viewportRef.current) viewportRef.current.style.cursor = 'grab';
    };
    
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) handleZoomIn();
            else handleZoomOut();
        }
    };

    if (error) {
        return (
            <div className={`p-4 border border-red-500 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-mono rounded ${className}`}>
                <div className="font-bold mb-2 flex items-center gap-2">
                    <span>⚠️</span> SCHEMATIC RENDER ERROR
                </div>
                <div className="mb-2 opacity-80">{error}</div>
                <details>
                    <summary className="cursor-pointer font-bold opacity-70 hover:opacity-100">View Diagram Source</summary>
                    <pre className="whitespace-pre-wrap mt-2 p-2 bg-black/5 dark:bg-black/30 rounded border border-black/10 dark:border-white/10 opacity-80">{code}</pre>
                </details>
            </div>
        );
    }

    if (!svg) {
        return (
            <div className={`w-full h-48 flex items-center justify-center bg-gray-50 dark:bg-[#1a1a1a] rounded border border-dashed border-gray-300 dark:border-gray-700 ${className}`}>
                <div className="text-xs text-gray-400 animate-pulse flex flex-col items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Initializing Viewer...
                </div>
            </div>
        );
    }

    return (
        <div 
            className={`relative w-full overflow-hidden bg-white dark:bg-[#111] p-0 rounded-lg border border-gray-300 dark:border-terminal-green/30 flex justify-center items-center shadow-inner ${className}`}
            style={{ minHeight: '300px' }}
        >
            <div className="absolute top-0 left-0 w-full h-6 bg-gray-100 dark:bg-black/40 border-b dark:border-terminal-green/20 flex items-center px-3 z-10">
                <span className="text-[9px] font-bold font-mono text-gray-500 uppercase tracking-widest">Digital Schematic Viewer</span>
            </div>

            {/* Controls */}
            <div className="absolute top-8 right-2 z-10 flex flex-col items-end gap-1 pointer-events-none">
                <div className="flex items-center gap-1 bg-white/90 dark:bg-black/90 border border-gray-300 dark:border-terminal-green/40 rounded-md p-1 backdrop-blur-sm shadow-md pointer-events-auto">
                    <button onClick={handleZoomIn} title="Zoom In" className="w-7 h-7 flex items-center justify-center text-lg font-bold text-gray-600 dark:text-terminal-green hover:bg-gray-100 dark:hover:bg-terminal-green/10 rounded transition-colors">+</button>
                    <button onClick={handleZoomOut} title="Zoom Out" className="w-7 h-7 flex items-center justify-center text-lg font-bold text-gray-600 dark:text-terminal-green hover:bg-gray-100 dark:hover:bg-terminal-green/10 rounded transition-colors">-</button>
                    <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                    <button onClick={handleReset} title="Reset View" className="w-7 h-7 flex items-center justify-center text-gray-600 dark:text-terminal-green hover:bg-gray-100 dark:hover:bg-terminal-green/10 rounded transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 4l16 16" /></svg>
                    </button>
                </div>
            </div>

            {/* Viewport */}
            <div
                ref={viewportRef}
                className="w-full h-full cursor-grab pt-6"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onWheel={handleWheel}
            >
                <div
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        transformOrigin: 'center center',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            </div>
        </div>
    );
};
