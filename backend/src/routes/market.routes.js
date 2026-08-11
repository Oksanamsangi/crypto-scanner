import { Router } from 'express';
import { BinanceService, BinanceServiceError, } from '../services/binance.service.js';
const router = Router();
const binanceService = new BinanceService();
const VALID_INTERVALS = [
    '1m',
    '3m',
    '5m',
    '15m',
    '30m',
    '1h',
    '2h',
    '4h',
    '6h',
    '8h',
    '12h',
    '1d',
    '3d',
    '1w',
    '1M',
];
const MIN_LIMIT = 1;
const MAX_LIMIT = 1000;
const DEFAULT_INTERVAL = '1h';
const DEFAULT_LIMIT = 100;
function isValidInterval(value) {
    return VALID_INTERVALS.includes(value);
}
function handleRouteError(error, res) {
    if (error instanceof BinanceServiceError) {
        const status = error.status !== undefined &&
            error.status >= 400 &&
            error.status < 600
            ? error.status
            : 502;
        res.status(status).json({
            error: error.message,
        });
        return;
    }
    console.error(error);
    res.status(500).json({
        error: 'Internal server error',
    });
}
router.get('/:symbol', async (req, res) => {
    const { symbol } = req.params;
    if (typeof symbol !== 'string' || symbol.trim().length === 0) {
        res.status(400).json({
            error: 'A valid symbol is required',
        });
        return;
    }
    try {
        const ticker = await binanceService.get24hTicker(symbol);
        res.status(200).json(ticker);
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.get('/:symbol/klines', async (req, res) => {
    const { symbol } = req.params;
    if (typeof symbol !== 'string' || symbol.trim().length === 0) {
        res.status(400).json({
            error: 'A valid symbol is required',
        });
        return;
    }
    const intervalParam = typeof req.query.interval === 'string'
        ? req.query.interval
        : DEFAULT_INTERVAL;
    if (!isValidInterval(intervalParam)) {
        res.status(400).json({
            error: `Invalid interval. Must be one of: ${VALID_INTERVALS.join(', ')}`,
        });
        return;
    }
    const limitParam = typeof req.query.limit === 'string'
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
        const klines = await binanceService.getKlines(symbol, intervalParam, limitParam);
        res.status(200).json(klines);
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
export default router;
//# sourceMappingURL=market.routes.js.map