import { Question, QuestionType } from "../types";

// Declare pdfMake types for window
declare global {
  interface Window {
    pdfMake: any;
  }
}

// Utility to clean text for PDF output (Remove Markdown and LaTeX delimiters)
const cleanTextForPdf = (text: string): string => {
    if (!text) return "";
    let clean = text;

    // FIX: If the entire string consists of markdown-like characters, it's a literal.
    // We "escape" it by inserting a zero-width space between each character
    // to prevent pdfmake's parser from interpreting it as formatting.
    if (/^[\*_`]+$/.test(clean.trim())) {
        return clean.trim().split('').join('\u200B');
    }

    // 1. Remove Markdown formatting but keep the content.
    // This regex ensures we only match when there's non-whitespace content inside.
    // Bold: **text** or __text__ -> text
    clean = clean.replace(/\*\*([^\s](?:.*?[^\s])?)\*\*/g, '$1').replace(/__([^\s](?:.*?[^\s])?)__/g, '$1');
    // Italic: *text* or _text_ -> text
    clean = clean.replace(/\*([^\s](?:.*?[^\s])?)\*/g, '$1').replace(/_([^\s](?:.*?[^\s])?)_/g, '$1');
    // Inline code: `code` -> code. This one is simpler as `code` can be anything.
    clean = clean.replace(/`([^`]+)`/g, '$1');

    // 2. Enhanced LaTeX Math to Unicode conversion for PDF
    // Greek Lowercase
    clean = clean.replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ').replace(/\\delta/g, 'δ')
                 .replace(/\\epsilon/g, 'ε').replace(/\\zeta/g, 'ζ').replace(/\\eta/g, 'η').replace(/\\theta/g, 'θ')
                 .replace(/\\iota/g, 'ι').replace(/\\kappa/g, 'κ').replace(/\\lambda/g, 'λ').replace(/\\mu/g, 'μ')
                 .replace(/\\nu/g, 'ν').replace(/\\xi/g, 'ξ').replace(/\\pi/g, 'π').replace(/\\rho/g, 'ρ')
                 .replace(/\\sigma/g, 'σ').replace(/\\tau/g, 'τ').replace(/\\upsilon/g, 'υ').replace(/\\phi/g, 'φ')
                 .replace(/\\chi/g, 'χ').replace(/\\psi/g, 'ψ').replace(/\\omega/g, 'ω');

    // Greek Uppercase
    clean = clean.replace(/\\Gamma/g, 'Γ').replace(/\\Delta/g, 'Δ').replace(/\\Theta/g, 'Θ').replace(/\\Lambda/g, 'Λ')
                 .replace(/\\Xi/g, 'Ξ').replace(/\\Pi/g, 'Π').replace(/\\Sigma/g, 'Σ').replace(/\\Phi/g, 'Φ')
                 .replace(/\\Psi/g, 'Ψ').replace(/\\Omega/g, 'Ω');

    // Common Math Operators
    clean = clean.replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\div/g, '÷').replace(/\\pm/g, '±').replace(/\\mp/g, '∓');
    clean = clean.replace(/\\le/g, '≤').replace(/\\ge/g, '≥').replace(/\\ne/g, '≠').replace(/\\neq/g, '≠').replace(/\\approx/g, '≈').replace(/\\equiv/g, '≡');
    clean = clean.replace(/\\circ/g, '∘').replace(/\\infty/g, '∞').replace(/\\partial/g, '∂').replace(/\\nabla/g, '∇');
    
    // Arrows
    clean = clean.replace(/\\rightarrow/g, '→').replace(/\\to/g, '→').replace(/\\leftarrow/g, '←');
    clean = clean.replace(/\\Rightarrow/g, '⇒').replace(/\\Leftarrow/g, '⇐').replace(/\\iff/g, '⇔').replace(/\\implies/g, '⇒');

    // Sets and Logic
    clean = clean.replace(/\\in/g, '∈').replace(/\\notin/g, '∉').replace(/\\subset/g, '⊂').replace(/\\subseteq/g, '⊆')
                 .replace(/\\union/g, '∪').replace(/\\cup/g, '∪').replace(/\\cap/g, '∩').replace(/\\emptyset/g, '∅')
                 .replace(/\\forall/g, '∀').replace(/\\exists/g, '∃');

    // Calculus & Big Operators
    clean = clean.replace(/\\int/g, '∫').replace(/\\sum/g, '∑').replace(/\\prod/g, '∏');
    clean = clean.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫($1 → $2)'); // Definite integral
    clean = clean.replace(/\\lim_\{([^}]+) \\to ([^}]+)\}/g, 'lim($1→$2)'); // Limits
    
    // Fractions: \frac{a}{b} -> (a)/(b)
    // Simple non-nested fractions
    clean = clean.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
    
    // Subscripts and Superscripts
    clean = clean.replace(/\^\{([^}]+)\}/g, '^($1)').replace(/\_\{([^}]+)\}/g, '_($1)');
    clean = clean.replace(/\^([0-9a-zA-Z])/g, '^$1').replace(/\_([0-9a-zA-Z])/g, '_$1');

    // Roots
    clean = clean.replace(/\\sqrt\{([^}]+)\}/g, '√($1)').replace(/\\sqrt/g, '√');

    // Formatting & Text
    clean = clean.replace(/\\text\{([^}]+)\}/g, '$1').replace(/\\mathrm\{([^}]+)\}/g, '$1');
    clean = clean.replace(/\\mathbf\{([^}]+)\}/g, '$1').replace(/\\mathit\{([^}]+)\}/g, '$1');
    clean = clean.replace(/\\,/g, ' '); // spacing

    // 3. Remove remaining LaTeX Delimiters ($ and $$ and \[ \])
    clean = clean.replace(/\$\$/g, '').replace(/\$/g, '');
    clean = clean.replace(/\\\[/g, '').replace(/\\\]/g, '');
    clean = clean.replace(/\\\(/g, '').replace(/\\\)/g, '');
    
    // 4. Remove leftover backslashes and cleanup
    clean = clean.replace(/\\begin\{cases\}/g, '\n[Cases:\n');
    clean = clean.replace(/\\end\{cases\}/g, '\n]');
    clean = clean.replace(/\\\\/g, '\n'); // Line breaks in latex
    clean = clean.replace(/\\/g, ''); // Remaining slashes

    return clean.trim();
};

const isArabic = (text: string) => {
    return /[\u0600-\u06FF]/.test(text);
};

// Fetch Cairo/Amiri font from CDN to support Arabic in PDFMake
const loadFonts = async (): Promise<string | null> => {
    const candidates = [
        "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/static/Cairo-Regular.ttf",
        "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf",
        "https://cdn.jsdelivr.net/npm/@fontsource/cairo/files/cairo-arabic-400-normal.woff",
    ];

    for (const url of candidates) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const blob = await response.blob();
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result as string;
                        if (!result) return reject("Reader failed");
                        const base64 = result.split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }
        } catch (e) {
            console.warn(`Failed to load font from ${url}`, e);
        }
    }
    console.warn("All Arabic font loading attempts failed. PDF may not render Arabic correctly.");
    return null;
};

export const generateExamPDF = async (questions: Question[], score: number, grade: string, userName?: string) => {
  const pdfMake = window.pdfMake;
  if (!pdfMake) {
      alert("PDF Generation Library not loaded. Please wait a moment or refresh.");
      return;
  }

  const arabicFontBase64 = await loadFonts();
  
  if (arabicFontBase64) {
      pdfMake.vfs = pdfMake.vfs || {};
      const fontFileName = "ArabicFont.ttf";
      pdfMake.vfs[fontFileName] = arabicFontBase64;
      
      pdfMake.fonts = {
          ArabicFont: {
              normal: fontFileName, bold: fontFileName, 
              italics: fontFileName, bolditalics: fontFileName
          },
          Roboto: {
              normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf',
              italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf'
          }
      };
  }

  const defaultFont = arabicFontBase64 ? 'ArabicFont' : 'Roboto';

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    defaultStyle: { font: defaultFont },
    header: {
        text: 'Z+ Terminal Exam Gen | Confidential Report',
        alignment: 'center', margin: [0, 30, 0, 0],
        color: '#aaaaaa', fontSize: 8
    },
    footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'right', margin: [0, 0, 40, 0],
        color: '#aaaaaa', fontSize: 8
    }),
    content: [],
    styles: {
      mainTitle: { fontSize: 28, bold: true, color: '#111827' },
      subTitle: { fontSize: 10, color: '#6b7280', characterSpacing: 2, margin: [0, 0, 0, 20] },
      reportHeader: { fontSize: 10, bold: true, color: '#374151' },
      reportValue: { fontSize: 10, color: '#1f2937' },
      subheader: { fontSize: 16, bold: true, color: '#111827', margin: [0, 20, 0, 10] },
      questionHeader: { fontSize: 11, bold: true, color: '#1E40AF', margin: [0, 0, 0, 8] },
      questionBody: { fontSize: 10, color: '#1f2937', margin: [0, 5, 0, 15], lineHeight: 1.3 },
      code: { font: 'Roboto', fontSize: 8.5, color: '#333' },
      optionsList: { fontSize: 10, margin: [20, 5, 0, 10], lineHeight: 1.3 },
      answerKeyHeader: { fontSize: 11, bold: true, color: '#111827' },
      correctAnswer: { fontSize: 10, color: '#1f2937' },
      explanation: { fontSize: 8.5, italics: true, color: '#4b5563', margin: [10, 5, 0, 0], lineHeight: 1.2 }
    }
  };

  // --- REPORT HEADER ---
  docDefinition.content.push({
      stack: [
          { text: 'Z+ Terminal Exam Gen', style: 'mainTitle' },
          { text: 'CONFIDENTIAL EXAMINATION REPORT', style: 'subTitle' }
      ],
      alignment: 'center',
      margin: [0, 0, 0, 20]
  });

  docDefinition.content.push({
      table: {
          widths: ['auto', '*', 'auto', '*'],
          body: [
              [
                  { text: 'Agent:', style: 'reportHeader', border: [false, true, false, false], borderColor: ['', '#e5e7eb', '', ''], pt: 5 },
                  { text: userName || 'Unknown', style: 'reportValue', border: [false, true, false, false], borderColor: ['', '#e5e7eb', '', ''], pt: 5 },
                  { text: 'Date:', style: 'reportHeader', alignment: 'right', border: [false, true, false, false], borderColor: ['', '#e5e7eb', '', ''], pt: 5 },
                  { text: new Date().toLocaleString(), style: 'reportValue', alignment: 'right', border: [false, true, false, false], borderColor: ['', '#e5e7eb', '', ''], pt: 5 }
              ],
              [
                  { text: 'Final Score:', style: 'reportHeader', pt: 8, border: [false, false, false, true], borderColor: ['', '', '', '#e5e7eb'] },
                  { text: `${score}%`, style: 'reportValue', bold: true, color: score >= 50 ? '#059669' : '#DC2626', pt: 8, border: [false, false, false, true], borderColor: ['', '', '', '#e5e7eb'] },
                  { text: 'Grade:', style: 'reportHeader', alignment: 'right', pt: 8, border: [false, false, false, true], borderColor: ['', '', '', '#e5e7eb'] },
                  { text: grade, style: 'reportValue', bold: true, alignment: 'right', pt: 8, border: [false, false, false, true], borderColor: ['', '', '', '#e5e7eb'] }
              ]
          ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 30]
  });

  // --- QUESTIONS ---
  docDefinition.content.push({ text: 'Exam Questions', style: 'subheader', pageBreak: 'before' });

  questions.forEach((q, i) => {
    const cleanQText = cleanTextForPdf(q.text);
    const isQArabic = isArabic(cleanQText);
    
    const questionStack: any[] = [];

    // Question Header & Body
    questionStack.push({ text: `Question ${i + 1}: [${q.type}]`, style: 'questionHeader', alignment: isQArabic ? 'right' : 'left' });
    questionStack.push({ text: cleanQText, style: 'questionBody', alignment: isQArabic ? 'right' : 'left' });

    // Code Snippet
    if (q.codeSnippet) {
        questionStack.push({
            table: { widths: ['*'], body: [[{ text: q.codeSnippet, style: 'code' }]] },
            layout: {
                fillColor: '#f3f4f6',
                paddingLeft: () => 10, paddingRight: () => 10,
                paddingTop: () => 8, paddingBottom: () => 8,
                hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                hLineColor: () => '#d1d5db', vLineColor: () => '#d1d5db',
            },
            margin: [0, 5, 0, 15]
        });
    }

    // Options (Using Ordered List for proper formatting)
    if (q.options && q.options.length > 0) {
        const optionsList = q.options.map((opt) => {
            const cleanOpt = cleanTextForPdf(opt);
            const isOptArabic = isArabic(cleanOpt);

            // Heuristic to detect if an option is a code block
            const isCodeBlock = (cleanOpt.match(/\n/g) || []).length >= 2 || 
                                cleanOpt.includes(';') || cleanOpt.includes('{') ||
                                cleanOpt.trim().startsWith('void ') || cleanOpt.trim().startsWith('int ');

            if (isCodeBlock && q.type === QuestionType.MCQ) {
                // Wrap code blocks in a borderless table to treat them as a single entity
                // and apply specific code styling. This helps prevent page breaks inside the code.
                return {
                    table: {
                        widths: ['*'],
                        body: [[{
                            text: cleanOpt,
                            style: 'code', // Use smaller, monospaced font
                            alignment: 'left', // Code is always LTR
                        }]]
                    },
                    layout: 'noBorders',
                    margin: [0, 2, 0, 2] // Provide some vertical spacing
                };
            }

            return {
                text: cleanOpt || '(Blank Option)',
                alignment: isOptArabic ? 'right' : 'left'
            };
        });
        questionStack.push({
            ol: optionsList,
            type: 'A',
            style: 'optionsList'
        });
    }
    
    // --- DYNAMIC UNBREAKABLE LOGIC ---
    // Estimate content length to decide if a question should be unbreakable.
    // Very large questions (e.g., coding MCQs with large snippets) should be allowed to break.
    const textLength = q.text ? cleanTextForPdf(q.text).length : 0;
    const snippetLength = q.codeSnippet ? q.codeSnippet.length : 0;
    const optionsLength = q.options ? q.options.reduce((sum, opt) => sum + cleanTextForPdf(opt).length, 0) : 0;
    const totalContentLength = textLength + snippetLength + optionsLength;
    
    // If content is larger than ~2000 characters, allow it to break across pages.
    // This prevents large gaps when a question is too big to fit on the current page.
    const isUnbreakable = totalContentLength < 2000;

    docDefinition.content.push({
        stack: questionStack,
        unbreakable: isUnbreakable,
        margin: [0, 0, 0, 25] // Vertical spacing between questions
    });
  });

  // --- ANSWER KEY ---
  docDefinition.content.push({ text: 'Answer Key & Explanations', style: 'subheader', pageBreak: 'before' });

  questions.forEach((q, i) => {
      let answerText = "See explanation below.";
      if (q.type === QuestionType.MCQ && q.options && q.options.length > 0 && q.correctOptionIndex !== undefined) {
          answerText = `(${String.fromCharCode(65 + q.correctOptionIndex)}) ${cleanTextForPdf(q.options[q.correctOptionIndex])}`;
      } else if (q.type === QuestionType.TRACING) {
          answerText = q.tracingOutput || "N/A";
      }

      const cleanExp = cleanTextForPdf(q.explanation);
      const isExpArabic = isArabic(cleanExp);

      docDefinition.content.push({
        stack: [
            { text: `Question ${i + 1}`, style: 'answerKeyHeader', alignment: isExpArabic ? 'right' : 'left' },
            {
                text: [
                    { text: 'Correct Answer: ', bold: true },
                    { text: answerText }
                ],
                style: 'correctAnswer',
                alignment: isExpArabic ? 'right' : 'left',
                margin: [0, 5, 0, 0]
            },
            {
                text: cleanExp,
                style: 'explanation',
                alignment: isExpArabic ? 'right' : 'left',
            }
        ],
        unbreakable: true, // Keep answer keys together
        margin: [0, 0, 0, 10]
      });

      if (i < questions.length - 1) {
          docDefinition.content.push({
              canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5, lineColor: '#e5e7eb' }],
              margin: [0, 5, 0, 15]
          });
      }
  });

  try {
    pdfMake.createPdf(docDefinition).download(`Z_Plus_Report_${Date.now()}.pdf`);
  } catch(e) {
      console.error("PDF Make Error", e);
      alert("Failed to generate PDF. See console for details.");
  }
};