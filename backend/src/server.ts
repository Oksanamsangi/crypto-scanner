import express from "express";
import cors from "cors";

import scannerRouter from "./routes/scanner.routes.js";
import marketScannerRouter from "./routes/market-scanner.routes.js";
import backtestRouter from "./routes/backtest.routes.js";
import multiBacktestRouter from "./routes/multi-backtest.routes.js";
import signalHistoryRouter from "./routes/signal-history.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});