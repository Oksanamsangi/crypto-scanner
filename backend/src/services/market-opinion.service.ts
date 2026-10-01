import type {
  MarketRegimeResult,
} from "./market-regime.service.js";

import type {
  MarketIntelligence,
} from "./market-intelligence.service.js";

import type {
  CrossMarketConfirmation,
} from "./cross-market-confirmation.service.js";

import type {
  RegimeTransitionResult,
} from "./regime-transition.service.js";

export type MarketBias =
  | "STRONG_BULLISH"
  | "BULLISH"
  | "NEUTRAL"
  | "BEARISH"
  | "STRONG_BEARISH";

export type MarketAction =
  | "FAVOR_LONG"
  | "FAVOR_SHORT"
  | "WAIT"
  | "REDUCE_EXPOSURE";

export interface MarketOpinion {
  bias: MarketBias;

  action: MarketAction;

  confidence: number;

  score: number;

  regime: string;

  marketPhase: string;

  momentum: {
    score: number;
    state: string;
  };

  volatility: {
    score: number;
    state: string;
    environment: string;
  };

  breadth: {
    score: number;
    bullishPercentage: number;
    bearishPercentage: number;
  };

  crossMarket: {
    score: number;
    state: string;
    direction: string;
  };

  transition: {
    state: string;
    strength: number;
    earlyWarning: boolean;
  };

  summary: string;

  reasons: string[];

  warnings: string[];
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

export function buildMarketOpinion(
  intelligence: MarketIntelligence,
  regime: MarketRegimeResult,
  crossMarket: CrossMarketConfirmation,
  transition: RegimeTransitionResult,
): MarketOpinion {
  const reasons: string[] = [];
  const warnings: string[] = [];

  /*
   * --------------------------------------------------
   * 1. COMPONENT SCORES
   * --------------------------------------------------
   */

  const breadthScore =
    clamp(
      intelligence.breadthScore,
      -100,
      100,
    );

  const momentumScore =
    clamp(
      intelligence.momentumScore,
      -100,
      100,
    );

  const crossMarketScore =
    clamp(
      crossMarket.score,
      -100,
      100,
    );

  /*
   * Volatility is a risk modifier rather than
   * a directional component.
   */

  let volatilityModifier = 0;

  if (
    intelligence.volatilityState ===
    "HIGH"
  ) {
    volatilityModifier = -8;
  }

  if (
    intelligence.volatilityState ===
    "EXTREME"
  ) {
    volatilityModifier = -18;
  }

  /*
   * --------------------------------------------------
   * 2. DIRECTIONAL SCORE
   * --------------------------------------------------
   */

  const directionalScore =
    breadthScore * 0.30 +
    momentumScore * 0.30 +
    crossMarketScore * 0.40;

  let score =
    Math.round(
      directionalScore +
        volatilityModifier,
    );

  /*
   * Transition conditions reduce conviction.
   */

  if (
    transition.state ===
    "EARLY_WARNING"
  ) {
    score = Math.round(
      score * 0.85,
    );
  }

  if (
    transition.state ===
    "TRANSITION"
  ) {
    score = Math.round(
      score * 0.75,
    );
  }

  if (
    transition.state ===
    "CONFIRMED"
  ) {
    score = Math.round(
      score * 0.90,
    );
  }

  score = clamp(
    score,
    -100,
    100,
  );

  /*
   * --------------------------------------------------
   * 3. BIAS
   * --------------------------------------------------
   */

  let bias: MarketBias;

  if (score >= 60) {
    bias = "STRONG_BULLISH";
  } else if (score >= 25) {
    bias = "BULLISH";
  } else if (score <= -60) {
    bias = "STRONG_BEARISH";
  } else if (score <= -25) {
    bias = "BEARISH";
  } else {
    bias = "NEUTRAL";
  }

  /*
   * --------------------------------------------------
   * 4. ACTION
   * --------------------------------------------------
   */

  let action: MarketAction;

  if (
    intelligence.volatilityState ===
      "EXTREME"
  ) {
    action = "REDUCE_EXPOSURE";
  } else if (
    crossMarket.state ===
      "CONTRADICTED" &&
    Math.abs(score) < 60
  ) {
    action = "WAIT";
  } else if (
    bias === "STRONG_BULLISH" ||
    bias === "BULLISH"
  ) {
    action = "FAVOR_LONG";
  } else if (
    bias === "STRONG_BEARISH" ||
    bias === "BEARISH"
  ) {
    action = "FAVOR_SHORT";
  } else {
    action = "WAIT";
  }

  /*
   * --------------------------------------------------
   * 5. CONFIDENCE
   * --------------------------------------------------
   */

  const componentAgreement =
    (
      Number(
        Math.sign(breadthScore) ===
          Math.sign(score),
      ) +
      Number(
        Math.sign(momentumScore) ===
          Math.sign(score),
      ) +
      Number(
        Math.sign(crossMarketScore) ===
          Math.sign(score),
      )
    ) / 3;

  let confidence =
    regime.confidence * 0.30 +
    intelligence.confidence * 0.25 +
    Math.abs(score) * 0.25 +
    componentAgreement * 100 * 0.20;

  if (
    crossMarket.state ===
    "CONFIRMED"
  ) {
    confidence += 5;
  }

  if (
    crossMarket.state ===
    "CONTRADICTED"
  ) {
    confidence -= 15;
  }

  if (
    transition.state ===
    "EARLY_WARNING"
  ) {
    confidence -= 8;
  }

  if (
    transition.state ===
    "TRANSITION"
  ) {
    confidence -= 12;
  }

  if (
    transition.state ===
    "CONFIRMED"
  ) {
    confidence -= 5;
  }

  confidence = Math.round(
    clamp(
      confidence,
      0,
      100,
    ),
  );

  /*
   * --------------------------------------------------
   * 6. REASONS
   * --------------------------------------------------
   */

  if (
    breadthScore >= 25
  ) {
    reasons.push(
      "Market breadth supports the bullish direction.",
    );
  } else if (
    breadthScore <= -25
  ) {
    reasons.push(
      "Market breadth supports the bearish direction.",
    );
  } else {
    reasons.push(
      "Market breadth does not provide strong directional confirmation.",
    );
  }

  if (
    momentumScore >= 40
  ) {
    reasons.push(
      "Market momentum is strongly supportive of the bullish side.",
    );
  } else if (
    momentumScore >= 20
  ) {
    reasons.push(
      "Market momentum is moderately bullish.",
    );
  } else if (
    momentumScore <= -40
  ) {
    reasons.push(
      "Market momentum is strongly supportive of the bearish side.",
    );
  } else if (
    momentumScore <= -20
  ) {
    reasons.push(
      "Market momentum is moderately bearish.",
    );
  } else {
    reasons.push(
      "Market momentum is neutral.",
    );
  }

  if (
    crossMarket.state ===
    "CONFIRMED"
  ) {
    reasons.push(
      "Cross-market structure confirms the dominant direction.",
    );
  } else if (
    crossMarket.state ===
    "PARTIAL"
  ) {
    reasons.push(
      "Cross-market structure provides partial confirmation.",
    );
  } else {
    reasons.push(
      "Cross-market structure contradicts the dominant direction.",
    );
  }

  if (
    regime.regime ===
    "BREAKOUT"
  ) {
    reasons.push(
      "The market regime engine detects breakout conditions.",
    );
  }

  if (
    regime.regime ===
    "TRENDING_UP"
  ) {
    reasons.push(
      "The market is exhibiting an upward trend structure.",
    );
  }

  if (
    regime.regime ===
    "TRENDING_DOWN"
  ) {
    reasons.push(
      "The market is exhibiting a downward trend structure.",
    );
  }

  /*
   * --------------------------------------------------
   * 7. WARNINGS
   * --------------------------------------------------
   */

  if (
    intelligence.volatilityState ===
    "HIGH"
  ) {
    warnings.push(
      "Elevated volatility increases market uncertainty.",
    );
  }

  if (
    intelligence.volatilityState ===
    "EXTREME"
  ) {
    warnings.push(
      "Extreme volatility materially increases execution risk.",
    );
  }

  if (
    crossMarket.state ===
    "CONTRADICTED"
  ) {
    warnings.push(
      "Major market components are not aligned.",
    );
  }

  if (
    transition.earlyWarning
  ) {
    warnings.push(
      "The market may be approaching a regime transition.",
    );
  }

  if (
    transition.state ===
    "TRANSITION"
  ) {
    warnings.push(
      "The current market regime is actively transitioning.",
    );
  }

  if (
    transition.state ===
    "CONFIRMED"
  ) {
    warnings.push(
      "A meaningful regime transition has been detected.",
    );
  }

  /*
   * --------------------------------------------------
   * 8. SUMMARY
   * --------------------------------------------------
   */

  let summary: string;

  if (
    action ===
    "REDUCE_EXPOSURE"
  ) {
    summary =
      "Market conditions are highly volatile. Directional signals should be treated with reduced conviction.";
  } else if (
    action ===
    "FAVOR_LONG"
  ) {
    summary =
      bias ===
      "STRONG_BULLISH"
        ? "The market has strong bullish alignment across breadth, momentum and cross-market structure."
        : "The market has a bullish directional bias with supportive market structure.";
  } else if (
    action ===
    "FAVOR_SHORT"
  ) {
    summary =
      bias ===
      "STRONG_BEARISH"
        ? "The market has strong bearish alignment across breadth, momentum and cross-market structure."
        : "The market has a bearish directional bias with supportive market structure.";
  } else {
    summary =
      "The market lacks sufficient alignment for a strong directional bias.";
  }

  return {
    bias,

    action,

    confidence,

    score,

    regime:
      regime.regime,

    marketPhase:
      regime.marketPhase,

    momentum: {
      score:
        Math.round(
          momentumScore,
        ),
      state:
        intelligence.momentum,
    },

    volatility: {
      score:
        intelligence.volatilityScore,
      state:
        intelligence.volatilityState,
      environment:
        intelligence.volatilityEnvironment,
    },

    breadth: {
      score:
        Math.round(
          breadthScore,
        ),
      bullishPercentage:
        intelligence.breadth
          .bullishPercentage,
      bearishPercentage:
        intelligence.breadth
          .bearishPercentage,
    },

    crossMarket: {
      score:
        Math.round(
          crossMarketScore,
        ),
      state:
        crossMarket.state,
      direction:
        crossMarket.direction,
    },

    transition: {
      state:
        transition.state,
      strength:
        transition.transitionStrength,
      earlyWarning:
        transition.earlyWarning,
    },

    summary,

    reasons,

    warnings,
  };
}
