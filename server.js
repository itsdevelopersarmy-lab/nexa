import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();

  // Render uses dynamic port
  const PORT = process.env.PORT || 3000;

  // =========================================
  // Middleware
  // =========================================

  app.use(cors());

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));

  // =========================================
  // Health Check
  // =========================================

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      engine: "neural-clean",
      domain: "nexverra.in",
    });
  });

  // =========================================
  // TTS API
  // =========================================

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice } = req.body;

      if (!text) {
        return res.status(400).json({
          error: "Text is required",
        });
      }

      const response = await fetch("https://freetts.org/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Origin: "https://freetts.org",
          Referer: "https://freetts.org/",
        },
        body: JSON.stringify({
          text,
          voice: voice || "en-US-JennyNeural",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `External API responded with status ${response.status}`
        );
      }

      const data = await response.json();

      if (data.file_id) {
        return res.json({
          success: true,
          file_id: data.file_id,

          // Full Render URL
          url: `https://nexa-9wg3.onrender.com/api/audio/${data.file_id}`,
        });
      }

      return res.json(data);
    } catch (error) {
      console.error("TTS Error:", error);

      return res.status(500).json({
        error: error.message || "Failed to generate speech",
      });
    }
  });

  // =========================================
  // Audio Proxy
  // =========================================

  app.get("/api/audio/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;

      const response = await fetch(
        `https://freetts.org/api/audio/${fileId}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Referer: "https://freetts.org/",
          },
        }
      );

      if (!response.ok) {
        return res.status(response.status).send("Failed");
      }

      res.setHeader("Content-Type", "audio/mpeg");

      const arrayBuffer = await response.arrayBuffer();

      return res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Audio Proxy Error:", error);

      return res.status(500).send("Error");
    }
  });

  // =========================================
  // Production Frontend
  // =========================================

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // =========================================
  // Development Vite Server
  // =========================================

  else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
  }

  // =========================================
  // Start Server
  // =========================================

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`
=========================================
🚀 NexVerra Server Running
🌐 Frontend: https://nexverra.in
⚡ Backend: https://nexa-9wg3.onrender.com
📡 Port: ${PORT}
=========================================
`);
  });
}

startServer();
