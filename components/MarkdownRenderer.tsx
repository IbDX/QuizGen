
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
    // Pipeline Strategy:
    // 1. Extract Inline Code -> Placeholder (Protect `*ptr` from italic)
    // 2. Extract Math -> Placeholder (Protect x*y from italic)
    // 3. HTML Escape remaining text
    // 4. Apply Markdown Formatting (Strict Bold/Italic)
    // 5. Restore Placeholders
    
    const placeholders: { id: string, html: string }[] = [];
    let temp = text;

    // Helper to store safely
    const store = (html: string) => {
        const id = `%%PH_${placeholders.length}%%`; // Unique ID
        placeholders.push({ id, html });
        return id;
    };

    // 1. Inline Code `text` - Extract FIRST
    temp = temp.replace(/`([^`]+)`/g, (match, codeContent) => {
        const escaped = codeContent
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return store(`<span class="font-mono text-[0.9em] bg-gray-200 dark:bg-[#1e1e1e] text-red-600 dark:text-terminal-green px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 break-words box-decoration-clone" dir="ltr">${escaped}</span>`);
    });

    // 2. Math - Using KaTeX
    const renderMath = (regex: RegExp, displayMode: boolean) => {
        temp = temp.replace(regex, (match, formula) => {
            try {
                const rendered = katex.renderToString(formula, { 
                    displayMode, 
                    throwOnError: false, 
                    output: 'html', 
                    trust: true,
                    strict: false // Suppress warnings for unrecognized characters
                });
                const style = displayMode 
                    ? "display: block; margin: 1em 0; text-align: center; direction: ltr; unicode-bidi: isolate;"
                    : "display: inline-block; direction: ltr; unicode-bidi: isolate; vertical-align: middle;";
                return store(`<span style="${style}" class="katex-wrapper">${rendered}</span>`);
            } catch (e) {
                return match;
            }
        });
    };

    // Math Regex Order: Block first, then Inline
    renderMath(/\\\[([\s\S]+?)\\\]/g, true);
    renderMath(/\$\$([\s\S]+?)\$\$/g, true);
    renderMath(/\\\(([\s\S]+?)\\\)/g, false);
    renderMath(/\$([^$\n]+?)\$/g, false);

    // 3. HTML Escape (Sanitize the rest of the text)
    temp = temp
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 4. Markdown Formatting (Strict Mode for Smart Text Handling)
    
    // Bold: **text** 
    // Requirement: Must contain non-whitespace content.
    // Prevents matching literal "**" (options in exam) or "** "
    temp = temp.replace(/(^|[^\\])\*\*([^\s](?:.*?[^\s])?)\*\*/g, '$1<strong class="text-black dark:text-white font-bold">$2</strong>');
    
    // Italic: *text*
    // Requirement: Must start with non-space/non-*, end with non-space/non-*.
    // Prevents matching "int *ptr" or "2 * 3" or "***"
    temp = temp.replace(/(^|[^\\*])\*([^\s*](?:.*?[^\s*])?)\*(?!\*)/g, '$1<em class="italic">$2</em>');

    // 5. Restore Placeholders
    placeholders.forEach(ph => {
        temp = temp.split(ph.id).join(ph.html);
    });

    return temp;
};
