import "dotenv/config";
import express from "express";
import cors from "cors";

import scannerRouter from "./routes/scanner.routes.js";
import marketScannerRouter from "./routes/market-scanner.routes.js";
import backtestRouter from "./routes/backtest.routes.js";
import multiBacktestRouter from "./routes/multi-backtest.routes.js";
import signalHistoryRouter from "./routes/signal-history.routes.js";
import authRouter from "./routes/auth.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import intelligenceRouter from "./intellegence/intelligence.routes.js";
import aiRouter from "./routes/ai.routes.js";
import aiPipelineRouter from "./routes/ai-pipeline.routes.js";
import aiIntelligenceRouter from "./routes/ai-intelligence.routes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/intelligence", intelligenceRouter);
app.use("/api/ai", aiRouter);
app.use("/api/ai-pipeline", aiPipelineRouter);
app.use("/api/ai-intelligence", aiIntelligenceRouter);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "crypto-scanner-api",
  });
});

app.use("/api/scanner", scannerRouter);

app.use("/api/market-scanner", marketScannerRouter);

app.use("/api/backtest", backtestRouter);

app.use("/api", multiBacktestRouter);

app.use("/api/signal-history", signalHistoryRouter);
app.use("/api/subscription", subscriptionRouter);
app.use("/api/auth", authRouter);
app.get("/api/auth-test", (_req, res) => {
  res.json({ auth: "loaded" });
});

export default app;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
