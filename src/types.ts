/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CSVData {
  headers: string[];
  rows: string[][];
  raw: string;
}

export interface ChartConfig {
  xAxisKey: string;
  yAxisKey: string;
  chartType: "bar" | "line" | "scatter" | "pie";
}

export interface AnalysisHistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  csvContent: string;
  customFocus: string;
  analysisResult: string;
  parsedData?: CSVData;
}

export interface ExampleDataset {
  name: string;
  description: string;
  icon: string;
  content: string;
}
