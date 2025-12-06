import React, { useEffect, useRef } from 'react';
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

// Wrapped in React.memo to prevent MathJax flashing on parent re-renders (like timer ticks)
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && window.MathJax && window.MathJax.typesetPromise) {
      // Clear previous content handled by MathJax to avoid duplication
      // MathJax 3 modifies the DOM in place, so typically we just need to tell it to look at the node again
      // if the text content changed.
      window.MathJax.typesetPromise([containerRef.current])
        .catch((err: any) => console.warn('MathJax typeset failed: ', err));
    }
  }, [content]);

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
          return (
            <div 
              key={index}
              ref={containerRef}
              // We inject the HTML with our pre-processing
              dangerouslySetInnerHTML={{ __html: processInlineMarkdown(part) }} 
              className="whitespace-pre-line break-words tex2jax_process" 
            />
          );
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

export const processInlineMarkdown = (text: string) => {
    // Pipeline Strategy:
    // 1. Extract Inline Code -> Placeholder
    // 2. Extract Math -> Placeholder (Crucial: to protect from markdown chars)
    // 3. HTML Escape remaining text
    // 4. Apply Markdown Formatting (Bold/Italic) - Unicode aware
    // 5. Restore Placeholders
    
    const placeholders: { id: string, html: string }[] = [];
    let temp = text;

    // Helper to store safely
    const store = (html: string) => {
        const id = `%%PH_${placeholders.length}%%`;
        placeholders.push({ id, html });
        return id;
    };

    // 1. Protect Math Delimiters
    // We store them as placeholders so HTML escaping doesn't break LaTeX like \frac
    // and Markdown doesn't mistake * in math for italics
    // IMPORTANT: Wrap math in a bidi-isolated LTR span so mixed Arabic/Math renders correctly
    temp = temp.replace(/(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)|(\\\[[\s\S]+?\\\])|(\\\([^)\n]+?\\\))/g, (match) => {
        // Force LTR isolation for Math blocks to prevent Arabic sentence structure scrambling
        return store(`<span dir="ltr" style="unicode-bidi: isolate; display: inline-block;">${match}</span>`); 
    });

    // 2. Inline Code `text`
    temp = temp.replace(/`([^`]+)`/g, (match, codeContent) => {
        const escaped = codeContent
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return store(`<span class="font-mono text-[0.9em] bg-gray-200 dark:bg-[#1e1e1e] text-red-600 dark:text-terminal-green px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 break-words box-decoration-clone" dir="ltr">${escaped}</span>`);
    });

    // 3. HTML Escape (Sanitize the rest of the text)
    temp = temp
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 4. Markdown Formatting
    // Bold: **text** - Updated regex to be more inclusive of Unicode/Arabic
    temp = temp.replace(/(^|[^\\])\*\*([^\s].*?[^\s])\*\*/g, '$1<strong class="text-black dark:text-white font-bold">$2</strong>');
    
    // Italic: *text*
    temp = temp.replace(/(^|[^\\*])\*([^\s*].*?[^\s*])\*(?!\*)/g, '$1<em class="italic">$2</em>');

    // 5. Restore Placeholders (Code and Math)
    placeholders.forEach(ph => {
        temp = temp.split(ph.id).join(ph.html);
    });

    return temp;
};