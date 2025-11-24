import React, { useEffect, useRef } from 'react';
import { GraphConfig } from '../types';

declare global {
    interface Window {
        JXG: any;
    }
}

interface GraphRendererProps {
    config: GraphConfig;
}

export const GraphRenderer: React.FC<GraphRendererProps> = ({ config }) => {
    const boxRef = useRef<HTMLDivElement>(null);
    const boardId = useRef(`jxgbox-${Math.random().toString(36).substr(2, 9)}`);
    const boardRef = useRef<any>(null);

    useEffect(() => {
        if (!window.JXG || !boxRef.current) return;

        // Cleanup previous if exists (though usually handled by unmount)
        if (boardRef.current) {
            window.JXG.JSXGraph.freeBoard(boardRef.current);
        }

        // Configure Dimensions
        const xMin = config.domain?.[0] ?? -10;
        const xMax = config.domain?.[1] ?? 10;
        const yMin = config.range?.[0] ?? -10;
        const yMax = config.range?.[1] ?? 10;

        // Init Board
        const board = window.JXG.JSXGraph.initBoard(boardId.current, { 
            boundingbox: [xMin, yMax, xMax, yMin], 
            axis: true,
            showCopyright: false,
            pan: { enabled: true, needShift: false },
            zoom: { enabled: true, needShift: false },
            defaultAxes: {
                x: { name: config.xAxisLabel || 'x', withLabel: true, label: { position: 'rt', offset: [-10, 10] } },
                y: { name: config.yAxisLabel || 'y', withLabel: true, label: { position: 'rt', offset: [10, -10] } }
            }
        });

        boardRef.current = board;

        // Plot Functions
        if (config.functions) {
            config.functions.forEach((fnStr, i) => {
                try {
                    // Sanitize/Prepare Function
                    // Supports 'sin(x)', 'x**2' via local scope destructuring of Math properties
                    // Replaces '^' with '**' just in case AI outputs LaTeX style
                    const cleanFn = fnStr.replace(/\^/g, '**');
                    
                    const f = new Function('x', `
                        const { sin, cos, tan, asin, acos, atan, atan2, pow, sqrt, abs, exp, log, PI, E, floor, ceil, round } = Math;
                        try {
                            return ${cleanFn}; 
                        } catch(e) { return 0; }
                    `);

                    board.create('functiongraph', [f], { 
                        strokeColor: i === 0 ? '#2563eb' : (i === 1 ? '#dc2626' : '#10b981'),
                        strokeWidth: 3 
                    });
                } catch (e) {
                    console.error("Graph Error:", fnStr, e);
                }
            });
        }

        // Optional Title (JSXGraph handles labels better via axes, but we can add text)
        if (config.title) {
            board.create('text', [xMin + (xMax-xMin)*0.05, yMax - (yMax-yMin)*0.05, config.title], { 
                fontSize: 16, 
                cssClass: 'fill-black dark:fill-white font-bold' 
            });
        }

        return () => {
             if (boardRef.current) window.JXG.JSXGraph.freeBoard(boardRef.current);
        };
    }, [config]);

    return (
        <div className="w-full bg-white rounded border border-gray-300 dark:border-terminal-gray overflow-hidden mb-4 relative">
             <div 
                ref={boxRef}
                id={boardId.current} 
                className="w-full h-[400px]"
            />
        </div>
    );
};