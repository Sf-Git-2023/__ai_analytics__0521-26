import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

// 解析 JSON 封包大小上限，讓較大的 CSV 也能解析
app.use(express.json({ limit: "10mb" }));

// 延遲初始化 GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("警告：未檢測到 GEMINI_API_KEY 環境變數，AI 功能可能無法正常運作。");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 系統提示詞（System Instructions）
const SYSTEM_INSTRUCTIONS = `你是一位高階商業數據分析師與資料科學家。
你的任務是協助使用者分析貼上的 CSV 資料，並給出清晰、有條理、且最具洞察力的分析報告。

請嚴格遵守以下輸出規格與行為規範：
1. 語言限制：一律使用「繁體中文」（台灣用語慣例，例如：使用「數據」而非「數據」、使用「優化」而非「優化」、使用「專案」而非「項目」）。
2. 分析結構：
   - 💻【數據總覽與品質評估】：客觀描述資料筆數、欄位結構、是否有缺失值，並概述這份資料主要呈現的商業或學術主題。
   - 📊【核心指標與統計特徵】：提取關鍵指標，計算或估算主要的趨勢（如總和、平均、最大/最小值，若資料合適，可繪製 markdown 表格）。
   - 🔍【深度洞察與關聯趨勢】：深入探究資料中潛藏規律、時間趨勢、維度交叉對比、或明顯的異常值（Anomaly Detection），並提出可能的潛在致果原因。
   - 💡【具體可行的決策建議】：針對分析結果，提供 3-5 項具有商業價值、可實作、具體清晰的行動指引。
3. 格式要求：
   - 必須使用精美、大氣且整齊的 Markdown 格式排版。
   - 善加利用標題、分組列表、加粗、以及 Markdown 表格 (Tables) 來視覺化呈現數據。
   - 字裡行間請維持專業、客觀同時具有商業敏銳度的口吻。`;

// 數據分析 API 端點
app.post("/api/analyze", async (req, res) => {
  try {
    const { csvContent, customFocus, fileName } = req.body;

    if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
      return res.status(400).json({ error: "CSV 資料不可為空" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "伺服器未設定 GEMINI_API_KEY。請點選右上方「Settings > Secrets」設定金鑰。",
      });
    }

    const ai = getGeminiClient();

    // 彙整 User Prompt
    let userPrompt = `請分析以下 CSV 資料：`;
    if (fileName) {
      userPrompt += `\n檔案名稱：${fileName}`;
    }
    if (customFocus && customFocus.trim()) {
      userPrompt += `\n分析重點指定：${customFocus}`;
    }
    userPrompt += `\n\n--- CSV DATA START ---\n${csvContent}\n--- CSV DATA END ---`;

    console.log("正在呼叫 Gemini API 分析數據...");
    
    // 使用推薦的 gemini-3.5-flash 模型進行基礎數據分析
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        temperature: 0.3, // 低溫保持數據分析之嚴謹性與邏輯一致性
      },
    });

    const analysisResult = response.text;

    if (!analysisResult) {
      throw new Error("模型未回傳任何分析內容");
    }

    return res.json({
      success: true,
      analysis: analysisResult,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: error.message || "呼叫 AI 模型時發生未知錯誤，請稍後再試。",
    });
  }
});

// Vite 開發伺服器整合與生產環境靜態檔案
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] API 伺服器已成功啟動：http://localhost:${PORT}`);
    console.log(`[Server] 環境變數 GEMINI_API_KEY 狀態：${process.env.GEMINI_API_KEY ? "已設定" : "未設定！"}`);
  });
}

startServer();
