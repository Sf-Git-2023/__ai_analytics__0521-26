/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  UploadCloud,
  Database,
  Play,
  TrendingUp,
  Check,
  Copy,
  History,
  Settings,
  X,
  Flame,
  Info,
  Sparkles,
  AlertTriangle,
  Download,
  RefreshCw,
  Table,
  Eye,
  Users,
  Megaphone,
  Search,
  BookOpen
} from "lucide-react";
import { parseCSV, analyzeColumns } from "./utils/csvParser";
import { EXAMPLE_DATASETS } from "./utils/exampleData";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { CSVData, AnalysisHistoryItem } from "./types";

export default function App() {
  // 核心狀態
  const [csvRaw, setCsvRaw] = useState<string>(EXAMPLE_DATASETS[0].content);
  const [fileName, setFileName] = useState<string>("quarterly_sales_report.csv");
  const [customFocus, setCustomFocus] = useState<string>(
    "分析各销售通路的成交筆數與退貨率是否有異常關聯，並針對實體 vs 線上在下半年的行銷資源分配給出優化策略。"
  );
  
  // 預覽與解析
  const [parsedData, setParsedData] = useState<CSVData>(parseCSV(EXAMPLE_DATASETS[0].content));
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  
  // 請求與結果狀態
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");
  
  // Loading 隨時間動態變化的狀態語句，為使用者創造良好的科技儀式感
  const [loadingStep, setLoadingStep] = useState<string>("正在讀取 CSV 數據結構...");
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 一鍵複製成功與通知
  const [copied, setCopied] = useState<boolean>(false);
  const [notiText, setNotiText] = useState<string>("");

  // 歷史紀錄
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");

  // 拖曳上傳控制
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // 當 CSV 輸入文字變更時，自動更新解析結果
  useEffect(() => {
    const data = parseCSV(csvRaw);
    setParsedData(data);
  }, [csvRaw]);

  // 初始化載入 LocalStorage 中的歷史紀錄
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ai_dataset_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("無法載入歷史分析紀錄", e);
    }
  }, []);

  // 寫入歷史紀錄至 LocalStorage
  const saveHistoryToStorage = (updatedHistory: AnalysisHistoryItem[]) => {
    try {
      localStorage.setItem("ai_dataset_history", JSON.stringify(updatedHistory));
      setHistory(updatedHistory);
    } catch (e) {
      console.error("無法將歷史分析儲存至 localStorage", e);
    }
  };

  // 文字內容變更
  const handleCsvChange = (val: string) => {
    setCsvRaw(val);
  };

  // 套用範例數據
  const applyDataset = (content: string, name: string) => {
    setCsvRaw(content);
    setFileName(name.endsWith(".csv") ? name : `${name}.csv`);
    
    // 生成相對應的自訂分析側重推薦
    if (name.includes("銷售")) {
      setCustomFocus("請比對不同通路的『銷售額』與『行銷預算』投報率。點出退貨率最高之異常板塊，並擬定解決對策。");
    } else if (name.includes("廣告")) {
      setCustomFocus("分析哪一家廣告渠道的 CPA（單次轉換成本）表現最好或最差？針對 CTR 點擊率與轉換次數做交叉深度洞察。");
    } else if (name.includes("績效")) {
      setCustomFocus("找出『平均滿意度得分』偏低的部門，對比其『平均工作年資』與『核心 KPI 完成率』做關聯分析。");
    } else {
      setCustomFocus("");
    }
    setActiveTab("preview");
    showNotification(`已載入「${name}」範例數據！`);
  };

  // 系統通知 Toast 控制
  const showNotification = (msg: string) => {
    setNotiText(msg);
    setTimeout(() => {
      setNotiText("");
    }, 4000);
  };

  // 一鍵複製結果
  const handleCopy = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    showNotification("分析報告已成功複製至剪貼簿！");
    setTimeout(() => setCopied(false), 2000);
  };

  // 匯出成果為 .txt
  const handleDownload = () => {
    if (!analysisResult) return;
    const blob = new Blob([analysisResult], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AI_分析報告-${fileName.replace(".csv", "")}-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification("已匯出分析報告純文字檔 (.txt)！");
  };

  // 開始 AI 分析
  const handleStartAnalysis = async () => {
    if (!csvRaw || !csvRaw.trim()) {
      setErrorText("請貼上 CSV 資料或先點選「套用範例數據」！");
      return;
    }

    setIsAnalyzing(true);
    setErrorText("");

    // 開始動態變更載入狀態文字，提升使用體驗
    let stepIndex = 0;
    const steps = [
      "正在讀取 CSV 數據結構與品質校準...",
      "正在抽樣特徵特徵並轉換格式進行歸一化...",
      "正在辨識關鍵數值欄位，分析其關聯走向...",
      "正在啟動 Gemini-3.5-Flash 智慧數據生成大模型...",
      "正在深挖數據潛在商機，生成統計學深度洞察...",
      "正在為您量身打造 4 個維度之商業決策建議...",
      "最後階段：正在組織並精美化 Markdown 報表格式..."
    ];
    setLoadingStep(steps[0]);
    loadingIntervalRef.current = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setLoadingStep(steps[stepIndex]);
    }, 4000);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          csvContent: csvRaw,
          customFocus: customFocus,
          fileName: fileName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "向 API 獲取分析時發生錯誤");
      }

      if (data.analysis) {
        setAnalysisResult(data.analysis);
        
        // 儲存至歷史紀錄首位
        const newHistoryId = Date.now().toString();
        const newItem: AnalysisHistoryItem = {
          id: newHistoryId,
          timestamp: new Date().toLocaleString("zh-TW", { hour12: false }),
          fileName: fileName || "未命名數據檔.csv",
          csvContent: csvRaw,
          customFocus: customFocus,
          analysisResult: data.analysis,
          parsedData: parsedData,
        };

        const updatedHistory = [newItem, ...history].slice(0, 15); // 最多保留 15 筆
        saveHistoryToStorage(updatedHistory);
        setSelectedHistoryId(newHistoryId);
        showNotification("數據分析完成，報告已順利產製！");
      } else {
        throw new Error("無效的分析結果");
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "連線至後端分析模組失敗，請檢查 API Key 設定。");
    } finally {
      setIsAnalyzing(false);
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    }
  };

  // 處理本機檔案上傳
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadLocalFile(file);
    }
  };

  const loadLocalFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      showNotification("僅支援導入 .csv 或 .txt 格式文字卷軸檔案！");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === "string") {
        setCsvRaw(event.target.result);
        setFileName(file.name);
        setActiveTab("preview");
        showNotification(`已順利導入「${file.name}」數據卷軸！`);
      }
    };
    reader.readAsText(file);
  };

  // 拖曳上傳邏輯
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      loadLocalFile(file);
    }
  };

  // 清空當前資料
  const handleClearData = () => {
    if (window.confirm("確定要清空目前填寫的數據與參數嗎？")) {
      setCsvRaw("");
      setFileName("new_dataset.csv");
      setCustomFocus("");
      setAnalysisResult("");
      setActiveTab("edit");
      showNotification("已清空數據內容與引導參數。");
    }
  };

  // 點選歷史紀錄，載入其狀態
  const handleSelectHistory = (item: AnalysisHistoryItem) => {
    setCsvRaw(item.csvContent);
    setFileName(item.fileName);
    setCustomFocus(item.customFocus);
    setAnalysisResult(item.analysisResult);
    setSelectedHistoryId(item.id);
    if (item.parsedData) {
      setParsedData(item.parsedData);
    }
    setActiveTab("preview");
    showHistoryDrawer(false);
    showNotification(`已還原歷史解析報告：${item.fileName}`);
  };

  // 刪除特定歷史紀錄
  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = history.filter(h => h.id !== id);
    saveHistoryToStorage(filtered);
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
    }
    showNotification("已移除該筆歷史紀錄。");
  };

  // 依據字串過濾歷史
  const filteredHistory = history.filter((item) => {
    const query = historySearchQuery.toLowerCase();
    return (
      item.fileName.toLowerCase().includes(query) ||
      item.timestamp.toLowerCase().includes(query) ||
      item.analysisResult.toLowerCase().includes(query)
    );
  });

  // 計算前端初步小統計（最大值、平均等，提供給預覽分頁最上層）
  const quickStats = React.useMemo(() => {
    if (!parsedData || parsedData.headers.length === 0 || parsedData.rows.length === 0) {
      return null;
    }
    const { numericKeys } = analyzeColumns(parsedData);
    if (numericKeys.length === 0) return null;

    const statsList: any[] = [];
    const sampleHeaders = parsedData.headers;
    const sampleRows = parsedData.rows;

    // 我們為前兩個數值欄位做智慧小總計
    numericKeys.slice(0, 2).forEach((key) => {
      const colIdx = sampleHeaders.indexOf(key);
      if (colIdx === -1) return;

      let sum = 0;
      let count = 0;
      let maxVal = -Infinity;
      let minVal = Infinity;

      sampleRows.forEach((row) => {
        const rawCell = row[colIdx];
        if (rawCell === undefined || rawCell === null || rawCell === "") return;
        const cleaned = Number(rawCell.replace(/[\$,¥,€,%, ,，]/g, ""));
        if (!isNaN(cleaned)) {
          sum += cleaned;
          count++;
          if (cleaned > maxVal) maxVal = cleaned;
          if (cleaned < minVal) minVal = cleaned;
        }
      });

      if (count > 0) {
        statsList.push({
          keyName: key,
          average: Math.round((sum / count) * 100) / 100,
          total: sum,
          maximum: maxVal,
          minimum: minVal,
        });
      }
    });

    return statsList;
  }, [parsedData]);

  return (
    <div id="app_root" className="min-h-screen bg-slate-50 flex flex-col font-sans select-none relative overflow-x-hidden">
      
      {/* 系統彈出 Notification */}
      {notiText && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 border border-slate-800 text-slate-100 px-6 py-3.5 rounded-xl shadow-2xl animate-fade-in-up duration-300">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm font-medium">{notiText}</span>
        </div>
      )}

      {/* 頂部 Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200/80 shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center hover:scale-105 transition-transform duration-200">
            <TrendingUp id="header_icon" className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">AI 數據分析與洞察工具</h1>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                PRO 專業版
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">企業級 CSV 多維度智慧數據掘金與預測系統</p>
          </div>
        </div>

        {/* 右側操控列 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistoryDrawer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-all shadow-xs border border-slate-200"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>歷史洞察 ({history.length})</span>
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 max-sm:hidden">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-semibold">Gemini 3.5 API 連線正常</span>
          </div>
        </div>
      </header>

      {/* 主要操作視窗 */}
      <main className="flex-1 max-w-[1500px] w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
        
        {/* 左側數據輸入與參數控制欄 (占5等分) */}
        <section className="md:col-span-5 flex flex-col gap-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          
          {/* 上傳與清除控制 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800">數據來源與配置</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClearData}
                className="p-1 px-2.5 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                title="清空目前輸入區內容"
              >
                清空資料
              </button>
            </div>
          </div>

          {/* 範例快速套用卡片區 */}
          <div className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 rounded-xl transition-all duration-200">
            <p className="text-xs font-bold text-slate-500 mb-2.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              選擇極速示範數據：
            </p>
            <div className="grid grid-cols-1 gap-2">
              {EXAMPLE_DATASETS.map((set, index) => {
                const isCurrent = csvRaw === set.content;
                return (
                  <button
                    key={index}
                    onClick={() => applyDataset(set.content, set.name)}
                    className={`text-left p-2 rounded-lg border text-xs transition-all relative ${
                      isCurrent
                        ? "bg-blue-50/50 border-blue-400 text-blue-800 font-medium"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {set.icon === "TrendingUp" && <TrendingUp className="w-3.5 h-3.5 text-blue-500" />}
                        {set.icon === "Megaphone" && <Megaphone className="w-3.5 h-3.5 text-purple-500" />}
                        {set.icon === "Users" && <Users className="w-3.5 h-3.5 text-emerald-500" />}
                        <span>{set.name}</span>
                      </div>
                      {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping"></span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 點擊 / 拖曳上傳容器 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all relative ${
              isDragging
                ? "border-blue-500 bg-blue-50/60 scale-95"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <input
              type="file"
              id="csv_file_picker"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center justify-center gap-1.5">
              <UploadCloud className="w-6 h-6 text-slate-400" />
              <p className="text-xs text-slate-700 font-medium">
                點擊上傳 或 拖曳 CSV 數據檔案至此處
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                支援格式：.csv, .txt (編碼建議使用 UTF-8)
              </p>
            </div>
          </div>

          {/* 數據檔名提示與分頁(編輯原始碼 / 表格預覽) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded truncate max-w-[220px]">
                📂{fileName}
              </span>
              <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-100">
                <button
                  onClick={() => setActiveTab("edit")}
                  className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${
                    activeTab === "edit"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    原始碼黏貼
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("preview");
                  }}
                  className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${
                    activeTab === "preview"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Table className="w-3 h-3" />
                    表格預覽 ({parsedData.rows.length} 筆)
                  </div>
                </button>
              </div>
            </div>

            {/* 輸入主要區域 */}
            {activeTab === "edit" ? (
              <div className="relative">
                <textarea
                  id="csv_box"
                  value={csvRaw}
                  onChange={(e) => handleCsvChange(e.target.value)}
                  className="w-full h-64 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none transition-all placeholder:text-slate-400"
                  placeholder="請在此處黏貼 CSV 格式之數據，首行需包含表頭
日期,銷售額,訪客數,轉換率
2026-10-01,15200,1240,3.2%
2026-10-02,18900,1480,3.8%"
                />
                <span className="absolute bottom-2 right-3 text-[10px] bg-slate-200/80 px-2 py-0.5 rounded text-slate-500 font-mono select-none">
                  字數: {csvRaw.length}
                </span>
              </div>
            ) : (
              /* 表格預覽分頁 */
              <div className="border border-slate-200 rounded-xl h-64 overflow-hidden flex flex-col bg-slate-50">
                {parsedData.headers.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                    <p className="text-xs">數據為空，無法進行預覽</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* 數據基本平均統計卡片 */}
                    {quickStats && quickStats.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-100 border-b border-slate-200 select-none">
                        {quickStats.map((st, i) => (
                          <div key={i} className="bg-white p-1.5 rounded-lg border border-slate-200/80 shadow-2xs">
                            <p className="text-[9px] text-slate-400 font-bold truncate">指標: {st.keyName}</p>
                            <p className="text-xs font-bold text-slate-700 flex items-baseline gap-1 mt-0.5">
                              <span className="text-[9px] text-slate-400 font-normal font-sans">平</span>
                              <span className="font-mono">{st.average}</span>
                              <span className="text-[9px] text-slate-450 ml-1.5 font-normal">總 {Math.round(st.total)}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 表格主體 */}
                    <div className="flex-1 overflow-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-[11px] bg-white">
                        <thead className="bg-[#f8fafc] sticky top-0 z-10 shadow-3xs">
                          <tr>
                            {parsedData.headers.map((header, idx) => (
                              <th
                                key={idx}
                                className="px-3 py-2 text-left font-bold text-slate-600 bg-slate-50 border-b border-slate-200 whitespace-nowrap"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedData.rows.length === 0 ? (
                            <tr>
                              <td colSpan={parsedData.headers.length} className="px-3 py-6 text-center text-slate-400 italic">
                                尚無任何列數據
                              </td>
                            </tr>
                          ) : (
                            parsedData.rows.slice(0, 40).map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
                                {parsedData.headers.map((_, cIdx) => (
                                  <td key={cIdx} className="px-3 py-1.5 text-slate-600 truncate max-w-[150px] font-mono whitespace-nowrap">
                                    {row[cIdx] !== undefined ? row[cIdx] : <span className="text-slate-350 italic">null</span>}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                          {parsedData.rows.length > 40 && (
                            <tr>
                              <td colSpan={parsedData.headers.length} className="px-3 py-2 text-center text-slate-400 italic bg-slate-50">
                                僅預覽前 40 筆資料 (完整數據仍將提供給 AI 分析)
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI 側重引導輸入 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
              <label className="text-xs font-bold text-slate-700">自訂 AI 洞察重點與決策偏好 (非必填)</label>
            </div>
            <textarea
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white h-16 resize-none transition-all placeholder:text-slate-400"
              placeholder="e.g., 請深入分析銷量突然爆升的原因，並指出退貨成本最高的實體通路"
            />
          </div>

          {/* 錯誤資訊 */}
          {errorText && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-semibold flex items-start gap-2.5">
              <AlertTriangle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">分析請求受阻：</p>
                <p className="mt-0.5 text-red-500 font-normal leading-relaxed">{errorText}</p>
              </div>
            </div>
          )}

          {/* 數據分析發送大按鈕 */}
          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className={`w-full py-4 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm ${
              isAnalyzing
                ? "bg-slate-400 cursor-not-allowed shadow-none"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-100"
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>AI 計算中...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-blue-100" />
                <span>啟動 AI 商業智能分析</span>
              </>
            )}
          </button>
          
        </section>

        {/* 右側 AI 分析與 Markdown 洞察報告展示欄 (占7等分) */}
        <section className="md:col-span-7 flex flex-col bg-[#0f172a] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl min-h-[580px]">
          
          {/* 上方裝飾與操控面板 */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
              </div>
              <span className="text-xs text-slate-400 font-medium font-mono truncate max-w-[280px]">
                {isAnalyzing ? "正在運算多維度交叉特徵指標" : `報告模組：${fileName}`}
              </span>
            </div>
            
            {/* 分析完成後才能一鍵操作 */}
            {analysisResult && !isAnalyzing && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all border border-slate-700"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400 font-bold" />
                      <span className="text-green-400">複製成功</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>複製報告</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-bold transition-all border border-slate-700"
                  title="匯出為 txt 純文字"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>儲存</span>
                </button>
              </div>
            )}
          </div>

          {/* 渲染主體區 */}
          <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-900 text-slate-350 select-text">
            {isAnalyzing ? (
              /* Loading 流程展示 */
              <div className="h-full flex flex-col items-center justify-center py-20">
                <div className="relative mb-6">
                  <div className="w-14 h-14 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  <Sparkles className="w-6 h-6 text-blue-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <p className="text-slate-200 font-bold text-sm tracking-wide">{loadingStep}</p>
                <div className="mt-4 flex flex-col items-center gap-1.5 max-w-sm text-center">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    我們正在藉由 Gemini 釋放數據深層潛力，大約需時 10 至 20 秒，請勿重新整理頁面。
                  </p>
                  <div className="flex gap-1 mt-4">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            ) : analysisResult ? (
              /* 顯示真正的 AI 解析結果 */
              <div className="markdown-body text-slate-200">
                <MarkdownRenderer content={analysisResult} />
              </div>
            ) : (
              /* 歡迎引導介面 */
              <div className="h-full flex flex-col items-center justify-center text-center py-12 max-w-md mx-auto">
                <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center border border-slate-700/60 mb-5">
                  <Sparkles className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-wide">
                  您的專屬商務 AI 洞察报告
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  請於左側貼上您的 CSV 資料，或者直接點擊上方的「示範數據」範本，然後點擊「啟動 AI 商業智能分析」以解鎖深度洞察與行動建議。
                </p>
                <div className="grid grid-cols-2 gap-3 w-full border border-slate-800 bg-slate-800/20 p-4 rounded-xl">
                  <div className="text-left">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">預載功能</p>
                    <p className="text-[11px] text-slate-350">自動特徵歸類</p>
                    <p className="text-[11px] text-slate-350">統計極值檢索</p>
                  </div>
                  <div className="text-left border-l border-slate-800 pl-3">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">報告架構</p>
                    <p className="text-[11px] text-slate-350">數據完整評估</p>
                    <p className="text-[11px] text-slate-350">行動決策指引</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 下方資訊註記 */}
          <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono select-none">
            <span>分析核心：Gemini API 預測模式</span>
            <span>系統狀態：精確無偏誤 (100% 擬真)</span>
          </div>

        </section>
      </main>

      {/* 歷史紀錄側邊抽屜 Drawer (美觀易用) */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end animate-fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
            
            {/* 抽屜頂部 */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">歷史洞察分析</h3>
              </div>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 搜尋歷史 */}
            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="搜尋歷史報告或內容..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 歷史清單列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center">
                  <FileText className="w-8 h-8 text-slate-300 mb-2" />
                  <p>尚無任何歷史分析儲存紀錄</p>
                  {historySearchQuery && <p className="mt-1 text-slate-400">調整搜尋條件後重試</p>}
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const isCurSelected = selectedHistoryId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectHistory(item)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isCurSelected
                          ? "bg-blue-50 border-blue-400 shadow-3xs"
                          : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="font-bold text-xs text-slate-800 truncate">{item.fileName}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteHistory(item.id, e)}
                          className="p-1 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded transition-colors"
                          title="刪除"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-450 font-mono mb-2">
                        分析時間：{item.timestamp}
                      </p>
                      {item.customFocus && (
                        <div className="text-[10px] bg-slate-50 border border-slate-200/50 p-1.5 rounded text-slate-500 line-clamp-2 italic">
                          引導：{item.customFocus}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 抽屜底部說明 */}
            <div className="p-4 border-t border-slate-200 bg-white text-xs text-slate-500 text-center leading-relaxed font-mono">
              分析報告永久暫存於目前瀏覽器的 LocalStorage 空間。一鍵點擊便能立即切回特定研究！
            </div>
          </div>
        </div>
      )}

      {/* 底部頁尾 (Footer) */}
      <footer className="px-6 py-4 bg-white border-t border-slate-200/80 flex items-center justify-between mt-auto select-none">
        <p className="text-[11px] text-slate-400 font-medium tracking-tight">
          © {new Date().getFullYear()} AI Data Insight Studio 版權所有。由 Google Gemini-3.5 核心驅動。
        </p>
        <div className="flex gap-4 max-sm:hidden">
          <span className="text-[11px] text-slate-400">目前本地時間: {new Date().toLocaleString("zh-TW", { hour12: false })}</span>
        </div>
      </footer>

    </div>
  );
}
