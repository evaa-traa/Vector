import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Converts markdown content to a styled PDF document
 * @param {string} content - Markdown content
 * @param {string} filename - Name for the exported file (without extension)
 */
export async function exportToPdf(content, filename = "document") {
    // Create a temporary container to render the content
    const container = document.createElement("div");
    container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 210mm;
        padding: 20mm;
        background: white;
        color: black;
        font-family: 'Inter', 'Segoe UI', 'Arial', sans-serif;
        font-size: 12pt;
        line-height: 1.6;
    `;

    // Process the markdown content to HTML with basic styling
    const htmlContent = markdownToHtml(content);
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    try {
        // Wait for any images/fonts to load
        await new Promise(resolve => setTimeout(resolve, 100));

        // Capture the content as canvas
        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff"
        });

        // Create PDF
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        const pdf = new jsPDF("p", "mm", "a4");
        const imgData = canvas.toDataURL("image/png");

        // Add first page
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Add additional pages if content is longer than one page
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        // Save the PDF
        pdf.save(`${filename}.pdf`);
    } finally {
        // Clean up
        document.body.removeChild(container);
    }
}

/**
 * Converts markdown to styled HTML for PDF rendering
 * Handles common markdown syntax including LaTeX (as plain text for PDF)
 */
function markdownToHtml(markdown) {
    if (!markdown) return "";

    let html = markdown;

    // Escape HTML entities
    html = html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Convert LaTeX blocks to styled spans (rendered as formatted text)
    html = html.replace(/\$\$([^$]+)\$\$/g, '<div style="text-align: center; font-style: italic; padding: 10px; background: #f5f5f5; border-radius: 4px; margin: 10px 0;">$1</div>');
    html = html.replace(/\$([^$]+)\$/g, '<span style="font-style: italic; background: #f0f0f0; padding: 2px 4px; border-radius: 2px;">$1</span>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size: 14pt; font-weight: 600; margin: 16px 0 8px 0; color: #333;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size: 16pt; font-weight: 600; margin: 20px 0 10px 0; color: #222;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size: 20pt; font-weight: 700; margin: 24px 0 12px 0; color: #111; border-bottom: 1px solid #ddd; padding-bottom: 8px;">$1</h1>');

    // Bold and Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: Consolas, monospace; font-size: 11pt;">$1</code>');

    // Code blocks
    html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-family: Consolas, monospace; font-size: 10pt; overflow-x: auto; margin: 12px 0; border: 1px solid #e0e0e0;">$1</pre>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left: 3px solid #4a90d9; padding-left: 12px; margin: 12px 0; color: #555; font-style: italic;">$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li style="margin: 4px 0;">$1</li>');
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin: 10px 0; padding-left: 24px;">$&</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin: 4px 0;">$1</li>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #4a90d9; text-decoration: underline;">$1</a>');

    // Tables - parse markdown tables to HTML tables
    html = html.replace(/^(\|.+\|)\r?\n(\|[-:| ]+\|)\r?\n((?:\|.+\|\r?\n?)+)/gm, (match, headerRow, separatorRow, bodyRows) => {
        // Parse header cells
        const headers = headerRow.split('|').slice(1, -1).map(h => h.trim());

        // Parse alignment from separator row
        const alignments = separatorRow.split('|').slice(1, -1).map(sep => {
            const s = sep.trim();
            if (s.startsWith(':') && s.endsWith(':')) return 'center';
            if (s.endsWith(':')) return 'right';
            return 'left';
        });

        // Create header HTML
        const headerHtml = headers.map((h, i) =>
            `<th style="border: 1px solid #ddd; padding: 10px 12px; text-align: ${alignments[i] || 'left'}; background: #f5f5f5; font-weight: 600;">${h}</th>`
        ).join('');

        // Parse and create body rows
        const rows = bodyRows.trim().split('\n').map((row, rowIdx) => {
            const cells = row.split('|').slice(1, -1).map(c => c.trim());
            const cellsHtml = cells.map((c, i) =>
                `<td style="border: 1px solid #ddd; padding: 8px 12px; text-align: ${alignments[i] || 'left'};">${c}</td>`
            ).join('');
            return `<tr style="background: ${rowIdx % 2 === 0 ? '#fff' : '#fafafa'};">${cellsHtml}</tr>`;
        }).join('');

        return `<table style="border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 11pt;">
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    });

    // Paragraphs (handle line breaks)
    html = html.replace(/\n\n/g, '</p><p style="margin: 10px 0;">');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph tags
    html = `<p style="margin: 10px 0;">${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

    return `
        <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; }
        </style>
        ${html}
    `;
}
