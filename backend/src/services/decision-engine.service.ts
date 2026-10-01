type Signal = "BUY" | "SELL" | "NEUTRAL";

type SetupQuality =
  | "EXCELLENT"
  | "GOOD"
  | "CAUTION"
  | "POOR"
  | "INVALID";

type ContextDecision =
  | "TRADE"
  | "WAIT"
  | "AVOID";

interface ContextAwareResult {
  finalSignal: Signal;
  baseConfidence: number;
  finalConfidence: number;
  adjustment: number;
  setupQuality: SetupQuality;
  decision: ContextDecision;

  context: {
    regime: string;
    regimeConfidence: number;
    trendStrength: number;
    marketPhase: string;
    volatilityState: string;
    momentumState: string;
    volumeState: string;
    pricePosition: number;
  };

  reasons: string[];
}

export type DecisionPriority =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export interface DecisionEngineResult {
  decisionScore: number;
  priority: DecisionPriority;
  reasons: string[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function volumeScore(state: string): number {
  switch (state) {
    case "STRONG":
      return 100;
    case "ABOVE_AVERAGE":
      return 75;
    case "NORMAL":
      return 55;
    case "WEAK":
      return 35;
    case "VERY_WEAK":
      return 15;
    default:
      return 50;
  }
}

function riskRewardScore(
  riskRewardRatio?: number | null,
): number {
  if (typeof riskRewardRatio !== "number") {
    return 50;
  }

  if (riskRewardRatio <= 0) {
    return 0;
  }

  return clamp((riskRewardRatio / 3) * 100);
}

export function evaluateDecision(
  result: ContextAwareResult,
  riskRewardRatio?: number | null,
): DecisionEngineResult {
  const reasons: string[] = [];

  const confidence = clamp(result.finalConfidence);
  const regime = clamp(result.context.regimeConfidence);
  const trend = clamp(result.context.trendStrength);
  const volume = volumeScore(result.context.volumeState);
  const riskReward = riskRewardScore(riskRewardRatio);

  /*
   * Decision score is a weighted synthesis, not an additive score.
   *
   * This prevents several positive factors from pushing the result
   * above 100 and then collapsing different setups into the same score.
   */
  let score =
    confidence * 0.55 +
    regime * 0.15 +
    trend * 0.10 +
    volume * 0.10 +
    riskReward * 0.10;

  /*
   * Setup quality modifier.
   */
  if (result.setupQuality === "EXCELLENT") {
    score += 3;
    reasons.push("Excellent setup quality supports the decision.");
  } else if (result.setupQuality === "GOOD") {
    score += 1;
  } else if (result.setupQuality === "CAUTION") {
    score -= 5;
    reasons.push("Caution-level setup quality reduces decision confidence.");
  } else if (result.setupQuality === "POOR") {
    score -= 12;
    reasons.push("Poor setup quality significantly reduces decision confidence.");
  } else if (result.setupQuality === "INVALID") {
    score -= 25;
    reasons.push("Invalid setup quality strongly reduces decision confidence.");
  }

  /*
   * Volatility modifier.
   */
  if (result.context.volatilityState === "HIGH") {
    score -= 4;
    reasons.push("High volatility reduces decision confidence.");
  } else if (result.context.volatilityState === "LOW") {
    score -= 1;
  }

  /*
   * Volume explanation.
   */
  if (result.context.volumeState === "STRONG") {
    reasons.push("Strong volume supports the setup.");
  } else if (result.context.volumeState === "ABOVE_AVERAGE") {
    reasons.push("Above-average volume supports the setup.");
  } else if (result.context.volumeState === "WEAK") {
    score -= 3;
    reasons.push("Weak volume reduces setup priority.");
  } else if (result.context.volumeState === "VERY_WEAK") {
    score -= 7;
    reasons.push("Very weak volume significantly reduces setup priority.");
  }

  /*
   * Risk/reward explanation.
   */
  if (typeof riskRewardRatio === "number") {
    if (riskRewardRatio >= 3) {
      reasons.push("Excellent risk/reward profile.");
    } else if (riskRewardRatio >= 2) {
      reasons.push("Strong risk/reward profile.");
    } else if (riskRewardRatio >= 1.5) {
      reasons.push("Acceptable risk/reward profile.");
    } else {
      score -= 6;
      reasons.push("Weak risk/reward profile.");
    }
  }

  /*
   * Context decision is a gate on the final score.
   */
  if (result.decision === "WAIT") {
    score *= 0.82;
    reasons.push("Context recommends waiting for stronger confirmation.");
  } else if (result.decision === "AVOID") {
    score *= 0.55;
    reasons.push("Context recommends avoiding the setup.");
  }

  const decisionScore = Math.round(clamp(score));

  let priority: DecisionPriority;

  if (
    result.decision === "TRADE" &&
    decisionScore >= 85
  ) {
    priority = "HIGH";
  } else if (
    result.decision === "TRADE" &&
    decisionScore >= 70
  ) {
    priority = "MEDIUM";
  } else {
    priority = "LOW";
  }

  return {
    decisionScore,
    priority,
    reasons,
  };
}
