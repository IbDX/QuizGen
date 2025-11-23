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

        // Case 0: Regular Text (which might contain math)
        if (mod === 0) {
          if (!part.trim()) return null;
          return <TextWithMath key={index} text={part} />;
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

const TextWithMath: React.FC<{ text: string }> = ({ text }) => {
    // Split by block math $$...$$ or inline math $...$
    // Group 1: Block math $$...$$
    // Group 2: Inline math $...$ (using non-greedy match, ignoring escaped $)
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$])*?\$)/g);

    return (
        <div className="whitespace-pre-line">
            {parts.map((part, i) => {
                if (part.startsWith('$$') && part.endsWith('$$')) {
                    const math = part.slice(2, -2);
                    try {
                        const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
                        // dir="ltr" ensures math equation layout is always Left-To-Right even in Arabic interface
                        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} dir="ltr" className="my-4 overflow-x-auto text-center" />;
                    } catch (e) {
                        return <span key={i} className="text-red-500 font-mono">{part}</span>;
                    }
                }
                
                if (part.startsWith('$') && part.endsWith('$')) {
                    const math = part.slice(1, -1);
                    try {
                        const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
                        // dir="ltr" ensures math symbols are ordered correctly
                        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} dir="ltr" className="inline-block mx-1" />;
                    } catch (e) {
                        return <span key={i} className="text-red-500 font-mono">{part}</span>;
                    }
                }

                return <span key={i} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(part) }} />;
            })}
        </div>
    );
};

export const processInlineMarkdown = (text: string) => {
    let processed = text
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
            '<span class="font-mono text-[0.9em] bg-gray-200 dark:bg-[#1e1e1e] text-red-600 dark:text-terminal-green px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 break-words box-decoration-clone" dir="ltr">$1</span>'
        );

    return processed;
};