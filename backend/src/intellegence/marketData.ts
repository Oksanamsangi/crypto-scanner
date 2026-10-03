
import type {
  Candle,
  MarketSnapshot,
  VolatilityLevel,
} from "./types.js";

const BINANCE_API =
  "https://data-api.binance.vision/api/v3/klines";

const ATR_PERIOD = 14;
const VOLUME_PERIOD = 30;
const ROC_PERIOD = 10;

async function fetchCandles(
  symbol: string,
  interval: string,
  limit = 200,
): Promise<Candle[]> {
  const url =
    `${BINANCE_API}` +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&limit=${limit}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Binance returned HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as unknown[][];

  return data.map((item) => ({
    openTime: Number(item[0]),
    open: Number(item[1]),
    high: Number(item[2]),
    low: Number(item[3]),
    close: Number(item[4]),
    volume: Number(item[5]),
    closeTime: Number(item[6]),
  }));
}

function calculateTrueRange(
  current: Candle,
  previous: Candle,
): number {
  const highLow =
    current.high - current.low;

  const highPreviousClose =
    Math.abs(
      current.high - previous.close,
    );

  const lowPreviousClose =
    Math.abs(
      current.low - previous.close,
    );

  return Math.max(
    highLow,
    highPreviousClose,
    lowPreviousClose,
  );
}

function calculateATR(
  candles: Candle[],
): number {
  if (candles.length < ATR_PERIOD + 1) {
    return 0;
  }

  const ranges: number[] = [];

  for (
    let i = 1;
    i < candles.length;
    i++
  ) {
    const current = candles[i];
    const previous = candles[i - 1];

    if (!current || !previous) {
      continue;
    }

    ranges.push(
      calculateTrueRange(
        current,
        previous,
      ),
    );
  }

  const recent =
    ranges.slice(-ATR_PERIOD);

  if (!recent.length) {
    return 0;
  }

  return (
    recent.reduce(
      (sum, value) => sum + value,
      0,
    ) / recent.length
  );
}

function calculateAverageVolume(
  candles: Candle[],
): number {
  const recent =
    candles.slice(-VOLUME_PERIOD);

  if (!recent.length) {
    return 0;
  }

  return (
    recent.reduce(
      (sum, candle) =>
        sum + candle.volume,
      0,
    ) / recent.length
  );
}

function calculateRSI(
  candles: Candle[],
  period = 14,
): number {
  if (candles.length <= period) {
    return 50;
  }

  const recent =
    candles.slice(-(period + 1));

  let gains = 0;
  let losses = 0;

  for (
    let i = 1;
    i < recent.length;
    i++
  ) {
    const current = recent[i];
    const previous = recent[i - 1];

    if (!current || !previous) {
      continue;
    }

    const change =
      current.close -
      previous.close;

    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const averageGain =
    gains / period;

  const averageLoss =
    losses / period;

  if (averageLoss === 0) {
    return 100;
  }

  const rs =
    averageGain / averageLoss;

  return 100 - 100 / (1 + rs);
}

function calculateROC(
  candles: Candle[],
): number {
  if (
    candles.length <= ROC_PERIOD
  ) {
    return 0;
  }

  const current =
    candles[candles.length - 1];

  const previous =
    candles[
      candles.length - 1 - ROC_PERIOD
    ];

  if (!current || !previous) {
    return 0;
  }

  if (!previous.close) {
    return 0;
  }

  return (
    ((current.close - previous.close) /
      previous.close) *
    100
  );
}

function getVolatilityLevel(
  atrPercent: number,
): VolatilityLevel {
  if (atrPercent >= 5) {
    return "EXTREME";
  }

  if (atrPercent >= 3) {
    return "HIGH";
  }

  if (atrPercent >= 1) {
    return "NORMAL";
  }

  return "LOW";
}

export async function getMarketSnapshot(
  symbol: string,
  interval: string,
): Promise<MarketSnapshot> {
  const candles =
    await fetchCandles(
      symbol,
      interval,
      200,
    );

  if (!candles.length) {
    throw new Error(
      "No market data returned.",
    );
  }

  const latest =
    candles[candles.length - 1];

  const first =
    candles[0];

  if (!latest || !first) {
    throw new Error(
      "Unable to determine latest or first candle.",
    );
  }

  const atr =
    calculateATR(candles);

  const averageVolume =
    calculateAverageVolume(candles);

  const volumeRatio =
    averageVolume > 0
      ? latest.volume /
        averageVolume
      : 0;

  const change =
    latest.close - first.open;

  const changePercent =
    first.open > 0
      ? (change / first.open) * 100
      : 0;

  const atrPercent =
    latest.close > 0
      ? (atr / latest.close) * 100
      : 0;

  return {
    symbol,
    interval,

    timestamp: Date.now(),

    candles: candles.length,

    price: {
      current: latest.close,
      open: first.open,
      high: Math.max(
        ...candles.map(
          (candle) => candle.high,
        ),
      ),
      low: Math.min(
        ...candles.map(
          (candle) => candle.low,
        ),
      ),
      change,
      changePercent,
    },

    volume: {
      current: latest.volume,
      average: averageVolume,
      ratio: volumeRatio,
    },

    volatility: {
      atr,
      atrPercent,
      level:
        getVolatilityLevel(
          atrPercent,
        ),
    },

    momentum: {
      rsi: calculateRSI(candles),
      roc: calculateROC(candles),
    },
  };
}
