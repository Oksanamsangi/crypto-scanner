import express from "express";
import cors from "cors";
import scannerRouter from "./routes/scanner.routes.js";
import backtestRouter from "./routes/backtest.routes.js";
import multiBacktestRouter from "./routes/multi-backtest.routes.js";
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/backtest", backtestRouter);
app.use("/api", multiBacktestRouter);
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "crypto-scanner-api",
    });
});
app.use("/api/scanner", scannerRouter);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map