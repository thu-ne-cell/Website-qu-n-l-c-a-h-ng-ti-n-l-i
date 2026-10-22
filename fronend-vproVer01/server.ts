import express from "express";
import path from "path";
import fs from "fs";
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
  // Dev server and app container must run on port 3000
  const PORT = 3000;

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

  // Determine production mode: either explicit NODE_ENV=production or running start script
  const isDev = process.env.NODE_ENV === "development" || process.env.npm_lifecycle_event === "dev";

  if (isDev) {
    // Vite middleware for development
    app.use(express.static(process.cwd()));
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files from dist and root
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.use(express.static(process.cwd()));

    // Dedicated HTML routes
    app.get("/login", (req, res) => {
      const p = path.join(distPath, "login.html");
      res.sendFile(fs.existsSync(p) ? p : path.join(process.cwd(), "login.html"));
    });
    app.get("/pos", (req, res) => {
      const p = path.join(distPath, "pos.html");
      res.sendFile(fs.existsSync(p) ? p : path.join(process.cwd(), "pos.html"));
    });
    app.get("/dashboard", (req, res) => {
      const p = path.join(distPath, "dashboard.html");
      res.sendFile(fs.existsSync(p) ? p : path.join(process.cwd(), "dashboard.html"));
    });

    // SPA fallback
    app.get("*", (req, res) => {
      const cleanPath = req.path.replace(/^\//, "");
      if (cleanPath) {
        const inDist = path.join(distPath, cleanPath);
        if (fs.existsSync(inDist) && fs.statSync(inDist).isFile()) {
          return res.sendFile(inDist);
        }
        const inRoot = path.join(process.cwd(), cleanPath);
        if (fs.existsSync(inRoot) && fs.statSync(inRoot).isFile()) {
          return res.sendFile(inRoot);
        }
      }
      const indexFile = path.join(distPath, "index.html");
      res.sendFile(fs.existsSync(indexFile) ? indexFile : path.join(process.cwd(), "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (err: any) => {
    console.error("Server error:", err);
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received, closing server...");
    server.close(() => {
      process.exit(0);
    });
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

