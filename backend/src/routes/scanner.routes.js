import { Router } from "express";
import { BinanceService, BinanceServiceError, } from "../services/binance.service.js";
import { ScannerService } from "../services/scanner.service.js";
const router = Router();
const binanceService = new BinanceService();
const scannerService = new ScannerService();
const VALID_INTERVALS = [
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "2h",
    "4h",
    "6h",
    "8h",
    "12h",
    "1d",
    "3d",
    "1w",
    "1M",
];
const DEFAULT_INTERVAL = "1h";
const DEFAULT_LIMIT = 100;
const MIN_LIMIT = 60;
const MAX_LIMIT = 1000;
const CONCURRENCY = 5;
const MIN_QUOTE_VOLUME = 1_000_000;
const EXCLUDED_SYMBOLS = new Set([
    "USDCUSDT",
    "FDUSDUSDT",
    "USD1USDT",
    "TUSDUSDT",
    "EURIUSDT",
    "DAIUSDT",
]);
function isValidInterval(value) {
    return VALID_INTERVALS.includes(value);
}
function handleRouteError(error, res) {
    if (error instanceof BinanceServiceError) {
        const status = error.status !== undefined && error.status >= 400 && error.status < 600
            ? error.status
            : 502;
        res.status(status).json({
            error: error.message,
        });
        return;
    }
    res.status(500).json({
        error: "Internal server error",
    });
}
async function runWithConcurrency(items, worker, concurrency) {
    let index = 0;
    async function runner() {
        while (true) {
            const currentIndex = index++;
            if (currentIndex >= items.length) {
                return;
            }
            const item = items[currentIndex];
            if (item === undefined) {
                return;
            }
            await worker(item);
        }
    }
    const workers = Array.from({
        length: Math.min(concurrency, items.length),
    }, () => runner());
    await Promise.all(workers);
}
router.get("/", async (req, res) => {
    const intervalParam = typeof req.query.interval === "string"
        ? req.query.interval
        : DEFAULT_INTERVAL;
    if (!isValidInterval(intervalParam)) {
        res.status(400).json({
            error: `Invalid interval. Must be one of: ${VALID_INTERVALS.join(", ")}`,
        });
        return;
    }
    const limitParam = typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : DEFAULT_LIMIT;
    if (!Number.isInteger(limitParam) ||
        limitParam < MIN_LIMIT ||
        limitParam > MAX_LIMIT) {
        res.status(400).json({
            error: `Invalid limit. Must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}`,
        });
        return;
    }
    try {
        const tickers = await binanceService.getAll24hTickers();
        const eligibleTickers = tickers
            .filter((ticker) => ticker.symbol.endsWith("USDT") &&
            !EXCLUDED_SYMBOLS.has(ticker.symbol) &&
            ticker.quoteVolume >= MIN_QUOTE_VOLUME)
            .sort((a, b) => b.quoteVolume - a.quoteVolume);
        const results = [];
        await runWithConcurrency(eligibleTickers, async (ticker) => {
            try {
                const klines = await binanceService.getKlines(ticker.symbol, intervalParam, limitParam);
                const result = scannerService.scan(ticker.symbol, intervalParam, klines);
                results.push(result);
            }
            catch {
                // Skip pairs whose individual request fails.
            }
        }, CONCURRENCY);
        results.sort((a, b) => b.score - a.score);
        const topBuy = results
            .filter((result) => result.signal === "BUY")
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        const topSell = results
            .filter((result) => result.signal === "SELL")
            .sort((a, b) => a.score - b.score)
            .slice(0, 10);
        res.status(200).json({
            interval: intervalParam,
            candles: limitParam,
            scannedPairs: results.length,
            topBuy,
            topSell,
            results,
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
export default router;
//# sourceMappingURL=scanner.routes.js.map