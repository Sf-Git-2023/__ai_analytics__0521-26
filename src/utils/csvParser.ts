/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CSVData } from "../types";

/**
 * 依據 RFC 4180 標準解析 CSV 字串，能正確處理有雙引號包裹、引號逸出與逗號/換行的情形
 */
export function parseCSV(rawText: string): CSVData {
  const text = rawText.trim();
  if (!text) {
    return { headers: [], rows: [], raw: "" };
  }

  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // 雙引號轉義
          currentVal += '"';
          i++; // 跳過下一個引號
        } else {
          // 引號結束
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(currentVal.trim());
        currentVal = "";
      } else if (char === "\r" || char === "\n") {
        row.push(currentVal.trim());
        currentVal = "";
        
        if (row.length > 0 && (row.length > 1 || row[0] !== "")) {
          lines.push(row);
        }
        row = [];
        
        // 處理 Window 的 \r\n
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
      } else {
        currentVal += char;
      }
    }
  }

  // 處理最後一筆數據
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    if (row.length > 0 && (row.length > 1 || row[0] !== "")) {
      lines.push(row);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], raw: rawText };
  }

  const headers = lines[0].map((h, index) => h || `欄位 ${index + 1}`);
  const rows = lines.slice(1);

  return {
    headers,
    rows,
    raw: rawText,
  };
}

/**
 * 分析 CSV 欄位，回傳哪些欄位為「數值欄位（適合做 Y 軸）」、哪些適合做「X 軸（文字/日期等標籤）」
 */
export function analyzeColumns(csvData: CSVData) {
  const { headers, rows } = csvData;
  const numColumns = headers.length;
  
  const colTypes = Array(numColumns).fill({
    numericCount: 0,
    textCount: 0,
    totalCount: 0,
  });

  // 只抽取前 50 列進行型態推斷
  const sampleRows = rows.slice(0, 50);

  sampleRows.forEach((row) => {
    headers.forEach((_, colIdx) => {
      const val = row[colIdx];
      if (val === undefined || val === null || val === "") return;
      
      const stats = colTypes[colIdx];
      // 清理常見的貨幣、百分比符號以進行數值檢測
      const cleanedVal = val.replace(/[\$,¥,€,%, ,，]/g, "");
      const isNum = !isNaN(Number(cleanedVal)) && cleanedVal !== "";

      colTypes[colIdx] = {
        numericCount: stats.numericCount + (isNum ? 1 : 0),
        textCount: stats.textCount + (isNum ? 0 : 1),
        totalCount: stats.totalCount + 1,
      };
    });
  });

  const numericKeys: string[] = [];
  const labelKeys: string[] = [];

  headers.forEach((header, colIdx) => {
    const stats = colTypes[colIdx];
    if (stats.totalCount === 0) {
      labelKeys.push(header);
      return;
    }

    // 若數值占比大於 60% 則認定為數值欄位
    const numericRatio = stats.numericCount / stats.totalCount;
    if (numericRatio >= 0.6) {
      numericKeys.push(header);
    } else {
      labelKeys.push(header);
    }
  });

  // 如果發現沒有數值欄位，則預設所有欄位都可以選，避免報錯
  return {
    numericKeys: numericKeys.length > 0 ? numericKeys : headers,
    labelKeys: labelKeys.length > 0 ? labelKeys : headers,
  };
}
