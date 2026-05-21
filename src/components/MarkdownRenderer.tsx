/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = useMemo(() => {
    if (!content) return [];

    // 先將 \r\n 轉為 \n
    const normalized = content.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    
    const parsedBlocks: any[] = [];
    let currentBlockType: "paragraph" | "list" | "table" | "none" = "none";
    let blockBuffer: string[] = [];

    const flushBuffer = () => {
      if (blockBuffer.length === 0) return;
      
      if (currentBlockType === "paragraph") {
        parsedBlocks.push({
          type: "paragraph",
          content: blockBuffer.join("\n"),
        });
      } else if (currentBlockType === "list") {
        parsedBlocks.push({
          type: "list",
          items: [...blockBuffer],
        });
      } else if (currentBlockType === "table") {
        parsedBlocks.push({
          type: "table",
          rows: [...blockBuffer],
        });
      }
      blockBuffer = [];
      currentBlockType = "none";
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 1. 處理標題
      if (trimmed.startsWith("#")) {
        flushBuffer();
        const level = (trimmed.match(/^#+/) || ["#"])[0].length;
        const text = trimmed.replace(/^#+\s*/, "");
        parsedBlocks.push({
          type: "heading",
          level,
          text,
        });
        continue;
      }

      // 2. 處理分隔線
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        flushBuffer();
        parsedBlocks.push({ type: "hr" });
        continue;
      }

      // 3. 處理表格
      if (trimmed.startsWith("|")) {
        if (currentBlockType !== "table") {
          flushBuffer();
          currentBlockType = "table";
        }
        blockBuffer.push(line);
        continue;
      }

      // 4. 處理清單
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.match(/^\d+\.\s/)) {
        if (currentBlockType !== "list") {
          flushBuffer();
          currentBlockType = "list";
        }
        blockBuffer.push(line);
        continue;
      }

      // 5. 處理空行
      if (trimmed === "") {
        flushBuffer();
        continue;
      }

      // 6. 其他均歸類為段落
      if (currentBlockType !== "paragraph") {
        flushBuffer();
        currentBlockType = "paragraph";
      }
      blockBuffer.push(line);
    }

    // 處理剩餘的 border buffer
    flushBuffer();
    return parsedBlocks;
  }, [content]);

  // 行內格式替換 (如 **bold**, *italic*, `code`)
  const renderInlineStyles = (text: string) => {
    if (!text) return "";
    
    // 簡單防範 HTML 注入，將 < > 逸出
    let safeText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 替換 🌟 裝飾標記 (很多 AI 喜歡在標示上放 emoji，這很棒，保留)
    
    // 1. 替換雙引號程式碼 `code`
    safeText = safeText.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-red-500 font-mono text-sm inline-block">$1</code>');

    // 2. 替換粗體 **bold** 與 __bold__
    safeText = safeText.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
    safeText = safeText.replace(/__([^_]+)__/g, '<strong class="font-semibold text-slate-900">$1</strong>');

    // 3. 替換斜體 *italic*
    safeText = safeText.replace(/\*([^*]+)\*/g, '<em class="italic text-slate-700">$1</em>');

    return <span dangerouslySetInnerHTML={{ __html: safeText }} />;
  };

  const renderTableBlock = (rows: string[]) => {
    // 過濾掉分割行（如 |---|---| ）
    const dataRows = rows.filter(r => !r.match(/^[|\s-]+$/));
    if (dataRows.length === 0) return null;

    const parseTableRow = (rawRow: string) => {
      const parts = rawRow.split("|");
      // 去除第一和最後一個空元素（因為開頭和結尾有 |）
      if (parts[0].trim() === "") parts.shift();
      if (parts[parts.length - 1].trim() === "") parts.pop();
      return parts.map(p => p.trim());
    };

    const headerCells = parseTableRow(dataRows[0]);
    const bodyRows = dataRows.slice(1).map(parseTableRow);

    return (
      <div className="my-6 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {headerCells.map((cell, idx) => (
                  <th
                    key={idx}
                    scope="col"
                    className="px-6 py-3.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    {renderInlineStyles(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {bodyRows.map((rowCells, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                  {rowCells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-600">
                      {renderInlineStyles(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderListBlock = (items: string[]) => {
    return (
      <ul className="my-4 space-y-2.5 pl-6 list-none">
        {items.map((item, idx) => {
          const isOrdered = item.trim().match(/^\d+\.\s/);
          let bullet: React.ReactNode = <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 mt-2" />;
          let cleanText = item.trim();

          if (isOrdered) {
            const numMatch = cleanText.match(/^(\d+)\.\s/);
            const num = numMatch ? numMatch[1] : `${idx + 1}`;
            bullet = <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mr-1.5 shrink-0">{num}</span>;
            cleanText = cleanText.replace(/^\d+\.\s*/, "");
          } else {
            bullet = <span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-2 shrink-0 self-center" />;
            cleanText = cleanText.replace(/^[-*]\s*/, "");
          }

          return (
            <li key={idx} className="flex items-start text-slate-600 leading-relaxed text-sm">
              {bullet}
              <span className="flex-1">{renderInlineStyles(cleanText)}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-5 text-slate-850">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading": {
            if (block.level === 1) {
              return (
                <h1 key={idx} className="text-2xl font-bold text-slate-900 border-b border-slate-200 pb-2 mt-8 mb-4">
                  {renderInlineStyles(block.text)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2 key={idx} className="text-xl font-bold text-slate-800 flex items-center gap-2 mt-7 mb-3">
                  <span className="h-5 w-1.5 bg-blue-500 rounded-full inline-block shrink-0" />
                  {renderInlineStyles(block.text)}
                </h2>
              );
            }
            // level >= 3
            return (
              <h3 key={idx} className="text-base font-semibold text-slate-705 flex items-center mt-5 mb-2 pl-2 border-l-2 border-slate-300">
                {renderInlineStyles(block.text)}
              </h3>
            );
          }
          case "table":
            return <React.Fragment key={idx}>{renderTableBlock(block.rows)}</React.Fragment>;
          case "list":
            return <React.Fragment key={idx}>{renderListBlock(block.items)}</React.Fragment>;
          case "hr":
            return <hr key={idx} className="my-8 border-slate-200" />;
          case "paragraph":
          default:
            return (
              <p key={idx} className="text-slate-600 leading-relaxed text-sm whitespace-pre-line my-3">
                {renderInlineStyles(block.content)}
              </p>
            );
        }
      })}
    </div>
  );
}
