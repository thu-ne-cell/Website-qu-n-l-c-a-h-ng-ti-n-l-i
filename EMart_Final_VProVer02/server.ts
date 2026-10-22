import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      geminiClient = new GoogleGenAI({ apiKey });
    }
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "Emart StorePOS Service"
    });
  });

  // AI Retail advisor endpoint (uses Gemini model safely)
  app.post("/api/ai/retail-advice", async (req, res) => {
    try {
      const { prompt, context } = req.body;
      const client = getGeminiClient();

      if (!client) {
        return res.status(503).json({
          error: "GEMINI_API_KEY chưa được cấu hình trên máy chủ.",
          fallbackAdvice: "Vui lòng kiểm tra cấu hình biến môi trường GEMINI_API_KEY trong AI Studio Settings."
        });
      }

      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Bạn là trợ lý AI chuyên gia bán lẻ cho Cửa hàng tiện lợi Emart.
Dưới đây là thông tin câu hỏi/yêu cầu:
${prompt || "Tối ưu hóa bán lẻ và quản lý tồn kho hạn dùng FEFO"}

Thông tin ngữ cảnh bổ sung:
${JSON.stringify(context || {})}

Hãy đưa ra lời khuyên ngắn gọn, thực tế, đúng nghiệp vụ quản lý cửa hàng tiện lợi.`
              }
            ]
          }
        ]
      });

      const text = response.text || "Không có phản hồi từ AI";
      return res.json({ result: text });
    } catch (err: any) {
      console.error("Gemini AI API Error:", err);
      return res.status(500).json({ error: err?.message || "Lỗi xử lý AI" });
    }
  });

  // Serve static files from root directory
  app.use(express.static(process.cwd()));

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
