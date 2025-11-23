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
  // This regex splits the string into an array where:
  // - Even indices (0, 3, 6...) are regular text
  // - Index % 3 === 1 are the language identifiers (e.g., 'js', 'cpp')
  // - Index % 3 === 2 are the code content
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
              className="whitespace-pre-line" // Preserves paragraph breaks
            />
          );
        }

        // Case 1: Language Identifier (captured but not rendered directly)
        if (mod === 1) {
            return null;
        }

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
    // We use a placeholder approach to prevent HTML escaping from breaking LaTeX output
    const mathBlocks: { id: string, html: string }[] = [];
    
    // 1. Extract Block Math $$...$$
    let temp = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        const id = `MATHBLOCK_${Math.random().toString(36).substr(2, 9)}`;
        try {
            const html = katex.renderToString(formula, { displayMode: true, throwOnError: false });
            mathBlocks.push({ id, html });
            return id;
        } catch (e) {
            return match;
        }
    });

    // 2. Extract Inline Math $...$
    temp = temp.replace(/\$([^$\n]+?)\$/g, (match, formula) => {
        const id = `MATHINLINE_${Math.random().toString(36).substr(2, 9)}`;
        try {
            const html = katex.renderToString(formula, { displayMode: false, throwOnError: false });
            mathBlocks.push({ id, html });
            return id;
        } catch (e) {
            return match;
        }
    });

    // 3. Basic Markdown & Sanitization
    let processed = temp
        // Basic HTML Escape
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
            '<span class="font-mono text-[0.9em] bg-gray-200 dark:bg-[#1e1e1e] text-red-600 dark:text-terminal-green px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 break-words box-decoration-clone">$1</span>'
        );

    // 4. Restore Math Blocks
    mathBlocks.forEach(block => {
        processed = processed.replace(block.id, block.html);
    });

    return processed;
};