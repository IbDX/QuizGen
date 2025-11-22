import React, { useEffect, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-typescript';

interface CodeWindowProps {
  code: string;
  title?: string;
}

export const CodeWindow: React.FC<CodeWindowProps> = ({ code, title = "code" }) => {
  const normalizedCode = useMemo(() => {
    if (!code) return "";
    
    // 1. Handle literal newline escapes often found in JSON responses
    let clean = code.replace(/\\n/g, '\n').replace(/\\t/g, '  ');

    // 2. Heuristic: If code is long (>50 chars) but has effectively no newlines (lines are super long),
    // it is likely a minified or single-line string (like "#include...void main(){...}").
    // We attempt to prettify it for display.
    const lines = clean.split('\n');
    const isSingleLine = lines.length < 2 || (lines.length < 5 && lines.some(l => l.length > 150));
    
    if (isSingleLine && clean.length > 50) {
        // Basic C-like formatter
        clean = clean
            // Break after semicolons, but not inside for loops or quotes (simplified)
            .replace(/;(?!\s*\))/g, ';\n') 
            // Break after braces
            .replace(/{\s*/g, '{\n  ')
            .replace(/}\s*/g, '\n}\n')
            // Fix #include (C++) usually stuck to next keyword
            .replace(/(#include\s*<[^>]+>)([^#\n])/g, '$1\n$2')
            // Fix imports/usings
            .replace(/(using namespace \w+;)(.)/g, '$1\n$2');
    }
    
    return clean.trim();
  }, [code]);

  useEffect(() => {
    Prism.highlightAll();
  }, [normalizedCode]);

  return (
    <div className="rounded-lg overflow-hidden shadow-2xl my-6 border border-gray-700 bg-[#1e1e1e] group">
      {/* Window Header */}
      <div className="bg-[#252526] px-4 py-2 flex items-center justify-between border-b border-black">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-colors shadow-inner"></div>
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 transition-colors shadow-inner"></div>
          <div className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#27c93f]/80 transition-colors shadow-inner"></div>
        </div>
        <div className="text-xs text-gray-400 font-mono opacity-70 select-none group-hover:opacity-100 transition-opacity">
            {title}
        </div>
        <div className="w-12"></div> {/* Spacer for centering */}
      </div>

      {/* Code Area */}
      <div className="relative">
        {/* whitespace-pre-wrap ensures that if a line is still too long, it wraps instead of hiding, 
            but we prefer the pre format if newlines exist. */}
        <pre className="!m-0 !p-4 !bg-[#1e1e1e] !text-sm overflow-x-auto custom-scrollbar">
          <code className="language-javascript text-gray-200 font-mono leading-relaxed whitespace-pre-wrap">
            {normalizedCode}
          </code>
        </pre>
        
        {/* Line numbers deco (simulated) */}
        <div className="absolute top-0 left-0 h-full w-0 border-r border-gray-800 hidden md:block"></div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e1e1e;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
};