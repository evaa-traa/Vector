/**
 * Export markdown content to a Word document (.docx)
 * Uses the docx library to create properly formatted documents
 */

import {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    Packer,
    AlignmentType
} from "docx";

/**
 * Simple markdown parser for converting to docx elements
 */
function parseMarkdown(markdown) {
    const lines = markdown.split("\n");
    const elements = [];
    let inCodeBlock = false;
    let codeContent = [];
    let inTable = false;
    let tableRows = [];
    let listItems = [];
    let listType = null; // "ul" or "ol"

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push({
                type: listType === "ol" ? "orderedList" : "bulletList",
                items: [...listItems]
            });
            listItems = [];
            listType = null;
        }
    };

    const flushTable = () => {
        if (tableRows.length > 0) {
            elements.push({
                type: "table",
                rows: [...tableRows]
            });
            tableRows = [];
            inTable = false;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Code block handling
        if (line.startsWith("```")) {
            if (inCodeBlock) {
                elements.push({
                    type: "codeBlock",
                    content: codeContent.join("\n")
                });
                codeContent = [];
                inCodeBlock = false;
            } else {
                flushList();
                flushTable();
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeContent.push(line);
            continue;
        }

        // Table handling
        if (line.includes("|") && line.trim().startsWith("|")) {
            flushList();
            const cells = line.split("|").slice(1, -1).map(c => c.trim());

            // Skip separator row
            if (cells.every(c => /^[-:]+$/.test(c))) {
                continue;
            }

            tableRows.push(cells);
            inTable = true;
            continue;
        } else if (inTable) {
            flushTable();
        }

        // Empty line
        if (!line.trim()) {
            flushList();
            continue;
        }

        // Headings
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            flushList();
            elements.push({
                type: "heading",
                level: headingMatch[1].length,
                content: headingMatch[2]
            });
            continue;
        }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(line.trim())) {
            flushList();
            elements.push({ type: "hr" });
            continue;
        }

        // Blockquote
        if (line.startsWith(">")) {
            flushList();
            elements.push({
                type: "blockquote",
                content: line.replace(/^>\s*/, "")
            });
            continue;
        }

        // Ordered list
        const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (olMatch) {
            if (listType === "ul") flushList();
            listType = "ol";
            listItems.push(olMatch[2]);
            continue;
        }

        // Unordered list
        const ulMatch = line.match(/^[-*+]\s+(.+)$/);
        if (ulMatch) {
            if (listType === "ol") flushList();
            listType = "ul";
            listItems.push(ulMatch[1]);
            continue;
        }

        // Regular paragraph
        flushList();
        elements.push({
            type: "paragraph",
            content: line
        });
    }

    // Flush any remaining items
    flushList();
    flushTable();

    return elements;
}

/**
 * Parse inline formatting (bold, italic, code, links)
 */
function parseInlineFormatting(text) {
    const runs = [];
    let remaining = text;

    while (remaining.length > 0) {
        // Bold and italic: ***text***
        let match = remaining.match(/^\*\*\*(.+?)\*\*\*/);
        if (match) {
            runs.push(new TextRun({ text: match[1], bold: true, italics: true }));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Bold: **text** or __text__
        match = remaining.match(/^(\*\*|__)(.+?)(\*\*|__)/);
        if (match) {
            runs.push(new TextRun({ text: match[2], bold: true }));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Italic: *text* or _text_
        match = remaining.match(/^(\*|_)(.+?)(\*|_)/);
        if (match) {
            runs.push(new TextRun({ text: match[2], italics: true }));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Inline code: `code`
        match = remaining.match(/^`([^`]+)`/);
        if (match) {
            runs.push(new TextRun({
                text: match[1],
                font: "Consolas",
                shading: { fill: "E8E8E8" }
            }));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Link: [text](url)
        match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (match) {
            runs.push(new TextRun({
                text: match[1],
                color: "0563C1",
                underline: {}
            }));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Regular text (take until next special character or end)
        match = remaining.match(/^[^*_`\[]+/);
        if (match) {
            runs.push(new TextRun({ text: match[0] }));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Single special character that didn't match formatting
        runs.push(new TextRun({ text: remaining[0] }));
        remaining = remaining.slice(1);
    }

    return runs;
}

/**
 * Convert parsed elements to docx sections
 */
function elementsToDocx(elements) {
    const children = [];

    for (const el of elements) {
        switch (el.type) {
            case "heading":
                const headingLevels = {
                    1: HeadingLevel.HEADING_1,
                    2: HeadingLevel.HEADING_2,
                    3: HeadingLevel.HEADING_3,
                    4: HeadingLevel.HEADING_4,
                    5: HeadingLevel.HEADING_5,
                    6: HeadingLevel.HEADING_6
                };
                children.push(
                    new Paragraph({
                        heading: headingLevels[el.level] || HeadingLevel.HEADING_1,
                        children: parseInlineFormatting(el.content)
                    })
                );
                break;

            case "paragraph":
                children.push(
                    new Paragraph({
                        children: parseInlineFormatting(el.content),
                        spacing: { after: 200 }
                    })
                );
                break;

            case "bulletList":
                for (const item of el.items) {
                    children.push(
                        new Paragraph({
                            bullet: { level: 0 },
                            children: parseInlineFormatting(item)
                        })
                    );
                }
                break;

            case "orderedList":
                for (let idx = 0; idx < el.items.length; idx++) {
                    children.push(
                        new Paragraph({
                            numbering: { reference: "default-numbering", level: 0 },
                            children: parseInlineFormatting(el.items[idx])
                        })
                    );
                }
                break;

            case "codeBlock":
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: el.content,
                                font: "Consolas",
                                size: 20
                            })
                        ],
                        shading: { fill: "F5F5F5" },
                        spacing: { before: 200, after: 200 }
                    })
                );
                break;

            case "blockquote":
                children.push(
                    new Paragraph({
                        children: parseInlineFormatting(el.content),
                        indent: { left: 720 },
                        border: {
                            left: { style: BorderStyle.SINGLE, size: 24, color: "CCCCCC" }
                        },
                        spacing: { before: 200, after: 200 }
                    })
                );
                break;

            case "table":
                const tableRows = el.rows.map((row, rowIdx) =>
                    new TableRow({
                        children: row.map(cell =>
                            new TableCell({
                                children: [new Paragraph({ children: parseInlineFormatting(cell) })],
                                shading: rowIdx === 0 ? { fill: "E8E8E8" } : undefined
                            })
                        )
                    })
                );
                children.push(
                    new Table({
                        rows: tableRows,
                        width: { size: 100, type: WidthType.PERCENTAGE }
                    })
                );
                break;

            case "hr":
                children.push(
                    new Paragraph({
                        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } },
                        spacing: { before: 400, after: 400 }
                    })
                );
                break;
        }
    }

    return children;
}

/**
 * Export markdown content to Word document and trigger download
 */
export async function exportToWord(markdown, filename = "document") {
    const elements = parseMarkdown(markdown);
    const children = elementsToDocx(elements);

    const doc = new Document({
        numbering: {
            config: [
                {
                    reference: "default-numbering",
                    levels: [
                        {
                            level: 0,
                            format: "decimal",
                            text: "%1.",
                            alignment: AlignmentType.START
                        }
                    ]
                }
            ]
        },
        sections: [
            {
                children
            }
        ]
    });

    const blob = await Packer.toBlob(doc);

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename.replace(/[^a-zA-Z0-9-_]/g, "_")}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
