import React from 'react';
import { CodeWindow } from './CodeWindow';
import katex from 'katex';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
  if (!content) return null;

  // Regex to split content by code blocks: ```lang ... ```
  const parts = content.split(/```(\w*)\n?([\s\S]*?)```/g);

  return (
    <div className={`space-y-4 text-sm md:text-base leading-relaxed text-gray-700 dark:text-gray-300 font-sans ${className}`}>
      {parts.map((part, index) => {
        const mod = index % 3;

        // Case 0: Regular Text
        if (mod === 0) {
          if (!part.trim()) return null;
          return (
            <div 
              key={index} 
              dangerouslySetInnerHTML={{ __html: processInlineMarkdown(part) }} 
              className="whitespace-pre-line break-words" 
            />
          );
        }

        // Case 1: Language Identifier
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
};

export const processInlineMarkdown = (text: string) => {
    const mathBlocks: { id: string, html: string }[] = [];
    let temp = text;

    // Helper to process math and protect it from markdown parsers
    const replaceMath = (regex: RegExp, displayMode: boolean) => {
        temp = temp.replace(regex, (match, formula) => {
            const id = `MATH_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 9)}`;
            try {
                const rendered = katex.renderToString(formula, { 
                    displayMode, 
                    throwOnError: false,
                    output: 'html',
                    trust: true
                });
                
                // CRITICAL: Force LTR direction and isolation for math to prevent RTL interference
                const style = displayMode 
                    ? "display: block; margin: 1em 0; text-align: center; direction: ltr; unicode-bidi: isolate;"
                    : "display: inline-block; direction: ltr; unicode-bidi: isolate; vertical-align: middle;";

                const html = `<span style="${style}" class="katex-wrapper">${rendered}</span>`;
                mathBlocks.push({ id, html });
                return id;
            } catch (e) {
                return match;
            }
        });
    };

    // 1. Block Math \[ ... \]
    replaceMath(/\\\[([\s\S]+?)\\\]/g, true);
    
    // 2. Block Math $$ ... $$
    replaceMath(/\$\$([\s\S]+?)\$\$/g, true);

    // 3. Inline Math \( ... \)
    replaceMath(/\\\(([\s\S]+?)\\\)/g, false);

    // 4. Inline Math $ ... $
    // Look ahead to ensure we don't match empty $$, and strictly match pairs
    replaceMath(/\$([^$\n]+?)\$/g, false);

    // 5. Basic Markdown & Sanitization
    let processed = temp
        // Escape HTML
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        
        // Bold **text**
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-black dark:text-white font-bold">$1</strong>')
        
        // Italic *text*
        .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

        // Inline Code `text`
        .replace(
            /`([^`]+)`/g, 
            '<span class="font-mono text-[0.9em] bg-gray-200 dark:bg-[#1e1e1e] text-red-600 dark:text-terminal-green px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 break-words box-decoration-clone" dir="ltr">$1</span>'
        );

    // 6. Restore Math Blocks
    mathBlocks.forEach(block => {
        processed = processed.replace(block.id, block.html);
    });

    return processed;
};