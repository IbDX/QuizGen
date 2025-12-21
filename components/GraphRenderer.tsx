
import React, { useEffect, useRef } from 'react';
import { GraphConfig } from '../types';

declare global {
    interface Window {
        functionPlot: any;
    }
}

interface GraphRendererProps {
    config: GraphConfig;
}

export const GraphRenderer: React.FC<GraphRendererProps> = ({ config }) => {
    const rootEl = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!rootEl.current || !window.functionPlot) return;

        try {
            const width = rootEl.current.clientWidth;
            const height = Math.min(width * 0.7, 450);
            
            rootEl.current.innerHTML = "";

            const isDark = document.documentElement.classList.contains('dark');
            const primaryColor = isDark ? '#00ff41' : '#2563eb';
            const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

            window.functionPlot({
                target: rootEl.current,
                width,
                height,
                yAxis: { 
                    domain: config.range || [-10, 10], 
                    label: config.yAxisLabel || "Y-Axis"
                },
                xAxis: { 
                    domain: config.domain || [-12, 12], 
                    label: config.xAxisLabel || "X-Axis"
                },
                grid: true,
                title: config.title,
                data: config.functions.map((fn, idx) => ({
                    fn: fn,
                    graphType: 'polyline',
                    color: idx === 0 ? primaryColor : (idx === 1 ? '#ff3333' : '#3b82f6'),
                    attr: { 'stroke-width': 4 } // Thicker for visibility
                }))
            });

            if (isDark) {
                const svg = rootEl.current.querySelector('svg');
                if (svg) {
                    svg.style.backgroundColor = '#0a0a0a';
                    svg.querySelectorAll('.grid line').forEach((line: any) => {
                        line.style.stroke = gridColor;
                    });
                    svg.querySelectorAll('.axis text').forEach((text: any) => {
                        text.style.fill = '#888';
                    });
                }
            }
        } catch (e) {
            console.error("Graph rendering failed", e);
            rootEl.current.innerHTML = `<div class="text-red-500 text-xs p-4 border-2 border-red-500 rounded-lg bg-red-100 dark:bg-red-900/10">
                <span class="font-bold uppercase">Coordinate System Fault:</span><br/>${(e as any).message}
            </div>`;
        }
    }, [config]);

    return (
        <div 
            className="p-2 bg-white dark:bg-[#0a0a0a] rounded-xl border-2 border-gray-300 dark:border-terminal-green/30 shadow-inner overflow-hidden"
            role="img"
            aria-label={`Interactive Graph: ${config.title || 'Mathematical Function Plot'}. Functions: ${config.functions.join(', ')}`}
        >
            <div ref={rootEl} className="w-full" />
        </div>
    );
};
