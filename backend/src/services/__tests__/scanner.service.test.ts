import { describe, expect, it } from "vitest";
import type { Kline } from "../../types/market.js";
import { ScannerService } from "../scanner.service.js";

function createKlines(
  count: number,
  startPrice: number,
  changePerCandle: number,
): Kline[] {
  return Array.from({ length: count }, (_, index) => {
    const open = startPrice + index * changePerCandle;
    const close = open + changePerCandle;

    return {
      openTime: index * 60 * 60 * 1000,
      open,
      high: Math.max(open, close) + 0.1,
      low: Math.min(open, close) - 0.1,
      close,
      volume: 1000,
      closeTime: (index + 1) * 60 * 60 * 1000 - 1,
      quoteAssetVolume: 100000,
      numberOfTrades: 100,
    };
  });
}

describe("ScannerService", () => {
  const scanner = new ScannerService();

  it("returns NEUTRAL when there are not enough candles", () => {
    const klines = createKlines(30, 100, 1);

    const result = scanner.scan("TESTUSDT", "1h", klines);

    expect(result.signal).toBe("NEUTRAL");
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.currentPrice).not.toBeNull();
  });

  it("calculates a result when there are enough candles", () => {
    const klines = createKlines(100, 100, 0.1);

    const result = scanner.scan("TESTUSDT", "1h", klines);

    expect(result.currentPrice).not.toBeNull();

    expect(result.ema20).not.toBeNull();
    expect(result.ema50).not.toBeNull();
    expect(result.rsi14).not.toBeNull();

    expect(result.macd).not.toBeNull();
    expect(result.macdSignal).not.toBeNull();
    expect(result.macdHistogram).not.toBeNull();

    expect(result.atr14).not.toBeNull();
  });

  it("score is always within the expected -5 to +5 range", () => {
    const scenarios = [
      createKlines(100, 100, -1),
      createKlines(100, 100, -0.1),
      createKlines(100, 100, 0),
      createKlines(100, 100, 0.1),
      createKlines(100, 100, 1),
    ];

    for (const klines of scenarios) {
      const result = scanner.scan("TESTUSDT", "1h", klines);

      expect(result.score).toBeGreaterThanOrEqual(-5);
      expect(result.score).toBeLessThanOrEqual(5);
    }
  });

  it("confidence matches the score", () => {
    const klines = createKlines(100, 100, 0.1);

    const result = scanner.scan("TESTUSDT", "1h", klines);

    const expectedConfidence =
      result.score === 5 || result.score === -5
        ? 95
        : result.score === 4 || result.score === -4
          ? 90
          : result.score === 3 || result.score === -3
            ? 85
            : result.score === 2 || result.score === -2
              ? 70
              : result.score === 1 || result.score === -1
                ? 55
                : 50;

    expect(result.confidence).toBe(expectedConfidence);
  });

  it("signal matches the score threshold", () => {
    const klines = createKlines(100, 100, 0.1);

    const result = scanner.scan("TESTUSDT", "1h", klines);

    if (result.score >= 3) {
      expect(result.signal).toBe("BUY");
    } else if (result.score <= -3) {
      expect(result.signal).toBe("SELL");
    } else {
      expect(result.signal).toBe("NEUTRAL");
    }
  });

  it("does not produce NaN indicator values", () => {
    const klines = createKlines(100, 100, 0.1);

    const result = scanner.scan("TESTUSDT", "1h", klines);

    const values = [
      result.currentPrice,
      result.ema20,
      result.ema50,
      result.rsi14,
      result.macd,
      result.macdSignal,
      result.macdHistogram,
      result.atr14,
    ];

    for (const value of values) {
      if (value !== null) {
        expect(Number.isNaN(value)).toBe(false);
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});
