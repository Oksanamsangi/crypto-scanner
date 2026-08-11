
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  BinanceService,
  BinanceServiceError,
} from '../services/binance.service.js';
import { ScannerService } from '../services/scanner.service.js';
import type { KlineInterval } from '../types/market.js';

const router = Router();

const binanceService = new BinanceService();
const scannerService = new ScannerService();

const VALID_INTERVALS: readonly KlineInterval[] = [
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

const MIN_LIMIT = 60;
const MAX_LIMIT = 1000;

const DEFAULT_INTERVAL: KlineInterval = '1h';
const DEFAULT_LIMIT = 100;

function isValidInterval(
  value: string
): value is KlineInterval {
  return (
    VALID_INTERVALS as readonly string[]
  ).includes(value);
}

function handleRouteError(
  error: unknown,
  res: Response
): void {
  if (error instanceof BinanceServiceError) {
    const status =
      error.status &&
      error.status >= 400 &&
      error.status < 600
        ? error.status
        : 502;

    res.status(status).json({
      error: error.message,
    });

    return;
  }

  res.status(500).json({
    error: 'Internal server error',
  });
}

router.get(
  '/:symbol',
  async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (
      typeof symbol !== 'string' ||
      symbol.trim().length === 0
    ) {
      res.status(400).json({
        error: 'A valid symbol is required',
      });

      return;
    }

    const intervalParam =
      typeof req.query.interval === 'string'
        ? req.query.interval
        : DEFAULT_INTERVAL;

    if (!isValidInterval(intervalParam)) {
      res.status(400).json({
        error: `Invalid interval. Must be one of: ${VALID_INTERVALS.join(', ')}`,
      });

      return;
    }

    const limitParam =
      typeof req.query.limit === 'string'
        ? Number(req.query.limit)
        : DEFAULT_LIMIT;

    if (
      !Number.isInteger(limitParam) ||
      limitParam < MIN_LIMIT ||
      limitParam > MAX_LIMIT
    ) {
      res.status(400).json({
        error: `Invalid limit. Must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}`,
      });

      return;
    }

    try {
      const klines = await binanceService.getKlines(
        symbol,
        intervalParam,
        limitParam
      );

      const result = scannerService.scan(
        symbol.toUpperCase(),
        intervalParam,
        klines
      );

      res.status(200).json(result);
    } catch (error) {
      handleRouteError(error, res);
    }
  }
);

export default router;

