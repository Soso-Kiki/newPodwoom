import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function openaiProxyPlugin(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  const geminiKey  = env.GOOGLE_API_KEY  || "";
  const openaiKey  = env.OPENAI_API_KEY  || "";
  const openaiModel = env.OPENAI_MODEL   || "gpt-4o-mini";

  const attachMiddleware = (server) => {
    server.middlewares.use("/api/openai", async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: { message: "Method not allowed" } }));
        return;
      }

      try {
        let rawBody = "";
        for await (const chunk of req) rawBody += chunk;

        // ── 1순위: OpenAI ─────────────────────────────────
        if (openaiKey) {
          const bodyObj = JSON.parse(rawBody);
          bodyObj.model = openaiModel;

          const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
            body: JSON.stringify(bodyObj),
          });

          if (openaiRes.ok) {
            const text = await openaiRes.text();
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(text);
            return;
          }
          console.warn(`[proxy] OpenAI 실패 (${openaiRes.status}) → Gemini 차선책 시도`);
        }

        // ── 2순위: Gemini (폴백) ──────────────────────────
        if (!geminiKey) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: { message: "OpenAI 실패, GOOGLE_API_KEY도 없음" } }));
          return;
        }

        const geminiRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${geminiKey}` },
            body: rawBody,
          }
        );

        const text = await geminiRes.text();
        res.statusCode = geminiRes.ok ? 200 : geminiRes.status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(text);
      } catch (error) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({
          error: { message: error instanceof Error ? error.message : "Unknown server error" },
        }));
      }
    });
  };

  return {
    name: "openai-proxy",
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  };
}

// 통합 Express 서버(3001)로 프록시할 경로 목록
const UNIFIED_SERVER = "http://localhost:3001";

export default defineConfig(({ mode }) => ({
  plugins: [react(), openaiProxyPlugin(mode)],
  server: {
    proxy: {
      // ── 챗봇1 / 챗봇2 ─────────────────────────────────
      "/api/chat":        { target: UNIFIED_SERVER, changeOrigin: true },
      "/api/stock-chat":  { target: UNIFIED_SERVER, changeOrigin: true },

      // ── 채팅 기록 / 세션 / 매매일지 ───────────────────
      "/api/chat-history": { target: UNIFIED_SERVER, changeOrigin: true },
      "/api/sessions":     { target: UNIFIED_SERVER, changeOrigin: true },
      "/api/trade-journal":{ target: UNIFIED_SERVER, changeOrigin: true },

      // ── Yahoo Finance CORS 우회 (통합 서버 경유) ───────
      "/api/yahoo": { target: UNIFIED_SERVER, changeOrigin: true },

      // ── 헬스 체크 ──────────────────────────────────────
      "/health": { target: UNIFIED_SERVER, changeOrigin: true },
    },
  },
}));
