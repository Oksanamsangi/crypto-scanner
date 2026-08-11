
import { ATR, EMA, MACD, RSI } from 'technicalindicators';
import type { Kline } from '../types/market.js';

const EMA_SHORT_PERIOD = 20;
const EMA_LONG_PERIOD = 50;
const RSI_PERIOD = 14;
const MACD_FAST_PERIOD = 12;
const MACD_SLOW_PERIOD = 26;
const MACD_SIGNAL_PERIOD = 9;
const ATR_PERIOD = 14;

export interface EmaResult {
  period: number;
  values: number[];
  latest: number | null;
}

export interface RsiResult {
  period: number;
  values: number[];
  latest: number | null;
}

export interface MacdResult {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  macd: number[];
  signal: number[];
  histogram: number[];
  latest: {
    macd: number;
    signal: number;
    histogram: number;
  } | null;
}

export interface AtrResult {
  period: number;
  values: number[];
  latest: number | null;
}

export class IndicatorService {
  public calculateEMA20(klines: Kline[]): EmaResult {
    return this.calculateEMA(klines, EMA_SHORT_PERIOD);
  }

  public calculateEMA50(klines: Kline[]): EmaResult {
    return this.calculateEMA(klines, EMA_LONG_PERIOD);
  }

  public calculateRSI14(klines: Kline[]): RsiResult {
    if (klines.length < RSI_PERIOD + 1) {
      return {
        period: RSI_PERIOD,
        values: [],
        latest: null,
      };
    }

    const closes = this.extractCloses(klines);

    const values = RSI.calculate({
      period: RSI_PERIOD,
      values: closes,
    });

    const latest = values.at(-1);

    return {
      period: RSI_PERIOD,
      values,
      latest: latest ?? null,
    };
  }

  public calculateMACD(klines: Kline[]): MacdResult {
    const minRequired =
      MACD_SLOW_PERIOD + MACD_SIGNAL_PERIOD;

    if (klines.length < minRequired) {
      return {
        fastPeriod: MACD_FAST_PERIOD,
        slowPeriod: MACD_SLOW_PERIOD,
        signalPeriod: MACD_SIGNAL_PERIOD,
        macd: [],
        signal: [],
        histogram: [],
        latest: null,
      };
    }

    const closes = this.extractCloses(klines);

    const raw = MACD.calculate({
      values: closes,
      fastPeriod: MACD_FAST_PERIOD,
      slowPeriod: MACD_SLOW_PERIOD,
      signalPeriod: MACD_SIGNAL_PERIOD,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    const macd: number[] = [];
    const signal: number[] = [];
    const histogram: number[] = [];

    for (const entry of raw) {
      if (
        entry.MACD !== undefined &&
        entry.signal !== undefined &&
        entry.histogram !== undefined
      ) {
        macd.push(entry.MACD);
        signal.push(entry.signal);
        histogram.push(entry.histogram);
      }
    }

    const lastEntry = raw.at(-1);

    const latest =
      lastEntry?.MACD !== undefined &&
      lastEntry.signal !== undefined &&
      lastEntry.histogram !== undefined
        ? {
            macd: lastEntry.MACD,
            signal: lastEntry.signal,
            histogram: lastEntry.histogram,
          }
        : null;

    return {
      fastPeriod: MACD_FAST_PERIOD,
      slowPeriod: MACD_SLOW_PERIOD,
      signalPeriod: MACD_SIGNAL_PERIOD,
      macd,
      signal,
      histogram,
      latest,
    };
  }

  public calculateATR14(klines: Kline[]): AtrResult {
    if (klines.length < ATR_PERIOD + 1) {
      return {
        period: ATR_PERIOD,
        values: [],
        latest: null,
      };
    }

    const high = klines.map((kline) => kline.high);
    const low = klines.map((kline) => kline.low);
    const close = klines.map((kline) => kline.close);

    const values = ATR.calculate({
      period: ATR_PERIOD,
      high,
      low,
      close,
    });

    const latest = values.at(-1);

    return {
      period: ATR_PERIOD,
      values,
      latest: latest ?? null,
    };
  }

  private calculateEMA(
    klines: Kline[],
    period: number
  ): EmaResult {
    if (klines.length < period) {
      return {
        period,
        values: [],
        latest: null,
      };
    }

    const closes = this.extractCloses(klines);

    const values = EMA.calculate({
      period,
      values: closes,
    });

    const latest = values.at(-1);

    return {
      period,
      values,
      latest: latest ?? null,
    };
  }

  private extractCloses(klines: Kline[]): number[] {
    return klines.map((kline) => kline.close);
  }
}
