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
            // Function Plot is typically light themed, let's adjust slightly or just let it be.
            // It expects a DOM element target.
            const width = rootEl.current.clientWidth;
            // Aspect ratio 16:9 roughly
            const height = Math.min(width * 0.6, 400);
            
            // Clear previous graph
            rootEl.current.innerHTML = "";

            window.functionPlot({
                target: rootEl.current,
                width,
                height,
                yAxis: { domain: config.range || [-10, 10], label: config.yAxisLabel },
                xAxis: { domain: config.domain || [-10, 10], label: config.xAxisLabel },
                grid: true,
                title: config.title,
                data: config.functions.map(fn => ({
                    fn: fn,
                    graphType: 'polyline',
                    color: '#2563eb'
                }))
            });
        } catch (e) {
            console.error("Graph rendering failed", e);
            rootEl.current.innerHTML = `<div class="text-red-500 text-xs p-2 border border-red-500 rounded bg-red-100">Error rendering graph: ${(e as any).message}</div>`;
        }
    }, [config]);

    return (
        <div ref={rootEl} className="w-full bg-white rounded border border-gray-300 dark:border-terminal-gray overflow-hidden mb-4" />
    );
};
