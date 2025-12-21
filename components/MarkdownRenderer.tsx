
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
        return `<span class="text-red-500 text-xs">${latex}</span>`;
    }
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className = "" }) => {
  if (!content) return null;

  // Split content by code blocks to avoid rendering Markdown/Math inside code
  const parts = content.split(/```(\w*)\n?([\s\S]*?)```/g);

  return (
    <div className={`space-y-4 text-sm md:text-base leading-relaxed text-gray-700 dark:text-gray-300 font-sans ${className}`}>
      {parts.map((part, index) => {
        const mod = index % 3;

        // Case 0: Regular Text (Markdown + Math)
        if (mod === 0) {
          if (!part.trim()) return null;
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
    const [html, setHtml] = useState<string>(content); // Initial state is raw content (avoids flash of broken md)

    useEffect(() => {
        let isMounted = true;
        const renderMath = async () => {
            // Regex to find math. Supports $$...$$, \[...\], $...$, \(...\)
            // Updated to be more permissive with newlines in inline math if needed
            const mathRegex = /(\$\$[\s\S]+?\$\$)|(\$[^$]+?\$)|(\\\[[\s\S]+?\\\])|(\\\([^)\n]+?\\\))/g;
            
            // 1. Split content by Math regex
            const parts = content.split(mathRegex);
            
            // 2. Process each part: If match math regex -> Render Math. Else -> Process Markdown.
            const result = await Promise.all(parts.map(async (part) => {
                if (!part) return '';
                
                // Strict check: Is this part EXACTLY a math string?
                // The split regex captures the delimiters, so 'part' will be "$x$" or "$$x$$" etc.
                const isMath = /^(\$\$[\s\S]+?\$\$)|(\$[^$]+?\$)|(\\\[[\s\S]+?\\\])|(\\\([^)\n]+?\\\))$/.test(part);

                if (isMath) {
                    const isDisplay = part.startsWith('$$') || part.startsWith('\\[');
                    // Strip delimiters for MathJax processing
                    const cleanTex = part.replace(/^(\$\$|\$|\\\[|\\\()|(\$\$|\$|\\\]|\\\))$/g, '');
                    
                    const svg = await getCachedMath(cleanTex, isDisplay);
                    
                    // Wrap in span to protect from subsequent markdown processing (if any, though we did it separately)
                    // and for accessibility/styling
                    return `<span class="math-container" aria-label="${cleanTex.replace(/"/g, '&quot;')}" role="img">${svg}</span>`;
                }
                
                // If not math, apply Markdown formatting (Bold, Italic, Inline Code)
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
    // Process this FIRST so backticks aren't confused with other things
    temp = temp.replace(/`([^`]+)`/g, (match, codeContent) => {
        const escaped = codeContent
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return store(`<span class="font-mono text-[0.9em] bg-gray-200 dark:bg-[#1e1e1e] text-red-700 dark:text-terminal-green px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 break-words box-decoration-clone" dir="ltr">${escaped}</span>`);
    });

    // 2. HTML Escape (Basic) - Prevent XSS from raw text while preserving our placeholders
    temp = temp
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 3. Markdown Formatting
    // Strong/Bold (** or __)
    temp = temp.replace(/(\*\*|__)(.*?)\1/g, '<strong class="text-black dark:text-white font-bold">$2</strong>');
    
    // Italic (* or _)
    // Note: We use a stricter regex to avoid matching math symbols if they leaked here (though math is processed first now)
    temp = temp.replace(/(\*|_)(.*?)\1/g, '<em class="italic">$2</em>');

    // 4. Restore Placeholders
    placeholders.forEach(ph => {
        temp = temp.split(ph.id).join(ph.html);
    });

    return temp;
};
