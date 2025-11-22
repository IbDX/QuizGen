
import { jsPDF } from "jspdf";
import { Question, QuestionType } from "../types";

export const generateExamPDF = (questions: Question[], score: number, grade: string, userName?: string) => {
  const doc = new jsPDF();
  let y = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxLineWidth = pageWidth - (margin * 2);

  // Helper to add new page if content overflows
  const checkPageBreak = (height: number) => {
    if (y + height > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // --- TITLE PAGE ---
  doc.setFont("courier", "bold");
  doc.setFontSize(24);
  doc.text("Z+ EXAM REPORT", margin, y);
  y += 10;
  
  doc.setFont("courier", "normal");
  doc.setFontSize(12);
  doc.text(`Agent: ${userName || 'Unknown'}`, margin, y);
  y += 6;
  doc.text(`Date: ${new Date().toLocaleString()}`, margin, y);
  y += 6;
  doc.text(`Score: ${score}% [${grade}]`, margin, y);
  y += 20;

  // --- QUESTIONS SECTION ---
  doc.setFontSize(18);
  doc.setFont("courier", "bold");
  doc.text("I. QUESTIONS", margin, y);
  y += 15;

  questions.forEach((q, i) => {
    doc.setFontSize(12);
    doc.setFont("courier", "bold");
    const title = `Q${i + 1}. [${q.type}] ${q.topic ? `(${q.topic})` : ''}`;
    checkPageBreak(10);
    doc.text(title, margin, y);
    y += 7;

    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    
    // --- DEDUPLICATION LOGIC START ---
    // We want to render code in the specialized gray box, so we must remove it from the text
    // to prevent it from appearing twice (once as raw text, once as box).
    
    let displayText = q.text;

    // 1. Remove markdown code blocks (```...```) from text
    //    PDF cannot render inline markdown blocks nicely, so we rely on the codeSnippet box.
    displayText = displayText.replace(/```[\s\S]*?```/g, '');

    // 2. Remove raw code string if present in text (plain text duplication)
    if (q.codeSnippet && displayText.includes(q.codeSnippet)) {
        displayText = displayText.replace(q.codeSnippet, '');
    }

    // 3. Strip remaining markdown flair (*, `) for plain text PDF rendering
    const plainText = displayText
        .replace(/\*\*/g, '') 
        .replace(/`/g, '')
        .replace(/\n\s*\n/g, '\n') // Collapse excessive newlines
        .trim();
    // --- DEDUPLICATION LOGIC END ---

    const lines = doc.splitTextToSize(plainText, maxLineWidth);
    checkPageBreak(lines.length * 5);
    doc.text(lines, margin, y);
    y += (lines.length * 5) + 5;

    // Code Snippet Box
    if (q.codeSnippet) {
        const codeLines = doc.splitTextToSize(q.codeSnippet, maxLineWidth - 10);
        const boxHeight = (codeLines.length * 4) + 6;
        checkPageBreak(boxHeight + 5);
        
        // Gray box background
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 2, maxLineWidth, boxHeight, 'F');
        
        doc.setFont("courier", "normal"); // Ensure mono
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.text(codeLines, margin + 2, y + 3);
        
        // Reset style
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        y += boxHeight + 6;
    }

    // Options for MCQ
    if (q.options) {
        q.options.forEach((opt, optIdx) => {
            const optText = `[${optIdx + 1}] ${opt.replace(/\*\*/g, '').replace(/`/g, '')}`;
            const optLines = doc.splitTextToSize(optText, maxLineWidth);
            checkPageBreak(optLines.length * 5);
            doc.text(optLines, margin + 5, y);
            y += (optLines.length * 5) + 2;
        });
        y += 5;
    } else if (q.type === QuestionType.CODING) {
         checkPageBreak(30);
         doc.setDrawColor(150, 150, 150);
         doc.rect(margin, y, maxLineWidth, 25);
         doc.text("[ Write Code Here ]", margin + 5, y + 5);
         y += 35;
    } else if (q.type === QuestionType.TRACING) {
        checkPageBreak(15);
        doc.setDrawColor(150, 150, 150);
        doc.line(margin, y + 10, margin + 100, y + 10);
        doc.text("Output:", margin, y + 8);
        y += 20;
    }
    
    y += 5;
  });

  // --- SOLUTIONS SECTION ---
  doc.addPage();
  y = 20;

  doc.setFontSize(18);
  doc.setFont("courier", "bold");
  doc.text("II. ANSWER KEY & EXPLANATIONS", margin, y);
  y += 15;

  questions.forEach((q, i) => {
      doc.setFontSize(11);
      doc.setFont("courier", "bold");
      checkPageBreak(20);
      doc.text(`Q${i+1} Answer:`, margin, y);
      
      let answerText = "";
      if (q.type === QuestionType.MCQ && q.options && q.correctOptionIndex !== undefined) {
          const correctOpt = q.options[q.correctOptionIndex].replace(/\*\*/g, '').replace(/`/g, '');
          answerText = `[${q.correctOptionIndex + 1}] ${correctOpt}`;
      } else if (q.type === QuestionType.TRACING) {
          answerText = q.tracingOutput || "N/A";
      } else {
          answerText = "See detailed explanation.";
      }
      
      doc.setFont("courier", "normal");
      const ansLines = doc.splitTextToSize(answerText, maxLineWidth - 40);
      doc.text(ansLines, margin + 35, y);
      y += (ansLines.length * 5) + 7;

      const expText = q.explanation.replace(/\*\*/g, '').replace(/`/g, '');
      const expLines = doc.splitTextToSize(expText, maxLineWidth);
      checkPageBreak(expLines.length * 5 + 10);
      
      doc.setFont("courier", "italic");
      doc.setFontSize(10);
      doc.text("Explanation:", margin, y);
      y += 5;
      doc.setFont("courier", "normal");
      doc.text(expLines, margin, y);
      y += (expLines.length * 5) + 15;
  });

  doc.save(`Z_Plus_Exam_Report_${Date.now()}.pdf`);
};
