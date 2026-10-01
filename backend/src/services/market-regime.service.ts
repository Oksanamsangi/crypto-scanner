
export type MarketRegime =
  | "TRENDING_UP"
  | "TRENDING_DOWN"
  | "RANGING"
  | "BREAKOUT"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
  | "TRANSITION";

export type MarketPhase =
  | "ACCUMULATION"
  | "EXPANSION"
  | "DISTRIBUTION"
  | "CONTRACTION"
  | "UNKNOWN";

export interface MarketSnapshotInput {
  price: {
    current: number;
    open: number;
    high: number;
    low: number;
    change: number;
    changePercent: number;
  };

  volume: {
    current: number;
    average: number;
    ratio: number;
  };

  volatility: {
    atr: number;
    atrPercent: number;
    level: string;
  };

  momentum: {
    rsi: number;
    roc: number;
  };
}

export interface MarketRegimeResult {
  regime: MarketRegime;
  confidence: number;

  trendStrength: number;
  marketPhase: MarketPhase;

  volatilityState:
    | "HIGH"
    | "NORMAL"
    | "LOW";

  momentumState:
    | "STRONG_BULLISH"
    | "BULLISH"
    | "NEUTRAL"
    | "BEARISH"
    | "STRONG_BEARISH";

  volumeState:
    | "VERY_HIGH"
    | "HIGH"
    | "NORMAL"
    | "WEAK"
    | "VERY_WEAK";

  pricePosition: number;

  reasons: string[];
}

export function analyzeMarketRegime(
  snapshot: MarketSnapshotInput,
): MarketRegimeResult {
  const reasons: string[] = [];

  const {
    price,
    volume,
    volatility,
    momentum,
  } = snapshot;

  /*
   * --------------------------------------------------
   * 1. PRICE POSITION
   * --------------------------------------------------
   *
   * Where is the current price inside the
   * current high/low range?
   */

  const range = price.high - price.low;

  const pricePosition =
    range > 0
      ? ((price.current - price.low) / range) * 100
      : 50;

  /*
   * --------------------------------------------------
   * 2. MOMENTUM
   * --------------------------------------------------
   */

  let momentumState:
    | "STRONG_BULLISH"
    | "BULLISH"
    | "NEUTRAL"
    | "BEARISH"
    | "STRONG_BEARISH";

  if (
    momentum.rsi >= 65 &&
    momentum.roc > 1
  ) {
    momentumState = "STRONG_BULLISH";

    reasons.push(
      "Momentum is strongly bullish.",
    );
  } else if (
    momentum.rsi >= 55 &&
    momentum.roc >= 0
  ) {
    momentumState = "BULLISH";

    reasons.push(
      "Momentum is moderately bullish.",
    );
  } else if (
    momentum.rsi <= 35 &&
    momentum.roc < -1
  ) {
    momentumState = "STRONG_BEARISH";

    reasons.push(
      "Momentum is strongly bearish.",
    );
  } else if (
    momentum.rsi <= 45 &&
    momentum.roc <= 0
  ) {
    momentumState = "BEARISH";

    reasons.push(
      "Momentum is moderately bearish.",
    );
  } else {
    momentumState = "NEUTRAL";

    reasons.push(
      "Momentum is currently neutral.",
    );
  }

  /*
   * --------------------------------------------------
   * 3. VOLUME
   * --------------------------------------------------
   */

  let volumeState:
    | "VERY_HIGH"
    | "HIGH"
    | "NORMAL"
    | "WEAK"
    | "VERY_WEAK";

  if (volume.ratio >= 2) {
    volumeState = "VERY_HIGH";

    reasons.push(
      "Trading volume is exceptionally high.",
    );
  } else if (volume.ratio >= 1.3) {
    volumeState = "HIGH";

    reasons.push(
      "Trading volume is above average.",
    );
  } else if (volume.ratio >= 0.8) {
    volumeState = "NORMAL";

    reasons.push(
      "Trading volume is near its average.",
    );
  } else if (volume.ratio >= 0.4) {
    volumeState = "WEAK";

    reasons.push(
      "Trading volume is below average.",
    );
  } else {
    volumeState = "VERY_WEAK";

    reasons.push(
      "Trading volume is significantly below average.",
    );
  }

  /*
   * --------------------------------------------------
   * 4. VOLATILITY
   * --------------------------------------------------
   */

  let volatilityState:
    | "HIGH"
    | "NORMAL"
    | "LOW";

  if (volatility.atrPercent >= 2) {
    volatilityState = "HIGH";
  } else if (volatility.atrPercent <= 0.7) {
    volatilityState = "LOW";
  } else {
    volatilityState = "NORMAL";
  }

  reasons.push(
    `Volatility is ${volatilityState.toLowerCase()}.`,
  );

  /*
   * --------------------------------------------------
   * 5. TREND STRENGTH
   * --------------------------------------------------
   *
   * We combine:
   * - price change
   * - RSI
   * - ROC
   * - price location
   */

  let trendStrength = 0;

  const changeScore = Math.min(
    Math.abs(price.changePercent) * 3,
    40,
  );

  const momentumScore =
    Math.min(
      Math.abs(momentum.rsi - 50) * 1.2,
      30,
    );

  const rocScore = Math.min(
    Math.abs(momentum.roc) * 5,
    20,
  );

  const positionScore =
    Math.abs(pricePosition - 50) * 0.2;

  trendStrength = Math.round(
    Math.min(
      100,
      changeScore +
        momentumScore +
        rocScore +
        positionScore,
    ),
  );

  /*
   * --------------------------------------------------
   * 6. DETERMINE DIRECTION
   * --------------------------------------------------
   */

  const bullishScore =
    (price.changePercent > 0 ? 30 : 0) +
    (momentum.rsi > 50 ? 25 : 0) +
    (momentum.roc > 0 ? 20 : 0) +
    (pricePosition > 60 ? 15 : 0) +
    (volume.ratio > 1 ? 10 : 0);

  const bearishScore =
    (price.changePercent < 0 ? 30 : 0) +
    (momentum.rsi < 50 ? 25 : 0) +
    (momentum.roc < 0 ? 20 : 0) +
    (pricePosition < 40 ? 15 : 0) +
    (volume.ratio > 1 ? 10 : 0);

  /*
   * --------------------------------------------------
   * 7. BREAKOUT DETECTION
   * --------------------------------------------------
   */

  const bullishBreakout =
    pricePosition >= 92 &&
    price.changePercent > 1 &&
    volume.ratio >= 1.3;

  const bearishBreakout =
    pricePosition <= 8 &&
    price.changePercent < -1 &&
    volume.ratio >= 1.3;

  /*
   * --------------------------------------------------
   * 8. MARKET REGIME
   * --------------------------------------------------
   */

  let regime: MarketRegime;

  if (
    bullishBreakout ||
    bearishBreakout
  ) {
    regime = "BREAKOUT";

    reasons.push(
      bullishBreakout
        ? "Price is pressing the upper range with confirming volume."
        : "Price is pressing the lower range with confirming volume.",
    );
  } else if (
    volatilityState === "HIGH" &&
    trendStrength >= 60
  ) {
    regime = "HIGH_VOLATILITY";

    reasons.push(
      "Strong directional movement is occurring under elevated volatility.",
    );
  } else if (
    trendStrength >= 60 &&
    bullishScore > bearishScore
  ) {
    regime = "TRENDING_UP";

    reasons.push(
      "Market structure currently favors an upward trend.",
    );
  } else if (
    trendStrength >= 60 &&
    bearishScore > bullishScore
  ) {
    regime = "TRENDING_DOWN";

    reasons.push(
      "Market structure currently favors a downward trend.",
    );
  } else if (
    volatilityState === "LOW" &&
    trendStrength < 35
  ) {
    regime = "LOW_VOLATILITY";

    reasons.push(
      "Price movement is compressed and directional conviction is weak.",
    );
  } else if (
    trendStrength < 40 &&
    Math.abs(
      bullishScore - bearishScore,
    ) < 15
  ) {
    regime = "RANGING";

    reasons.push(
      "Neither buyers nor sellers currently dominate the market.",
    );
  } else {
    regime = "TRANSITION";

    reasons.push(
      "Market conditions are shifting and directional conviction is developing.",
    );
  }

  /*
   * --------------------------------------------------
   * 9. MARKET PHASE
   * --------------------------------------------------
   */

  let marketPhase: MarketPhase;

  if (
    volatilityState === "LOW" &&
    volumeState === "WEAK"
  ) {
    marketPhase = "ACCUMULATION";
  } else if (
    volatilityState === "HIGH" &&
    volumeState === "HIGH"
  ) {
    marketPhase = "EXPANSION";
  } else if (
    pricePosition > 75 &&
    volumeState === "WEAK"
  ) {
    marketPhase = "DISTRIBUTION";
  } else if (
    volatilityState === "LOW"
  ) {
    marketPhase = "CONTRACTION";
  } else {
    marketPhase = "UNKNOWN";
  }

  /*
   * --------------------------------------------------
   * 10. CONFIDENCE
   * --------------------------------------------------
   */

  const directionalDifference =
    Math.abs(
      bullishScore - bearishScore,
    );

  let confidence =
    45 +
    trendStrength * 0.35 +
    directionalDifference * 0.2;

  if (
    volumeState === "VERY_WEAK"
  ) {
    confidence -= 10;
  }

  if (
    volumeState === "HIGH" ||
    volumeState === "VERY_HIGH"
  ) {
    confidence += 5;
  }

  confidence = Math.round(
    Math.max(
      0,
      Math.min(100, confidence),
    ),
  );

  /*
   * --------------------------------------------------
   * RESULT
   * --------------------------------------------------
   */

  return {
    regime,
    confidence,
    trendStrength,
    marketPhase,
    volatilityState,
    momentumState,
    volumeState,
    pricePosition: Number(
      pricePosition.toFixed(2),
    ),
    reasons,
  };
}
