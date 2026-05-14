import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", engine: "neural-clean" });
  });

  // API Proxy for FreeTTS
  app.post("/api/tts", async (req, res) => {
    const { text, voice } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    try {
      const response = await fetch("https://freetts.org/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Origin": "https://freetts.org",
          "Referer": "https://freetts.org/",
        },
        body: JSON.stringify({
          text,
          voice: voice || "en-US-JennyNeural",
        }),
      });

      if (!response.ok) {
        throw new Error(`External API responded with status ${response.status}`);
      }

      const data = await response.json();

      if (data.file_id) {
        return res.json({ 
          file_id: data.file_id,
          url: `/api/audio/${data.file_id}`
        });
      }

      res.json(data);
    } catch (error) {
      console.error("TTS Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate speech" });
    }
  });

  // Proxy for audio to avoid CORS
  app.get("/api/audio/:fileId", async (req, res) => {
    const { fileId } = req.params;
    try {
      const response = await fetch(`https://freetts.org/api/audio/${fileId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://freetts.org/",
        }
      });

      if (!response.ok) return res.status(response.status).send("Failed");

      res.setHeader("Content-Type", "audio/mpeg");
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      res.status(500).send("Error");
    }
  });

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
