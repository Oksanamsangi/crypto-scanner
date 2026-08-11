import type { Kline } from "../types/market.js";
import { IndicatorService } from "./indicator.service.js";

export type ScannerSignal = "BUY" | "SELL" | "NEUTRAL";

export type SignalStrength = "STRONG" | "MODERATE" | "WEAK" | "NONE";

const BUY_THRESHOLD = 3;
const SELL_THRESHOLD = -3;

const RSI_BULLISH_MIN = 50;
const RSI_BULLISH_MAX = 70;

const RSI_BEARISH_MIN = 30;
const RSI_BEARISH_MAX = 50;

const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;

const RSI_EXTREME_OVERBOUGHT = 80;
const RSI_EXTREME_OVERSOLD = 20;

const MIN_REQUIRED_CANDLES = 60;

const ATR_STOP_MULTIPLIER = 1;
const ATR_TARGET_MULTIPLIER = 2;

export interface ScanResult {
  symbol: string;
  timeframe: string;

  currentPrice: number | null;

  ema20: number | null;
  ema50: number | null;
  rsi14: number | null;

  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;

  atr14: number | null;

  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;

  score: number;
  confidence: number;

  signal: ScannerSignal;
  signalStrength: SignalStrength;

  reasons: string[];
}

export class ScannerService {
  private readonly indicatorService: IndicatorService;

  constructor(indicatorService: IndicatorService = new IndicatorService()) {
    this.indicatorService = indicatorService;
  }

  public scan(symbol: string, timeframe: string, klines: Kline[]): ScanResult {
    const lastKline = klines.at(-1);

    const currentPrice = lastKline?.close ?? null;

    /*
     * Not enough candles.
     */
    if (klines.length < MIN_REQUIRED_CANDLES) {
      return {
        symbol,
        timeframe,

        currentPrice,

        ema20: null,
        ema50: null,
        rsi14: null,

        macd: null,
        macdSignal: null,
        macdHistogram: null,

        atr14: null,

        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        riskRewardRatio: null,

        score: 0,
        confidence: 0,

        signal: "NEUTRAL",
        signalStrength: "NONE",

        reasons: [
          `Insufficient candle data: received ${klines.length}, need at least ${MIN_REQUIRED_CANDLES}.`,
        ],
      };
    }

    /*
     * Calculate indicators.
     */
    const ema20 = this.indicatorService.calculateEMA20(klines).latest;

    const ema50 = this.indicatorService.calculateEMA50(klines).latest;

    const rsi14 = this.indicatorService.calculateRSI14(klines).latest;

    const macdResult = this.indicatorService.calculateMACD(klines);

    const macd = macdResult.latest?.macd ?? null;

    const macdSignal = macdResult.latest?.signal ?? null;

    const macdHistogram = macdResult.latest?.histogram ?? null;

    const atr14 = this.indicatorService.calculateATR14(klines).latest;

    /*
     * Required indicators must exist.
     */
    if (
      ema20 === null ||
      ema50 === null ||
      rsi14 === null ||
      macd === null ||
      macdSignal === null ||
      macdHistogram === null ||
      atr14 === null
    ) {
      return {
        symbol,
        timeframe,

        currentPrice,

        ema20,
        ema50,
        rsi14,

        macd,
        macdSignal,
        macdHistogram,

        atr14,

        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        riskRewardRatio: null,

        score: 0,
        confidence: 0,

        signal: "NEUTRAL",
        signalStrength: "NONE",

        reasons: ["One or more required indicators could not be calculated."],
      };
    }

    const reasons: string[] = [];

    let score = 0;

    /*
     * 1. Price vs EMA20
     */
    if (currentPrice !== null) {
      if (currentPrice > ema20) {
        score += 1;

        reasons.push("Price is above EMA20 (+1, bullish).");
      } else if (currentPrice < ema20) {
        score -= 1;

        reasons.push("Price is below EMA20 (-1, bearish).");
      } else {
        reasons.push("Price is equal to EMA20 (0, neutral).");
      }
    }

    /*
     * 2. EMA20 vs EMA50
     */
    if (ema20 > ema50) {
      score += 1;

      reasons.push("EMA20 is above EMA50 (+1, bullish).");
    } else if (ema20 < ema50) {
      score -= 1;

      reasons.push("EMA20 is below EMA50 (-1, bearish).");
    } else {
      reasons.push("EMA20 is equal to EMA50 (0, neutral).");
    }

    /*
     * 3. RSI14
     *
     * Important:
     *
     * 50-70 = bullish
     * 30-50 = bearish
     * <30 = oversold
     * >70 = overbought
     *
     * Oversold/overbought do NOT automatically
     * receive an additional directional point.
     */
    if (rsi14 >= RSI_BULLISH_MIN && rsi14 < RSI_BULLISH_MAX) {
      score += 1;

      reasons.push(`RSI14 (${rsi14.toFixed(2)}) is in the bullish zone (+1).`);
    } else if (rsi14 > RSI_BEARISH_MIN && rsi14 < RSI_BEARISH_MAX) {
      score -= 1;

      reasons.push(`RSI14 (${rsi14.toFixed(2)}) is in the bearish zone (-1).`);
    } else if (rsi14 <= RSI_EXTREME_OVERSOLD) {
      reasons.push(
        `RSI14 (${rsi14.toFixed(
          2,
        )}) is extremely oversold. No additional bearish point.`,
      );
    } else if (rsi14 < RSI_OVERSOLD) {
      reasons.push(
        `RSI14 (${rsi14.toFixed(2)}) is oversold. No additional bearish point.`,
      );
    } else if (rsi14 >= RSI_EXTREME_OVERBOUGHT) {
      reasons.push(
        `RSI14 (${rsi14.toFixed(
          2,
        )}) is extremely overbought. No additional bullish point.`,
      );
    } else if (rsi14 >= RSI_OVERBOUGHT) {
      reasons.push(
        `RSI14 (${rsi14.toFixed(
          2,
        )}) is overbought. No additional bullish point.`,
      );
    } else {
      reasons.push(`RSI14 (${rsi14.toFixed(2)}) is neutral (0).`);
    }

    /*
     * 4. MACD vs Signal
     */
    if (macd > macdSignal) {
      score += 1;

      reasons.push("MACD is above its signal line (+1, bullish).");
    } else if (macd < macdSignal) {
      score -= 1;

      reasons.push("MACD is below its signal line (-1, bearish).");
    } else {
      reasons.push("MACD equals its signal line (0, neutral).");
    }

    /*
     * 5. MACD Histogram
     */
    if (macdHistogram > 0) {
      score += 1;

      reasons.push("MACD histogram is positive (+1, bullish).");
    } else if (macdHistogram < 0) {
      score -= 1;

      reasons.push("MACD histogram is negative (-1, bearish).");
    } else {
      reasons.push("MACD histogram is zero (0, neutral).");
    }

    /*
     * Determine basic signal.
     */
    let signal: ScannerSignal = "NEUTRAL";

    if (score >= BUY_THRESHOLD) {
      signal = "BUY";
    } else if (score <= SELL_THRESHOLD) {
      signal = "SELL";
    }

    /*
     * Prevent extreme RSI conditions from
     * creating blind directional signals.
     *
     * Example:
     *
     * RSI = 18
     * score = -4
     *
     * This can be a very extended move.
     * We keep the bearish signal but mark it
     * as potentially exhausted.
     */
    if (signal === "SELL" && rsi14 <= RSI_EXTREME_OVERSOLD) {
      reasons.push(
        "SELL signal is in an extremely oversold market; reversal risk is elevated.",
      );
    }

    if (signal === "BUY" && rsi14 >= RSI_EXTREME_OVERBOUGHT) {
      reasons.push(
        "BUY signal is in an extremely overbought market; reversal risk is elevated.",
      );
    }

    /*
     * ATR-based trade levels.
     */
    let entryPrice: number | null = null;
    let stopLoss: number | null = null;
    let takeProfit: number | null = null;
    let riskRewardRatio: number | null = null;

    if (currentPrice !== null && atr14 > 0 && signal !== "NEUTRAL") {
      entryPrice = currentPrice;

      const riskDistance = atr14 * ATR_STOP_MULTIPLIER;

      const rewardDistance = atr14 * ATR_TARGET_MULTIPLIER;

      if (signal === "BUY") {
        stopLoss = entryPrice - riskDistance;

        takeProfit = entryPrice + rewardDistance;
      } else {
        stopLoss = entryPrice + riskDistance;

        takeProfit = entryPrice - rewardDistance;
      }

      riskRewardRatio = rewardDistance / riskDistance;

      reasons.push(
        `ATR-based trade levels calculated using ${ATR_STOP_MULTIPLIER}x ATR risk and ${ATR_TARGET_MULTIPLIER}x ATR reward.`,
      );

      reasons.push(`Risk/Reward ratio: 1:${riskRewardRatio.toFixed(2)}.`);
    }

    /*
     * Confidence.
     *
     * This is NOT probability of profit.
     */
    let confidence = 50;

    if (score === 5 || score === -5) {
      confidence = 95;
    } else if (score === 4 || score === -4) {
      confidence = 90;
    } else if (score === 3 || score === -3) {
      confidence = 85;
    } else if (score === 2 || score === -2) {
      confidence = 70;
    } else if (score === 1 || score === -1) {
      confidence = 55;
    }

    /*
     * Signal strength.
     */
    let signalStrength: SignalStrength = "NONE";

    if (signal === "BUY" || signal === "SELL") {
      if (confidence >= 90) {
        signalStrength = "STRONG";
      } else if (confidence >= 85) {
        signalStrength = "MODERATE";
      } else {
        signalStrength = "WEAK";
      }
    }

    /*
     * If the market is extremely overbought/oversold,
     * downgrade the strength because reversal risk
     * is higher.
     */
    if (signal === "SELL" && rsi14 <= RSI_EXTREME_OVERSOLD) {
      signalStrength = signalStrength === "STRONG" ? "MODERATE" : "WEAK";
    }

    if (signal === "BUY" && rsi14 >= RSI_EXTREME_OVERBOUGHT) {
      signalStrength = signalStrength === "STRONG" ? "MODERATE" : "WEAK";
    }

    /*
     * Final explanation.
     */
    reasons.push(`Final score: ${score}.`);

    reasons.push(`Indicator confidence: ${confidence}%.`);

    reasons.push(`Signal strength: ${signalStrength}.`);

    reasons.push(
      "Confidence is an indicator-agreement score, not a probability of profit or a guarantee of future price movement.",
    );

    return {
      symbol,
      timeframe,

      currentPrice,

      ema20,
      ema50,
      rsi14,

      macd,
      macdSignal,
      macdHistogram,

      atr14,

      entryPrice,
      stopLoss,
      takeProfit,
      riskRewardRatio,

      score,
      confidence,

      signal,
      signalStrength,

      reasons,
    };
  }
}
