import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import app from "./app";

const PORT = 3000;

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
