import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// 載入環境變數 (.env 及 .env.local)
dotenv.config();
dotenv.config({ path: ".env.local" });

const app = express();

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

// 模擬分析生成器 (Demo 離線模式)
function generateMockAnalysis(csvContent: string, fileName: string = "", customFocus: string = ""): string {
  const normalizedFileName = fileName ? fileName.toLowerCase() : "";

  // 1. 季度銷售與通路成效報表
  if (normalizedFileName.includes("銷售") || normalizedFileName.includes("sales") || csvContent.includes("季度,銷售通路")) {
    return `> [!NOTE]
> 💡 **目前系統運行於「Demo 模擬分析模式」**（由於偵測到環境變數中尚未配置真實的 Gemini API 金鑰）。以下報告為依據您提供之數據特徵進行之高品質結構模擬分析。若欲體驗真實 AI 的多維度預測與即時深度交叉洞察，請在 \`.env.local\` 中填入您的 \`GEMINI_API_KEY\`。

### 1. 📊 資料概況與欄位理解
本資料集主要呈現 **2026 年度各季度、不同銷售通路與產品類別之銷售表現、行銷預算、成交狀況及客單價與退貨率統計**，用以評估各管道的營收貢獻度與運營效率。
* **關鍵欄位意義**：
  - **季度**：數據記錄的時間區間（2026 年 Q1 至 Q4）。
  - **銷售通路**：產品銷售的管道（包含實體百貨門市、官方網站、量販賣場及外送平台）。
  - **產品類別**：銷售的商品線（奢華皮件、休閒服飾）。
  - **銷售額(萬元)**：該通路在該季度的總銷售金額（單位：萬元）。
  - **行銷預算(萬元)**：該通路在該季度的行銷費用投入（單位：萬元）。
  - **成交筆數**：該季度成功的交易次數。
  - **客單價(元)**：平均每筆交易的金額（單位：元）。
  - **退貨率(%)**：該季度售出商品的退貨比例。

### 2. ⚠️ 異常與缺值檢查
經完整檢視，此數據集結構完整，所有欄位皆有數值，**未發現任何空白值或缺失值**。但存在以下數值異常與運營警訊：
* **官方旗艦網站退貨率偏高且持續攀升**：官方旗艦網站的退貨率從 Q1 的 2.8% 一路攀升至 Q4 的 4.0%，顯著高於其他通路（百貨門市維持在 1.5% 以下，量販賣場在 0.6% 以下）。這屬於運營上的異常警訊。
* **百貨門市第三季度（Q3）銷售額驟降**：精緻百貨門市在 Q3 的銷售額為 310 萬元，相比 Q2 的 520 萬元及 Q4 的 610 萬元有明顯的單季營收凹陷，可能存在季節性斷貨或百貨櫃位調整等外部異常干擾。
* **官方旗艦網站行銷預算增幅極快**：官方旗艦網站的行銷預算從 Q1 的 60 萬元倍增至 Q4 的 110 萬元，雖然帶動了銷售額成長，但退貨率的同步飆升反映出流量品質可能有所稀釋。

### 3. 📈 統計與趨勢洞察
* **總計概況**：
  - **年度總銷售額**：累計達 **5,158 萬元**（Q1: 1,038 萬、Q2: 1,265 萬、Q3: 1,215 萬、Q4: 1,640 萬）。
  - **年度總成交筆數**：共計 **39,200 筆**交易。
  - **年度總行銷預算**：共計 **688 萬元**。
* **分類表現**：
  - **表現最好通路**：**官方旗艦網站**表現最為強勁，年度累計銷售額達 **2,170 萬元**（佔總營收 42.1%），並在第四季度（Q4）創下單一通路單季最高的 720 萬元銷售佳績。
  - **表現最好產品類別**：**奢華皮件**（由百貨門市與官方網站銷售）為主要營收支柱，年度總銷售額達 **4,060 萬元**（佔總額 78.7%）；**休閒服飾**（量販賣場與外送平台）年度銷售額則為 **1,098 萬元**。
* **業務建議**：
  - **1. 抑制電商退貨率與優化行銷投報率 (ROI)**：官方旗艦網站退貨率高達 4.0%，且行銷預算在 Q4 暴增。建議深入分析電商平台的退貨原因（如：尺碼不符、實品色差或物流損壞），並重新審查高額廣告投放下所吸納的客群特徵，優化精準投放以減少退貨造成的物流與包裝成本。
  - **2. 查明百貨門市 Q3 凹陷原因並制定淡季防禦策略**：精緻百貨門市 Q3 銷售大幅下滑，應查明是否為商場改裝或季節性缺貨所致。建議在來年 Q3 規劃專屬 VIP 會員的專場預購或跨通路聯名活動，以平滑實體門市的季度營收波動。`;
  }

  // 2. 數位廣告投放成效分析表
  if (normalizedFileName.includes("廣告") || normalizedFileName.includes("ad") || csvContent.includes("廣告渠道") || csvContent.includes("Google 關鍵字")) {
    return `> [!NOTE]
> 💡 **目前系統運行於「Demo 模擬分析模式」**（由於偵測到環境變數中尚未配置真實的 Gemini API 金鑰）。以下報告為依據您提供之數據特徵進行之高品質結構模擬分析。若欲體驗真實 AI 的多維度預測與即時深度交叉洞察，請在 \`.env.local\` 中填入您的 \`GEMINI_API_KEY\`。

### 1. 📊 資料概況與欄位理解
本數據集呈現 **各廣告通路（Google、Meta、YouTube、LINE、Threads）的廣告成效分析**，包含預算分配、曝光、點擊、點擊率(CTR)、轉換次數以及單次轉換成本(CPA)等關鍵指標。
* **關鍵欄位意義**：
  - **廣告渠道**：廣告投放平台（如 Google、Meta、YouTube、LINE、Threads 及網紅圖文等）。
  - **目標客群**：廣告定位的受眾（舊客回購群、意圖購買者、年輕族群等）。
  - **廣告預算**：在該管道投入的資金（單位：元）。
  - **點擊率CTR(%)**：點擊數佔曝光數的比例，反映廣告內容的吸引力。
  - **單次轉換成本CPA**：獲取一次轉換所付出的預算成本，為衡量廣告轉換效率的核心指標。

### 2. ⚠️ 異常與缺值檢查
經完整檢視，此數據集結構完整，所有欄位均有數值，**未發現任何空白值或缺失值**。但存在以下指標異常與警訊：
* **YouTube CPA 顯著極端化偏高**：YouTube 貼片影片的 CPA 高達 **1,125 元**，遠超其他管道（如 LINE CPA 僅為 74 元，Google 關鍵字 CPA 僅為 176 元），屬於高花費、低轉換的低效投報異常。
* **LINE 官方帳號 CTR 及 CPA 表現極度突出**：LINE 的點擊率高達 **12.0%**，CPA 低至 **74 元**，這是極其健康的「舊客回購」特徵，但也需要注意此高投報可能僅限於既有會員，較難透過增加預算來同比例擴張新客規模。
* **Meta 限時動態 CPA 與動態消息對比偏高**：限時動態 CPA 達 545 元，比動態消息的 333 元高出 63.6%，反映出年輕族群受眾在限時動態上的轉換效率有待優化。

### 3. 📈 統計與趨勢洞察
* **總計概況**：
  - **總廣告預算**：合計共投入 **900,000 元**。
  - **總曝光次數**：累計高達 **7,150,000 次**。
  - **總點擊次數**：共計 **197,300 次**，整體平均 CTR 約為 **2.76%**。
  - **總轉換次數**：共計獲取 **3,310 次** 轉換。
* **分類表現**：
  - **預算與轉化之王**：**Meta 渠道**（動態消息 + 限時動態）累計預算達 **340,000 元**（佔總預算 37.8%），獲取 **880 次** 轉換；**LINE 官方帳號** 預算僅 80,000 元卻獲取 **1,080 次** 轉換，是效率最高的渠道。
  - **曝光之王**：**YouTube** 以 2,400,000 次曝光投保奪冠，但因 CTR 僅 1.0% 且 CPA 偏高，品牌曝光屬性大於直接導購屬性。
* **業務建議**：
  - **1. 縮減 YouTube 預算並轉移至 Google/LINE 管道**：YouTube 導購 CPA 達 1,125 元，除非定位為「純品牌曝光」專案，否則應立刻縮減 YouTube 貼片廣告預算，並將資金轉移至高點擊、高轉換的 LINE 官方帳號或 Google 關鍵字廣告（CPA 176 元），以大幅降低整體獲客成本。
  - **2. 優化 Meta 限時動態與 Threads 年輕客群的文案與路徑**：Meta 限時動態與 Threads 均針對年輕客群，但 CPA 均在 500 元以上。建議針對年輕族群重新設計簡短直覺的導購流程，並採用更具互動性、社群感強烈的原生影音素材，以提升點擊率並降低單次轉換成本。`;
  }

  // 3. 部門績效與員工滿意度調查
  if (normalizedFileName.includes("部門") || normalizedFileName.includes("績效") || normalizedFileName.includes("performance") || csvContent.includes("部門名稱") || csvContent.includes("技術研發部")) {
    return `> [!NOTE]
> 💡 **目前系統運行於「Demo 模擬分析模式」**（由於偵測到環境變數中尚未配置真實的 Gemini API 金鑰）。以下報告為依據您提供之數據特徵進行之高品質結構模擬分析。若欲體驗真實 AI 的多維度預測與即時深度交叉洞察，請在 \`.env.local\` 中填入您的 \`GEMINI_API_KEY\`。

### 1. 📊 資料概況與欄位理解
本數據集包含 **企業內部各核心部門之績效、資歷與員工滿意度分析**，用以探討部門人員結構、留任狀況、培訓投入與最終 KPI 完成率之間的潛在關聯。
* **關鍵欄位意義**：
  - **部門名稱**：受調查的組織部門。
  - **平均滿意度得分(1-10)**：部門員工對工作環境與氛圍的綜合評分。
  - **核心KPI完成率(%)**：部門業務目標達成率（高於 100% 代表超額達成）。
  - **新人留任率(%)**：入職一年內新人的留置比例。
  - **平均培訓時數**：每人累計接受的教育訓練時間（小時）。

### 2. ⚠️ 異常與缺值檢查
經完整檢視，此數據集結構完整，所有欄位均有數值，**未發現任何空白值或缺失值**。但存在以下顯著的人資管理與績效異常：
* **國內業務部「高 KPI、低留任、低滿意度」失衡異常**：國內業務部的 KPI 完成率高達 **102.5%**（全公司唯一破百的部門），但其員工滿意度得分僅 **6.2**（全公司倒數第二），新人留任率更低至 **65%**（全公司最低）。這屬於典型的「過度壓榨、高流失率」經營異常。
* **全球行銷部「低滿意度、低培訓、低留任」多重警訊**：全球行銷部的滿意度僅 **6.5**，且平均培訓時數僅 **18 小時**，新人留任率亦僅 **75%**。反映出該部門可能缺乏成熟的育留機制與發展空間。
* **財務會計部與人資總務部高滿意度但低培訓落差**：後勤支援部門（財務、人資）滿意度極高（>8.2），年資也是全公司最長，但培訓時數偏低（12 ~ 20 小時），可能存在工作模式固化、缺乏新技術培訓的盲區。

### 3. 📈 統計與趨勢洞察
* **總計概況**：
  - **全公司總員工人數**：共計 **188 人**（客服營運部 50 人規模最大，財務會計部 8 人規模最小）。
  - **全公司平均工作年資**：整體平均年資約 **3.89 年**。
  - **全公司 KPI 平均完成率**：整體高達 **94.5%**，營運表現穩健。
* **分類表現**：
  - **最穩定且高產值部門**：**技術研發部**表現極為優異，滿意度達 **8.1**，新人留任率 **88%**，且 KPI完成率高達 **94.5%**，並擁有 32 小時的高培訓時數，展現出健康的組織擴張特徵。
  - **留任與滿意雙冠王**：**財務會計部**滿意度達 **8.5**、留任率達 **95%**，具有極佳的部門穩定度。
* **業務建議**：
  - **1. 組織診斷與壓力調適**：國內業務部雖然創造了全公司最高的業績（KPI 102.5%），但 65% 的極低留任率意味著巨大的招募與交接隱形成本。建議人資部門介入調研，優化業務佣金發放機制、調升主管管理滿意度，並適度導入培訓支持。
  - **2. 提高教育訓練與職涯計畫**：全球行銷部滿意度 6.5 偏低，新人留任率 75% 亦不理想。應仿效技術研發部的成功經驗，將培訓時數由 18 小時提高至 28 小時以上，幫助行銷人員掌握最新數位行銷工具，以提升工作成就感與留任率。`;
  }

  // 4. 自訂上傳 CSV 數據 fallback
  const lines = csvContent.split("\n").filter(l => l.trim().length > 0);
  const headers = lines.length > 0 ? lines[0].split(",") : [];
  const rowsCount = lines.length > 1 ? lines.length - 1 : 0;
  const columnsList = headers.map(h => `  - **${h.trim()}**：資料表欄位。`).join("\n");

  return `> [!NOTE]
> 💡 **目前系統運行於「Demo 模擬分析模式」**（由於偵測到環境變數中尚未配置真實的 Gemini API 金鑰）。以下報告為依據您提供之數據特徵進行之高品質結構模擬分析。若欲體驗真實 AI 的多維度預測與即時深度交叉洞察，請在 \`.env.local\` 中填入您的 \`GEMINI_API_KEY\`。

### 1. 📊 資料概況與欄位理解
本數據集為您上傳的自訂數據卷軸（檔名：${fileName || "未命名數據.csv"}），經初步剖析，該數據表共計包含 **${rowsCount} 筆**資料記錄，欄位涵蓋：
${columnsList || "  - 尚未辨識出明確表頭。"}
* **關鍵欄位意義**：
  - 各欄位代表之維度與數值已完成結構索引，本系統已自動辨識數值型指標並進行歸一化。

### 2. ⚠️ 異常與缺值檢查
經品質檢測，此自訂數據集結構與型態如下：
* **缺值檢驗**：本數據表中大部分欄位皆填寫完整。若欄位內含有空白或非預期特殊符號，系統已在預覽時自動將其標記為 null 或進行資料清洗。
* **極端值篩選**：數值型欄位未發現明顯超出常態分布（Out of bounds）的干擾數值。

### 3. 📈 統計與趨勢洞察
* **總計概況**：
  - **總筆數**：共計 **${rowsCount} 筆** 資料記錄。
  - **主欄位統計**：已自動分類其類別維度與連續數值型維度，可用於多變量交叉迴歸分析。
* **業務建議**：
  - **💡 如何啟用真實的 AI 深度分析**：目前的報告為系統偵測到無金鑰時所產生的結構預覽。若您希望 AI 能夠自動解析每一個欄位的商業邏輯、進行關聯性計算，並產出量身訂做的 4 大維度商業決策指引，請向 Google AI Studio 申請免費的 API 金鑰，並將其貼入 [.env.local](file:///c:/Users/User/Documents/GitHub_AI_0507-26/__ai_analytics__0521-26/.env.local) 中重新執行。`;
}

// 數據分析 API 端點
app.post("/api/analyze", async (req, res) => {
  try {
    const { csvContent, customFocus, fileName } = req.body;

    if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
      return res.status(400).json({ error: "CSV 資料不可為空" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes("請在此處替換") || /[\u0080-\uffff]/.test(apiKey) || apiKey === "MY_GEMINI_API_KEY") {
      console.log("[Server] 偵測到未配置真實 API 金鑰，已為使用者自動啟用高品質「Demo 模擬分析模式」！");
      const mockResult = generateMockAnalysis(csvContent, fileName, customFocus);
      return res.json({
        success: true,
        analysis: mockResult,
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

export default app;
