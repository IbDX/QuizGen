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

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([containerRef.current])
        .catch((err: any) => console.warn('MathJax typeset failed: ', err));
    }
  }, [content]);

  if (!content) return null;

  const parts = content.split(/```(\w*)\n?([\s\S]*?)```/g);

  return (
    <div className={`space-y-4 text-sm md:text-base leading-relaxed text-gray-700 dark:text-gray-300 font-sans ${className}`}>
      {parts.map((part, index) => {
        const mod = index % 3;
        if (mod === 0) {
          if (!part.trim()) return null;
          return (
            <div 
              key={index}
              ref={containerRef}
              dangerouslySetInnerHTML={{ __html: processInlineMarkdown(part) }} 
              className="whitespace-pre-line break-words tex2jax_process" 
            />
          );
        }
        if (mod === 1) return null;
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
    const placeholders: { id: string, html: string }[] = [];
    let temp = text;

    const store = (html: string) => {
        const id = `%%PH_${placeholders.length}%%`;
        placeholders.push({ id, html });
        return id;
    };

    // Protect Math Delimiters with strict LTR isolation for Arabic/RTL contexts
    temp = temp.replace(/(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)|(\\\[[\s\S]+?\\\])|(\\\([^)\n]+?\\\))/g, (match) => {
        return store(`<span dir="ltr" style="unicode-bidi: isolate; display: inline-block; vertical-align: middle;">${match}</span>`); 
    });

    // Inline Code
    temp = temp.replace(/`([^`]+)`/g, (match, codeContent) => {
        const escaped = codeContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return store(`<span class="font-mono text-[0.85em] bg-gray-200/50 dark:bg-white/5 text-red-500 dark:text-terminal-green px-1.5 py-0.5 rounded border border-black/5 dark:border-white/5 break-words" dir="ltr">${escaped}</span>`);
    });

    temp = temp.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    temp = temp.replace(/\*\*([^*]+?)\*\*/g, '<strong class="text-black dark:text-white font-bold">$1</strong>');
    temp = temp.replace(/(^|[^\\*])\*([^*]+?)\*(?!\*)/g, '$1<em class="italic">$2</em>');

    placeholders.forEach(ph => {
        temp = temp.split(ph.id).join(ph.html);
    });

    return temp;
};