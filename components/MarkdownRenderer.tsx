import React, { useEffect, useState, useMemo } from 'react';
import { CodeWindow } from './CodeWindow';
import { mathCache } from '../services/mathCache';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Regex to identify math blocks
const MATH_REGEX = /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)|(\\\[[\s\S]+?\\\])|(\\\([^)\n]+?\\\))/g;

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className = "" }) => {
  const [processedContent, setProcessedContent] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    const renderAsync = async () => {
      if (!content) {
          if (isMounted) setProcessedContent("");
          return;
      }

      // 1. Split code blocks to avoid processing math inside code
      const parts = content.split(/```(\w*)\n?([\s\S]*?)```/g);
      const renderedParts: string[] = [];

      for (let i = 0; i < parts.length; i++) {
        const mod = i % 3;
        
        // Text Content (Process Markdown & Math)
        if (mod === 0) {
            let text = parts[i];
            if (!text.trim()) continue;

            // Replace Math Delimiters with Cached SVG
            const mathMatches = text.match(MATH_REGEX);
            if (mathMatches) {
                // We split by regex to preserve order
                const fragments = text.split(MATH_REGEX).filter(f => f !== undefined);
                let reconstructed = "";
                
                // Note: .split with capture groups returns the captures in the array too.
                // We iterate and check if a fragment matches math pattern.
                for (const frag of fragments) {
                    if (!frag) continue; // Skip empty matches

                    if (frag.match(MATH_REGEX)) {
                        // Determine type and clean latex
                        const isDisplay = frag.startsWith('$$') || frag.startsWith('\\[');
                        let cleanLatex = frag
                            .replace(/^\$\$|\$\$$/g, '')
                            .replace(/^\$|\$$/g, '')
                            .replace(/^\\\[|\\\]$/g, '')
                            .replace(/^\\\(|\\\)$/g, '');
                        
                        // Get SVG from Cache
                        const svg = await mathCache.getSVG(cleanLatex, isDisplay);
                        
                        // Wrap in RTL isolation span
                        reconstructed += `<span dir="ltr" style="unicode-bidi: isolate; display: inline-block; vertical-align: middle; margin: 2px;">${svg}</span>`;
                    } else {
                        // Standard Inline Markdown Processing
                        reconstructed += processInlineMarkdown(frag);
                    }
                }
                text = reconstructed;
            } else {
                text = processInlineMarkdown(text);
            }
            renderedParts.push(text);
        }
        // Language Tag (Skip)
        else if (mod === 1) { 
            continue; 
        }
        // Code Content (Render Component Placeholder)
        else if (mod === 2) {
            const lang = parts[i - 1] || 'snippet';
            const code = parts[i];
            // We use a special marker to inject the React component later
            // But since this is a dangerouslySetInnerHTML approach for the text parts,
            // we have to handle the code block separation at the parent JSX level.
            // NOTE: The current structure renders text blocks as HTML and Code as React Components.
            // We need to return the array structure to the JSX.
        }
      }
    };

    // New Hybrid Approach:
    // We can't put React Components (CodeWindow) inside dangerouslySetInnerHTML.
    // So we iterate and process math asynchronously, then update state.
    
    const processContent = async () => {
        const segments = content.split(/```(\w*)\n?([\s\S]*?)```/g);
        const finalJsx: React.ReactNode[] = [];

        for (let i = 0; i < segments.length; i++) {
            const mod = i % 3;
            
            // Text Block
            if (mod === 0) {
                const text = segments[i];
                if (!text.trim()) continue;

                // Process math occurrences asynchronously
                const fragments = text.split(MATH_REGEX);
                const htmlFragments: string[] = [];

                for (let j = 0; j < fragments.length; j++) {
                    const frag = fragments[j];
                    if (!frag && frag !== '') continue; // Strict undefined check, allow empty string from split edge cases? No, skip empty.
                    if (!frag) continue;

                    if (frag.match(MATH_REGEX)) {
                        const isDisplay = frag.startsWith('$$') || frag.startsWith('\\[');
                        const cleanLatex = frag
                            .replace(/^\$\$|\$\$$/g, '')
                            .replace(/^\$|\$$/g, '')
                            .replace(/^\\\[|\\\]$/g, '')
                            .replace(/^\\\(|\\\)$/g, '');
                        
                        const svg = await mathCache.getSVG(cleanLatex, isDisplay);
                        htmlFragments.push(`<span dir="ltr" style="unicode-bidi: isolate; display: inline-block; vertical-align: middle; margin: 0 2px;">${svg}</span>`);
                    } else {
                        htmlFragments.push(processInlineMarkdown(frag));
                    }
                }

                finalJsx.push(
                    <div 
                        key={`text-${i}`} 
                        dangerouslySetInnerHTML={{ __html: htmlFragments.join('') }} 
                        className="whitespace-pre-line break-words leading-relaxed text-gray-700 dark:text-gray-300"
                    />
                );
            }
            // Language Tag (Skipped, used in next iteration)
            else if (mod === 1) { continue; }
            // Code Block
            else if (mod === 2) {
                const lang = segments[i - 1] || 'snippet';
                finalJsx.push(<CodeWindow key={`code-${i}`} code={segments[i]} title={lang} />);
            }
        }
        
        // @ts-ignore
        if (isMounted) setProcessedContent(finalJsx);
    };

    processContent();

    return () => { isMounted = false; };
  }, [content]);

  // If we haven't processed yet, show simple loading or raw text? 
  // Better to show nothing briefly than raw latex.
  if (!processedContent) return <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>;

  return (
    <div className={`space-y-4 text-sm md:text-base font-sans ${className}`}>
      {processedContent}
    </div>
  );
}, (prevProps, nextProps) => prevProps.content === nextProps.content);

// Helper for basic markdown (Bold, Italic, Inline Code)
// Math handling is removed from here as it is handled by the Async Math Cache loop
export const processInlineMarkdown = (text: string) => {
    let temp = text;
    
    // Inline Code (High priority to prevent collision)
    temp = temp.replace(/`([^`]+)`/g, (match, code) => {
        const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<span class="font-mono text-[0.85em] bg-gray-200/50 dark:bg-white/5 text-red-500 dark:text-terminal-green px-1.5 py-0.5 rounded border border-black/5 dark:border-white/5 break-words" dir="ltr">${escaped}</span>`;
    });

    // Sanitize HTML chars in normal text (Simple pass)
    // Note: complex sanitization should ideally happen before markdown processing
    // temp = temp.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 

    // Bold
    temp = temp.replace(/\*\*([^*]+?)\*\*/g, '<strong class="text-black dark:text-white font-bold">$1</strong>');
    
    // Italic
    temp = temp.replace(/(^|[^\\*])\*([^*]+?)\*(?!\*)/g, '$1<em class="italic">$2</em>');

    return temp;
};