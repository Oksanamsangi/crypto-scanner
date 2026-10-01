import type { ScanResult } from "./scanner.service.js";
import type { MarketSnapshot } from "../intellegence/types.js";
import type {
  MarketIntelligence,
} from "./context-aware-signal.service.js";

export function buildContextIntelligence(
  scan: ScanResult,
  snapshot: MarketSnapshot,
): MarketIntelligence {
  const currentPrice = snapshot.price.current;

  const range =
    snapshot.price.high -
    snapshot.price.low;

  const pricePosition =
    range > 0
      ? ((currentPrice - snapshot.price.low) / range) * 100
      : 50;

  const rsi = snapshot.momentum.rsi;
  const roc = snapshot.momentum.roc;

  /*
   * -------------------------------------------------
   * MOMENTUM
   * -------------------------------------------------
   */

  let momentumState:
    | "BULLISH"
    | "BEARISH"
    | "NEUTRAL";

  if (rsi >= 55 && roc > 0) {
    momentumState = "BULLISH";
  } else if (rsi <= 45 && roc < 0) {
    momentumState = "BEARISH";
  } else {
    momentumState = "NEUTRAL";
  }

  /*
   * -------------------------------------------------
   * VOLUME
   * -------------------------------------------------
   */

  let volumeState:
    | "STRONG"
    | "ABOVE_AVERAGE"
    | "WEAK"
    | "VERY_WEAK";

  const volumeRatio = snapshot.volume.ratio;

  if (volumeRatio >= 1.5) {
    volumeState = "STRONG";
  } else if (volumeRatio >= 1) {
    volumeState = "ABOVE_AVERAGE";
  } else if (volumeRatio >= 0.5) {
    volumeState = "WEAK";
  } else {
    volumeState = "VERY_WEAK";
  }

  /*
   * -------------------------------------------------
   * VOLATILITY
   * -------------------------------------------------
   */

  const volatilityState =
    snapshot.volatility.level;

  /*
   * -------------------------------------------------
   * TREND STRENGTH
   * -------------------------------------------------
   *
   * Trend direction is determined independently
   * from the base BUY/SELL signal.
   */

  let trendStrength = 50;
  let trendDirection:
    | "UP"
    | "DOWN"
    | "NONE" = "NONE";

  if (
    scan.ema20 !== null &&
    scan.ema50 !== null &&
    scan.ema50 > 0
  ) {
    const emaDistance =
      ((scan.ema20 - scan.ema50) /
        scan.ema50) *
      100;

    trendStrength = Math.min(
      100,
      Math.round(
        50 + Math.abs(emaDistance) * 20,
      ),
    );

    if (emaDistance > 0.15) {
      trendDirection = "UP";
    } else if (emaDistance < -0.15) {
      trendDirection = "DOWN";
    }
  }

  /*
   * -------------------------------------------------
   * MARKET REGIME
   * -------------------------------------------------
   */

  let regime:
    | "TRENDING_UP"
    | "TRENDING_DOWN"
    | "RANGING"
    | "TRANSITION"
    | "UNKNOWN";

  if (
    trendDirection === "UP" &&
    trendStrength >= 70
  ) {
    regime = "TRENDING_UP";
  } else if (
    trendDirection === "DOWN" &&
    trendStrength >= 70
  ) {
    regime = "TRENDING_DOWN";
  } else if (
    trendStrength <= 55 &&
    momentumState === "NEUTRAL"
  ) {
    regime = "RANGING";
  } else {
    regime = "TRANSITION";
  }

  /*
   * -------------------------------------------------
   * MARKET PHASE
   * -------------------------------------------------
   */

  let marketPhase: string;

  if (
    regime === "TRENDING_UP" &&
    momentumState === "BULLISH"
  ) {
    marketPhase = "EXPANSION";
  } else if (
    regime === "TRENDING_DOWN" &&
    momentumState === "BEARISH"
  ) {
    marketPhase = "DISTRIBUTION";
  } else if (
    pricePosition <= 30 &&
    momentumState !== "BEARISH"
  ) {
    marketPhase = "ACCUMULATION";
  } else if (
    pricePosition >= 70 &&
    momentumState !== "BULLISH"
  ) {
    marketPhase = "DISTRIBUTION";
  } else {
    marketPhase = "TRANSITION";
  }

  /*
   * -------------------------------------------------
   * CONTEXT CONFIDENCE
   * -------------------------------------------------
   */

  let confidence = 50;

  confidence += Math.min(
    15,
    Math.abs(roc) * 2,
  );

  confidence += Math.min(
    15,
    Math.abs(pricePosition - 50) / 3,
  );

  if (
    volumeState === "STRONG"
  ) {
    confidence += 10;
  } else if (
    volumeState === "VERY_WEAK"
  ) {
    confidence -= 10;
  }

  if (
    volatilityState === "HIGH" ||
    volatilityState === "EXTREME"
  ) {
    confidence -= 5;
  }

  confidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(confidence),
    ),
  );

  /*
   * -------------------------------------------------
   * REASONS
   * -------------------------------------------------
   */

  const reasons: string[] = [];

  reasons.push(
    `RSI is ${rsi.toFixed(2)} and ROC is ${roc.toFixed(2)}%.`,
  );

  reasons.push(
    `Trading volume is ${volumeState
      .toLowerCase()
      .replace("_", " ")}.`,
  );

  reasons.push(
    `Volatility is ${volatilityState.toLowerCase()}.`,
  );

  reasons.push(
    `Price is at ${pricePosition.toFixed(2)}% of the recent range.`,
  );

  reasons.push(
    `Trend strength is ${trendStrength}.`,
  );

  reasons.push(
    `Market regime is ${regime}.`,
  );

  /*
   * -------------------------------------------------
   * RETURN
   * -------------------------------------------------
   */

  return {
    regime: {
      regime,
      confidence,
      trendStrength,
      marketPhase,
      volatilityState,
      momentumState,
      volumeState,
      pricePosition,
      reasons,
    },
  };
}
