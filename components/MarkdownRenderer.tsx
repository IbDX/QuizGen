
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CodeWindow } from './CodeWindow';

declare global {
  interface Window {
    MathJax: any;
  }
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// --- MATHJAX CACHING STRATEGY ---
// Caches the generated SVG HTML string for a given LaTeX input.
// This prevents expensive re-rendering of common symbols (e.g., "x", "y", integrals).
const mathCache = new Map<string, string>();

const getCachedMath = async (latex: string, displayMode: boolean): Promise<string> => {
    const key = `${displayMode ? 'D' : 'I'}::${latex}`;
    if (mathCache.has(key)) return mathCache.get(key)!;

    try {
        if (!window.MathJax) return latex;
        // Use tex2svgPromise to get the SVG node directly
        const node = await window.MathJax.tex2svgPromise(latex, { display: displayMode });
        const html = node.outerHTML;
        mathCache.set(key, html);
        // Manage cache size (LRU-ish: delete oldest if too big)
        if (mathCache.size > 500) {
            const firstKey = mathCache.keys().next().value;
            if (firstKey) mathCache.delete(firstKey);
        }
        return html;
    } catch (e) {
        console.warn('MathJax Render Error', e);
        return latex;
    }
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [processedHtml, setProcessedHtml] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const processContent = async () => {
        if (!content) return;

        // 1. Pre-process Markdown (Bold, Italic, Inline Code)
        let html = processInlineMarkdown(content);

        // 2. Identify Math Delimiters and replace with Cached SVG
        // We use a regex to find all math segments first
        const mathRegex = /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)|(\\\[[\s\S]+?\\\])|(\\\([^)\n]+?\\\))/g;
        
        // We need to process async replacements. 
        // split by regex includes capturing groups, so we iterate carefully.
        const parts = html.split(mathRegex);
        
        const resolvedParts = await Promise.all(parts.map(async (part) => {
            if (!part) return '';
            
            // Check if this part is a math string
            if (part.startsWith('$$') || part.startsWith('\\[')) {
                const tex = part.replace(/^\$\$|\$\$|\\\[|\\\]$/g, '');
                return await getCachedMath(tex, true);
            } else if (part.startsWith('$') || part.startsWith('\\(')) {
                const tex = part.replace(/^\$|\$|\\\(|\\\)$/g, '');
                return await getCachedMath(tex, false);
            }
            return part;
        }));

        if (isMounted) {
            setProcessedHtml(resolvedParts.join(''));
        }
    };

    processContent();

    return () => { isMounted = false; };
  }, [content]);

  if (!content) return null;

  // Split content by code blocks to avoid rendering Markdown/Math inside code
  // This logic runs BEFORE the async math processing to ensure code blocks remain pristine
  const parts = content.split(/```(\w*)\n?([\s\S]*?)```/g);

  return (
    <div className={`space-y-4 text-sm md:text-base leading-relaxed text-gray-700 dark:text-gray-300 font-sans ${className}`}>
      {parts.map((part, index) => {
        const mod = index % 3;

        // Case 0: Regular Text (Markdown + Math)
        if (mod === 0) {
          if (!part.trim()) return null;
          // If we are in the main text block, we use the processed HTML state if available, 
          // otherwise fallback to raw until effect runs (prevents flicker, but might show raw latex briefly)
          // However, since we split by code blocks *outside*, the 'content' prop passed to THIS component
          // might be just a chunk.
          // To simplify: We render a sub-component for text chunks to handle the async math.
          return <AsyncMathText key={index} content={part} />;
        }

        // Case 1: Language Identifier (skip)
        if (mod === 1) return null;

        // Case 2: Code Content
        if (mod === 2) {
            const lang = parts[index - 1] || 'snippet';
            return <CodeWindow key={index} code={part} title={lang} />;
        }
        
        return null;
      })}
    </div>
  );
}, (prevProps, nextProps) => prevProps.content === nextProps.content);

// Sub-component to handle async math rendering for text chunks
const AsyncMathText: React.FC<{ content: string }> = ({ content }) => {
    const [html, setHtml] = useState<string>(processInlineMarkdown(content)); // Initial state is markdown processed

    useEffect(() => {
        let isMounted = true;
        const renderMath = async () => {
            const mathRegex = /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)|(\\\[[\s\S]+?\\\])|(\\\([^)\n]+?\\\))/g;
            const parts = content.split(mathRegex);
            
            // Reconstruct string replacing math parts with SVGs
            const result = await Promise.all(parts.map(async (part) => {
                if (!part) return '';
                // Determine if part matches a math delimiter
                if (part.match(mathRegex)) {
                    const isDisplay = part.startsWith('$$') || part.startsWith('\\[');
                    // Strip delimiters
                    const cleanTex = part.replace(/^(\$\$|\$|\\\[|\\\()|(\$\$|\$|\\\]|\\\))$/g, '');
                    const svg = await getCachedMath(cleanTex, isDisplay);
                    // Wrap in span for accessibility
                    return `<span class="math-container" aria-label="${cleanTex.replace(/"/g, '&quot;')}" role="img">${svg}</span>`;
                }
                return processInlineMarkdown(part);
            }));

            if (isMounted) setHtml(result.join(''));
        };
        renderMath();
        return () => { isMounted = false; };
    }, [content]);

    return (
        <div 
            dangerouslySetInnerHTML={{ __html: html }} 
            className="whitespace-pre-line break-words" 
        />
    );
};

export const processInlineMarkdown = (text: string) => {
    const placeholders: { id: string, html: string }[] = [];
    let temp = text;

    const store = (html: string) => {
        const id = `%%PH_${placeholders.length}%%`;
        placeholders.push({ id, html });
        return id;
    };

    // 1. Inline Code `text` - Ensure high contrast for accessibility
    temp = temp.replace(/`([^`]+)`/g, (match, codeContent) => {
        const escaped = codeContent
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return store(`<span class="font-mono text-[0.9em] bg-gray-200 dark:bg-[#1e1e1e] text-red-700 dark:text-terminal-green px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 break-words box-decoration-clone" dir="ltr">${escaped}</span>`);
    });

    // 2. HTML Escape
    temp = temp
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 3. Markdown Formatting
    // Strong/Bold
    temp = temp.replace(/\*\*([^*]+?)\*\*/g, '<strong class="text-black dark:text-white font-bold">$1</strong>');
    
    // Italic
    temp = temp.replace(/(^|[^\\*])\*([^*]+?)\*(?!\*)/g, '$1<em class="italic">$2</em>');

    // 4. Restore Placeholders
    placeholders.forEach(ph => {
        temp = temp.split(ph.id).join(ph.html);
    });

    return temp;
};
