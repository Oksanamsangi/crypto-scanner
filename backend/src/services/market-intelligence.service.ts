export type MarketRegime =
  | "BULLISH"
  | "BEARISH"
  | "SIDEWAYS"
  | "HIGH_VOLATILITY";

export type MarketRisk =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "EXTREME";

export type MarketMomentum =
  | "STRONG"
  | "POSITIVE"
  | "NEUTRAL"
  | "NEGATIVE"
  | "WEAK";

export type MarketVolatilityState =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "EXTREME";

export type MomentumAlignment =
  | "BULLISH"
  | "BEARISH"
  | "MIXED";

export type VolatilityEnvironment =
  | "COMPRESSION"
  | "NORMAL"
  | "EXPANSION";

export type MomentumVolatilityConfirmation =
  | "CONFIRMED"
  | "CAUTION"
  | "CONTRADICTED";

interface MarketResult {
  signal: "BUY" | "SELL" | "NEUTRAL";
  score: number;
  confidence: number;
  rsi14: number | null;
  atr14: number | null;
  currentPrice: number | null;
  ema20: number | null;
  ema50: number | null;
}

export interface MarketIntelligence {
  regime: MarketRegime;
  confidence: number;

  breadthScore: number;

  momentumScore: number;
  volatilityScore: number;

  volatilityState: MarketVolatilityState;

  momentumAlignment: MomentumAlignment;

  volatilityEnvironment: VolatilityEnvironment;

  momentumVolatilityConfirmation:
    MomentumVolatilityConfirmation;

  breadth: {
    bullish: number;
    bearish: number;
    neutral: number;
    bullishPercentage: number;
    bearishPercentage: number;
    neutralPercentage: number;
  };

  momentum: MarketMomentum;

  risk: MarketRisk;

  opinion: string;
  recommendedAction: string;

  reasons: string[];

  signals: {
    strong: number;
    buy: number;
    sell: number;
  };
}

function percentage(
  value: number,
  total: number,
): number {
  if (total === 0) return 0;

  return Math.round(
    (value / total) * 100,
  );
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

export function analyzeMarket(
  results: MarketResult[],
): MarketIntelligence {
  if (results.length === 0) {
    return {
      regime: "SIDEWAYS",
      confidence: 0,

      breadthScore: 0,

      momentumScore: 0,
      volatilityScore: 0,

      volatilityState: "NORMAL",

      momentumAlignment: "MIXED",

      volatilityEnvironment: "NORMAL",

      momentumVolatilityConfirmation:
        "CAUTION",

      breadth: {
        bullish: 0,
        bearish: 0,
        neutral: 0,
        bullishPercentage: 0,
        bearishPercentage: 0,
        neutralPercentage: 0,
      },

      momentum: "NEUTRAL",

      risk: "MODERATE",

      opinion:
        "There is not enough market data to establish a reliable market regime.",

      recommendedAction:
        "Wait for additional market confirmation before taking directional positions.",

      reasons: [
        "Insufficient market data.",
      ],

      signals: {
        strong: 0,
        buy: 0,
        sell: 0,
      },
    };
  }

  const total = results.length;

  /*
   * --------------------------------------------------
   * 1. BREADTH
   * --------------------------------------------------
   */

  const buy = results.filter(
    (result) =>
      result.signal === "BUY",
  ).length;

  const sell = results.filter(
    (result) =>
      result.signal === "SELL",
  ).length;

  const neutral =
    total - buy - sell;

  const bullishPercentage =
    percentage(buy, total);

  const bearishPercentage =
    percentage(sell, total);

  const neutralPercentage =
    percentage(neutral, total);

  /*
   * --------------------------------------------------
   * 2. WEIGHTED BREADTH
   * --------------------------------------------------
   */

  const weightedBreadth =
    results.reduce(
      (sum, result) => {
        const direction =
          result.signal === "BUY"
            ? 1
            : result.signal === "SELL"
              ? -1
              : 0;

        const strength =
          clamp(
            result.confidence,
            0,
            100,
          ) / 100;

        return (
          sum +
          direction * strength
        );
      },
      0,
    );

  const breadthScore =
    Math.round(
      (weightedBreadth / total) *
        100,
    );

  /*
   * --------------------------------------------------
   * 3. STRONG SIGNALS
   * --------------------------------------------------
   */

  const strong =
    results.filter(
      (result) =>
        Math.abs(result.score) >= 5 ||
        result.confidence >= 75,
    ).length;

  /*
   * --------------------------------------------------
   * 4. AVERAGES
   * --------------------------------------------------
   */

  const averageScore =
    results.reduce(
      (sum, result) =>
        sum + result.score,
      0,
    ) / total;

  const averageConfidence =
    results.reduce(
      (sum, result) =>
        sum + result.confidence,
      0,
    ) / total;

  const rsiResults =
    results.filter(
      (result) =>
        result.rsi14 !== null &&
        Number.isFinite(
          result.rsi14,
        ),
    );

  const averageRsi =
    rsiResults.length > 0
      ? rsiResults.reduce(
          (sum, result) =>
            sum +
            (result.rsi14 ?? 50),
          0,
        ) /
        rsiResults.length
      : 50;

  /*
   * --------------------------------------------------
   * 5. MOMENTUM SCORE
   * --------------------------------------------------
   *
   * Combines:
   * - RSI positioning
   * - scanner score
   * - breadth
   *
   * Range:
   * -100 bearish
   *    0 neutral
   * +100 bullish
   */

  const rsiMomentum =
    clamp(
      (averageRsi - 50) * 2,
      -100,
      100,
    );

  const scoreMomentum =
    clamp(
      averageScore * 10,
      -100,
      100,
    );

  const momentumScore =
    Math.round(
      rsiMomentum * 0.4 +
        scoreMomentum * 0.3 +
        breadthScore * 0.3,
    );

  /*
   * --------------------------------------------------
   * 6. MOMENTUM ALIGNMENT
   * --------------------------------------------------
   */

  let momentumAlignment:
    MomentumAlignment;

  if (
    momentumScore >= 20
  ) {
    momentumAlignment =
      "BULLISH";
  } else if (
    momentumScore <= -20
  ) {
    momentumAlignment =
      "BEARISH";
  } else {
    momentumAlignment =
      "MIXED";
  }

  /*
   * --------------------------------------------------
   * 7. MARKET MOMENTUM STATE
   * --------------------------------------------------
   */

  let momentum: MarketMomentum;

  if (momentumScore >= 60) {
    momentum = "STRONG";
  } else if (momentumScore >= 25) {
    momentum = "POSITIVE";
  } else if (momentumScore <= -60) {
    momentum = "WEAK";
  } else if (momentumScore <= -25) {
    momentum = "NEGATIVE";
  } else {
    momentum = "NEUTRAL";
  }

  /*
   * --------------------------------------------------
   * 8. VOLATILITY
   * --------------------------------------------------
   */

  const atrPercentages =
    results
      .filter(
        (result) =>
          result.atr14 !== null &&
          result.currentPrice !== null &&
          result.currentPrice > 0 &&
          Number.isFinite(
            result.atr14,
          ),
      )
      .map(
        (result) =>
          ((result.atr14 ?? 0) /
            (result.currentPrice ?? 1)) *
          100,
      );

  const averageAtrPercent =
    atrPercentages.length > 0
      ? atrPercentages.reduce(
          (sum, value) =>
            sum + value,
          0,
        ) /
        atrPercentages.length
      : 0;

  const highVolatilityCount =
    atrPercentages.filter(
      (value) => value >= 5,
    ).length;

  const highVolatilityPercentage =
    percentage(
      highVolatilityCount,
      total,
    );

  /*
   * --------------------------------------------------
   * 9. VOLATILITY SCORE
   * --------------------------------------------------
   *
   * 0 = very compressed
   * 100 = extreme volatility
   */

  const volatilityScore =
    Math.round(
      clamp(
        averageAtrPercent * 20,
        0,
        100,
      ),
    );

  let volatilityState:
    MarketVolatilityState;

  if (volatilityScore >= 80) {
    volatilityState = "EXTREME";
  } else if (volatilityScore >= 50) {
    volatilityState = "HIGH";
  } else if (volatilityScore <= 20) {
    volatilityState = "LOW";
  } else {
    volatilityState = "NORMAL";
  }

  /*
   * --------------------------------------------------
   * 10. VOLATILITY ENVIRONMENT
   * --------------------------------------------------
   */

  let volatilityEnvironment:
    VolatilityEnvironment;

  if (
    volatilityState === "LOW"
  ) {
    volatilityEnvironment =
      "COMPRESSION";
  } else if (
    volatilityState === "HIGH" ||
    volatilityState === "EXTREME"
  ) {
    volatilityEnvironment =
      "EXPANSION";
  } else {
    volatilityEnvironment =
      "NORMAL";
  }

  /*
   * --------------------------------------------------
   * 11. MOMENTUM + VOLATILITY CONFIRMATION
   * --------------------------------------------------
   */

  let momentumVolatilityConfirmation:
    MomentumVolatilityConfirmation;

  if (
    momentumAlignment === "BULLISH" &&
    volatilityEnvironment ===
      "EXPANSION"
  ) {
    momentumVolatilityConfirmation =
      "CONFIRMED";
  } else if (
    momentumAlignment === "BEARISH" &&
    volatilityEnvironment ===
      "EXPANSION"
  ) {
    momentumVolatilityConfirmation =
      "CONFIRMED";
  } else if (
    momentumAlignment === "MIXED" &&
    volatilityEnvironment ===
      "COMPRESSION"
  ) {
    momentumVolatilityConfirmation =
      "CAUTION";
  } else if (
    volatilityEnvironment ===
      "COMPRESSION"
  ) {
    momentumVolatilityConfirmation =
      "CAUTION";
  } else {
    momentumVolatilityConfirmation =
      "CAUTION";
  }

  /*
   * --------------------------------------------------
   * 12. RISK
   * --------------------------------------------------
   */

  let risk: MarketRisk;

  if (
    volatilityState === "EXTREME"
  ) {
    risk = "EXTREME";
  } else if (
    volatilityState === "HIGH"
  ) {
    risk = "HIGH";
  } else if (
    volatilityState === "LOW"
  ) {
    risk = "LOW";
  } else if (
    averageRsi >= 70 ||
    averageRsi <= 30
  ) {
    risk = "MODERATE";
  } else {
    risk = "LOW";
  }

  /*
   * --------------------------------------------------
   * 13. MARKET REGIME
   * --------------------------------------------------
   */

  let regime: MarketRegime;

  if (
    volatilityState === "EXTREME" ||
    (
      volatilityState === "HIGH" &&
      highVolatilityPercentage >= 40
    )
  ) {
    regime =
      "HIGH_VOLATILITY";
  } else if (
    breadthScore >= 20 &&
    momentumScore >= 20 &&
    averageScore > 0
  ) {
    regime = "BULLISH";
  } else if (
    breadthScore <= -20 &&
    momentumScore <= -20 &&
    averageScore < 0
  ) {
    regime = "BEARISH";
  } else {
    regime = "SIDEWAYS";
  }

  /*
   * --------------------------------------------------
   * 14. REASONS
   * --------------------------------------------------
   */

  const reasons: string[] = [];

  if (breadthScore >= 40) {
    reasons.push(
      "Market breadth strongly favors bullish participation.",
    );
  } else if (breadthScore >= 20) {
    reasons.push(
      "Bullish participation is broader than bearish participation.",
    );
  } else if (breadthScore <= -40) {
    reasons.push(
      "Market breadth strongly favors bearish participation.",
    );
  } else if (breadthScore <= -20) {
    reasons.push(
      "Bearish participation is broader than bullish participation.",
    );
  } else {
    reasons.push(
      "Market breadth is mixed.",
    );
  }

  if (momentumScore >= 50) {
    reasons.push(
      "Market momentum is strongly positive.",
    );
  } else if (momentumScore >= 20) {
    reasons.push(
      "Market momentum is positive.",
    );
  } else if (momentumScore <= -50) {
    reasons.push(
      "Market momentum is strongly negative.",
    );
  } else if (momentumScore <= -20) {
    reasons.push(
      "Market momentum is negative.",
    );
  } else {
    reasons.push(
      "Market momentum is relatively neutral.",
    );
  }

  if (
    volatilityEnvironment ===
    "EXPANSION"
  ) {
    reasons.push(
      "Volatility is expanding across the scanned market.",
    );
  } else if (
    volatilityEnvironment ===
    "COMPRESSION"
  ) {
    reasons.push(
      "Volatility is compressed, indicating reduced market expansion.",
    );
  } else {
    reasons.push(
      "Volatility is within a normal operating range.",
    );
  }

  if (
    momentumVolatilityConfirmation ===
    "CONFIRMED"
  ) {
    reasons.push(
      "Momentum and volatility are aligned with the current directional move.",
    );
  } else {
    reasons.push(
      "Momentum and volatility do not provide strong confirmation of a directional expansion.",
    );
  }

  /*
   * --------------------------------------------------
   * 15. OPINION
   * --------------------------------------------------
   */

  let opinion: string;
  let recommendedAction: string;

  if (regime === "BULLISH") {
    if (
      risk === "HIGH" ||
      risk === "EXTREME"
    ) {
      opinion =
        "Market structure is bullish, but elevated volatility increases execution risk. Directional momentum remains positive, but selectivity is important.";

      recommendedAction =
        "Favor only the strongest bullish setups and avoid chasing extended moves.";
    } else {
      opinion =
        "The market shows broad bullish participation with supportive momentum.";

      recommendedAction =
        "Focus on the strongest bullish setups with independent confirmation.";
    }
  } else if (
    regime === "BEARISH"
  ) {
    if (
      risk === "HIGH" ||
      risk === "EXTREME"
    ) {
      opinion =
        "Market structure is bearish while volatility is elevated. Downside momentum is present, but sharp counter-moves remain possible.";

      recommendedAction =
        "Focus only on strong bearish setups and avoid weak signals during volatility expansion.";
    } else {
      opinion =
        "The market shows broad bearish participation with negative momentum.";

      recommendedAction =
        "Focus on the strongest bearish setups with independent confirmation.";
    }
  } else if (
    regime === "HIGH_VOLATILITY"
  ) {
    opinion =
      "Market volatility is elevated across a significant portion of the scanned universe, increasing execution uncertainty.";

    recommendedAction =
      "Wait for stronger confirmation and avoid relying on isolated signals.";
  } else {
    opinion =
      "The market lacks strong directional consensus. Momentum and breadth are not sufficiently aligned for a dominant regime.";

    recommendedAction =
      "Wait for broader market confirmation and prioritize only exceptional setups.";
  }

  /*
   * --------------------------------------------------
   * 16. CONFIDENCE
   * --------------------------------------------------
   */

  const confidence =
    Math.min(
      95,
      Math.max(
        20,
        Math.round(
          averageConfidence * 0.4 +
            Math.abs(
              breadthScore,
            ) *
              0.25 +
            Math.abs(
              momentumScore,
            ) *
              0.2 +
            (strong / total) *
              100 *
              0.15,
        ),
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

    breadthScore,

    momentumScore,
    volatilityScore,

    volatilityState,

    momentumAlignment,

    volatilityEnvironment,

    momentumVolatilityConfirmation,

    breadth: {
      bullish: buy,
      bearish: sell,
      neutral,

      bullishPercentage,
      bearishPercentage,
      neutralPercentage,
    },

    momentum,

    risk,

    opinion,
    recommendedAction,

    reasons,

    signals: {
      strong,
      buy,
      sell,
    },
  };
}