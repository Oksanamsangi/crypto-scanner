import type {
  AIIntelligenceAnalysis,
  VELORAAIAnalystOpinion,
} from "./ai-intelligence-orchestrator.service.js";
import type { AIIntelligencePipelineResult } from "./ai-intelligence-pipeline.service.js";
import type { MarketIntelligence } from "./market-intelligence.service.js";

type AnalystInput = {
  pipeline: AIIntelligencePipelineResult;
  market: MarketIntelligence;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function directionLabel(
  direction: string,
): string {
  if (direction === "BUY") return "bullish";
  if (direction === "SELL") return "bearish";
  return "neutral";
}

function buildAction(
  pipeline: AIIntelligencePipelineResult,
): VELORAAIAnalystOpinion["action"] {
  const setup = pipeline.historical.currentSetup;
  const defense = pipeline.defense;
  const decision = pipeline.decisionQuality.decisionConfidence;
  const execution = pipeline.strategy.execution;
  const quality = pipeline.setupIntelligence.quality;

  /*
   * VELORA is a synthesis layer.
   * It must respect the Scanner's directional signal and must not
   * manufacture BUY/SELL from individual indicators.
   */

  if (defense.falseSignal.state === "REJECT") {
    return "AVOID";
  }

  const direction = setup.direction;

  if (direction !== "BUY" && direction !== "SELL") {
    return "WAIT";
  }

  if (
    defense.conflicts.state === "CONFLICTED" ||
    defense.invalidation.invalidated
  ) {
    return "WAIT";
  }

  if (
    decision.executionState === "BLOCKED" ||
    execution.state === "BLOCKED"
  ) {
    return "WAIT";
  }

  if (quality.qualityScore < 60) {
    return "WAIT";
  }

  return direction;
}

function buildRisk(
  pipeline: AIIntelligencePipelineResult,
): VELORAAIAnalystOpinion["risk"] {
  const {
    falseSignal,
    invalidation,
    conflicts,
  } = pipeline.defense;

  const execution = pipeline.strategy.execution;

  if (
    invalidation.invalidated ||
    falseSignal.state === "REJECT"
  ) {
    return "EXTREME";
  }

  if (conflicts.state === "CONFLICTED") {
    return "HIGH";
  }

  if (
    conflicts.state === "MIXED" ||
    execution.state === "CONDITIONAL"
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function buildTechnicalEvidence(
  pipeline: AIIntelligencePipelineResult,
): {
  supporting: string[];
  conflicts: string[];
} {
  const technical = pipeline.technical;
  const setup = pipeline.historical.currentSetup;
  const supporting: string[] = [];
  const conflicts: string[] = [];

  if (
    technical.currentPrice !== null &&
    technical.ema20 !== null &&
    technical.ema50 !== null
  ) {
    const price = technical.currentPrice;
    const ema20 = technical.ema20;
    const ema50 = technical.ema50;

    if (setup.direction === "BUY") {
      if (price > ema20 && price > ema50) {
        supporting.push(
          `Price ${price.toFixed(4)} is above EMA20 ${ema20.toFixed(4)} and EMA50 ${ema50.toFixed(4)}.`
        );
      } else {
        conflicts.push(
          `Price ${price.toFixed(4)} is not above both EMA20 ${ema20.toFixed(4)} and EMA50 ${ema50.toFixed(4)}.`
        );
      }
    }

    if (setup.direction === "SELL") {
      if (price < ema20 && price < ema50) {
        supporting.push(
          `Price ${price.toFixed(4)} is below EMA20 ${ema20.toFixed(4)} and EMA50 ${ema50.toFixed(4)}.`
        );
      } else {
        conflicts.push(
          `Price ${price.toFixed(4)} is not below both EMA20 ${ema20.toFixed(4)} and EMA50 ${ema50.toFixed(4)}.`
        );
      }
    }

    if (ema20 > ema50) {
      if (setup.direction === "BUY") {
        supporting.push(
          `EMA structure is bullish: EMA20 ${ema20.toFixed(4)} is above EMA50 ${ema50.toFixed(4)}.`
        );
      } else if (setup.direction === "SELL") {
        conflicts.push(
          `EMA structure is bullish: EMA20 ${ema20.toFixed(4)} is above EMA50 ${ema50.toFixed(4)}.`
        );
      }
    } else if (ema20 < ema50) {
      if (setup.direction === "SELL") {
        supporting.push(
          `EMA structure is bearish: EMA20 ${ema20.toFixed(4)} is below EMA50 ${ema50.toFixed(4)}.`
        );
      } else if (setup.direction === "BUY") {
        conflicts.push(
          `EMA structure is bearish: EMA20 ${ema20.toFixed(4)} is below EMA50 ${ema50.toFixed(4)}.`
        );
      }
    }
  }

  if (
    technical.rsi14 !== null
  ) {
    const rsi = technical.rsi14;

    if (setup.direction === "BUY") {
      if (rsi >= 50 && rsi <= 70) {
        supporting.push(`RSI14 is ${rsi.toFixed(2)}, supporting bullish momentum without an extreme reading.`);
      } else if (rsi < 45) {
        conflicts.push(`RSI14 is ${rsi.toFixed(2)}, showing weak bullish momentum.`);
      } else if (rsi > 70) {
        conflicts.push(`RSI14 is ${rsi.toFixed(2)}, indicating an overbought condition.`);
      }
    }

    if (setup.direction === "SELL") {
      if (rsi <= 50 && rsi >= 30) {
        supporting.push(`RSI14 is ${rsi.toFixed(2)}, supporting bearish momentum without an extreme reading.`);
      } else if (rsi > 55) {
        conflicts.push(`RSI14 is ${rsi.toFixed(2)}, showing weak bearish momentum.`);
      } else if (rsi < 30) {
        conflicts.push(`RSI14 is ${rsi.toFixed(2)}, indicating an oversold condition.`);
      }
    }
  }

  if (
    technical.macd !== null &&
    technical.macdSignal !== null &&
    technical.macdHistogram !== null
  ) {
    const macd = technical.macd;
    const signal = technical.macdSignal;
    const histogram = technical.macdHistogram;

    if (setup.direction === "BUY") {
      if (macd > signal && histogram > 0) {
        supporting.push(
          `MACD is bullish: ${macd.toFixed(6)} above signal ${signal.toFixed(6)}, with histogram ${histogram.toFixed(6)}.`
        );
      } else {
        conflicts.push(
          `MACD is not bullish: MACD ${macd.toFixed(6)}, signal ${signal.toFixed(6)}, histogram ${histogram.toFixed(6)}.`
        );
      }
    }

    if (setup.direction === "SELL") {
      if (macd < signal && histogram < 0) {
        supporting.push(
          `MACD is bearish: ${macd.toFixed(6)} below signal ${signal.toFixed(6)}, with histogram ${histogram.toFixed(6)}.`
        );
      } else {
        conflicts.push(
          `MACD is not bearish: MACD ${macd.toFixed(6)}, signal ${signal.toFixed(6)}, histogram ${histogram.toFixed(6)}.`
        );
      }
    }
  }

  if (technical.atr14 !== null) {
    supporting.push(`ATR14 is ${technical.atr14.toFixed(6)}, describing the current volatility range.`);
  }

  return {
    supporting,
    conflicts,
  };
}

function buildReasons(
  pipeline: AIIntelligencePipelineResult,
  market: MarketIntelligence,
): {
  supporting: string[];
  conflicts: string[];
  risks: string[];
} {
  const technicalEvidence = buildTechnicalEvidence(pipeline);

  const { currentSetup } = pipeline.historical;
  const quality = pipeline.setupIntelligence.quality;
  const defense = pipeline.defense;
  const decision = pipeline.decisionQuality;
  const execution = pipeline.strategy.execution;

  const supporting = unique([
    ...quality.strengths,
    ...defense.falseSignal.protections,
    ...defense.conflicts.agreements,
    ...defense.whyNot.supportingFactors,
    ...decision.reliability.supportingFactors,
    ...decision.trustScore.supportingFactors,
    ...decision.historicalAccuracy.strengths,
  ]);

  /*
   * Add concrete facts from the existing market/technical layers.
   * These are descriptive observations, not a new VELORA score.
   */
  if (currentSetup.direction === "BUY") {
    supporting.push(
      "The existing signal direction is BUY.",
    );
  } else if (currentSetup.direction === "SELL") {
    supporting.push(
      "The existing signal direction is SELL.",
    );
  }

  if (currentSetup.confidence >= 80) {
    supporting.push(
      `The existing signal layer rates the ${currentSetup.direction} signal at ${Math.round(currentSetup.confidence)}% confidence.`,
    );
  }

  if (quality.qualityScore >= 75) {
    supporting.push(
      `The existing Setup Quality layer rates the setup at ${Math.round(quality.qualityScore)}/100.`,
    );
  } else if (quality.qualityScore >= 60) {
    supporting.push(
      `The existing Setup Quality layer rates the setup at ${Math.round(quality.qualityScore)}/100, which supports the current directional idea.`,
    );
  }

  const conflicts = [
    ...defense.conflicts.warnings,
    ...defense.conflicts.conflicts.map(
      (item) => `${item.name}: ${item.reason}`,
    ),
    ...defense.whyNot.warnings,
    ...decision.reliability.warnings,
  ];

  /*
   * Translate the existing setup fingerprint into concrete,
   * human-readable evidence. No new score is calculated here.
   */
  if (currentSetup.emaStructure === "BULLISH") {
    supporting.push(
      "EMA structure is bullish.",
    );
  } else if (currentSetup.emaStructure === "BEARISH") {
    supporting.push(
      "EMA structure is bearish.",
    );
  }

  if (
    currentSetup.priceVsEma === "ABOVE_BOTH"
  ) {
    supporting.push(
      "Price is above both EMA20 and EMA50.",
    );
  } else if (
    currentSetup.priceVsEma === "BELOW_BOTH"
  ) {
    supporting.push(
      "Price is below both EMA20 and EMA50.",
    );
  } else if (
    currentSetup.priceVsEma === "BETWEEN"
  ) {
    conflicts.push(
      "Price is trading between EMA20 and EMA50, reducing trend confirmation.",
    );
  }

  if (currentSetup.rsi !== null) {
    if (
      currentSetup.direction === "BUY" &&
      currentSetup.rsi >= 50 &&
      currentSetup.rsi < 70
    ) {
      supporting.push(
        `RSI is ${currentSetup.rsi.toFixed(2)}, remaining in a bullish range without reaching the overbought threshold.`,
      );
    } else if (
      currentSetup.direction === "BUY" &&
      currentSetup.rsi >= 70
    ) {
      conflicts.push(
        `RSI is ${currentSetup.rsi.toFixed(2)}, indicating an overbought condition that limits additional bullish confirmation.`,
      );
    } else if (
      currentSetup.direction === "SELL" &&
      currentSetup.rsi <= 50 &&
      currentSetup.rsi > 30
    ) {
      supporting.push(
        `RSI is ${currentSetup.rsi.toFixed(2)}, supporting the bearish direction.`,
      );
    } else if (
      currentSetup.direction === "SELL" &&
      currentSetup.rsi <= 30
    ) {
      conflicts.push(
        `RSI is ${currentSetup.rsi.toFixed(2)}, indicating an oversold condition that limits additional bearish confirmation.`,
      );
    }
  }

  if (currentSetup.volume === "VERY_HIGH" || currentSetup.volume === "HIGH") {
    supporting.push(
      `Volume is ${currentSetup.volume.toLowerCase().replace("_", " ")}, providing additional participation confirmation.`,
    );
  } else if (
    currentSetup.volume === "WEAK" ||
    currentSetup.volume === "VERY_WEAK"
  ) {
    conflicts.push(
      `Volume is ${currentSetup.volume.toLowerCase().replace("_", " ")}, providing limited participation confirmation.`,
    );
  }

  if (
    (currentSetup.trend === "STRONG_UP" || currentSetup.trend === "UP") &&
    currentSetup.direction === "BUY"
  ) {
    supporting.push(
      "The underlying trend is bullish and aligned with the BUY direction.",
    );
  } else if (
    (currentSetup.trend === "STRONG_DOWN" || currentSetup.trend === "DOWN") &&
    currentSetup.direction === "SELL"
  ) {
    supporting.push(
      "The underlying trend is bearish and aligned with the SELL direction.",
    );
  }

  /*
   * Market context is supporting evidence when aligned and
   * opposing/contextual evidence when the broader regime is weaker
   * than the individual setup.
   */
  const regime = String(market.regime).toUpperCase();
  const momentum = String(market.momentum).toUpperCase();

  if (
    currentSetup.direction === "BUY" &&
    regime === "BULLISH"
  ) {
    supporting.push(
      "The broader market regime is BULLISH, supporting the BUY direction.",
    );
  } else if (
    currentSetup.direction === "SELL" &&
    regime === "BEARISH"
  ) {
    supporting.push(
      "The broader market regime is BEARISH, supporting the SELL direction.",
    );
  } else if (regime !== "NEUTRAL") {
    conflicts.push(
      `The broader market regime is ${regime}, which is not fully aligned with the ${currentSetup.direction} setup.`,
    );
  }

  if (momentum === "POSITIVE") {
    supporting.push(
      `Broader market momentum is POSITIVE with a score of ${Math.round(market.momentumScore)}/100.`,
    );
  } else if (momentum === "NEGATIVE") {
    conflicts.push(
      `Broader market momentum is NEGATIVE with a score of ${Math.round(market.momentumScore)}/100.`,
    );
  } else {
    conflicts.push(
      `Broader market momentum is NEUTRAL with a score of ${Math.round(market.momentumScore)}/100.`,
    );
  }

  if (market.breadthScore >= 60) {
    supporting.push(
      `Market breadth is supportive at ${Math.round(market.breadthScore)}/100.`,
    );
  } else {
    conflicts.push(
      `Market breadth is weak at ${Math.round(market.breadthScore)}/100.`,
    );
  }

  const risks = unique([
    ...defense.falseSignal.triggers,
    ...decision.trustScore.riskFactors,
    ...decision.decisionConfidence.warnings,
    ...execution.warnings,
    ...defense.invalidation.warnings,
  ]);

  if (
    decision.decisionConfidence.sampleSize === 0
  ) {
    risks.push(
      "No historical sample is available to validate the current decision pattern.",
    );
  }


  const synthesisConflicts = conflicts.filter(
    (reason) =>
      !reason.startsWith("Setup quality is moderate at ") &&
      reason !== "Strategy execution is conditional." &&
      reason !==
        "No historical sample is available.",
  );

  const synthesisRisks = risks.filter(
    (reason) =>
      reason !== "Strategy execution is conditional." &&
      reason !==
        "No historical sample is available." &&
      reason !==
        "No historical sample is available to validate the current decision pattern.",
  );

  return {
    supporting: unique([
      ...technicalEvidence.supporting,
      ...supporting,
    ]).slice(0, 8),
    conflicts: unique([
      ...technicalEvidence.conflicts,
      ...synthesisConflicts,
    ]).slice(0, 8),
    risks: unique(synthesisRisks).slice(0, 8),
  };
}

function buildThesis(
  action: VELORAAIAnalystOpinion["action"],
  pipeline: AIIntelligencePipelineResult,
): string {
  const direction = directionLabel(
    pipeline.historical.currentSetup.direction,
  );

  if (action === "BUY") {
    return `The existing VELORA evidence is sufficiently aligned around a ${direction} setup. This conclusion comes from the existing Scanner, Setup, Defense, Decision and Strategy layers rather than from a separate VELORA score.`;
  }

  if (action === "SELL") {
    return `The existing VELORA evidence is sufficiently aligned around a ${direction} setup. This conclusion comes from the existing Scanner, Setup, Defense, Decision and Strategy layers rather than from a separate VELORA score.`;
  }

  if (action === "AVOID") {
    return `The existing defensive layers identify a material invalidation or rejection condition. VELORA therefore treats the current setup as unsuitable until those conditions are resolved.`;
  }

  return `The current market evidence is mixed and does not provide sufficient alignment for an immediate directional conclusion. VELORA therefore recommends waiting rather than manufacturing a BUY or SELL signal from individual indicators.`;
}

function buildConfirmation(
  pipeline: AIIntelligencePipelineResult,
): string {
  const setup =
    pipeline.historical.currentSetup;

  const conflicts =
    pipeline.defense.conflicts;

  if (pipeline.defense.invalidation.invalidated) {
    return "Reconsider only after the existing invalidation condition is cleared.";
  }

  if (pipeline.defense.falseSignal.state === "REJECT") {
    return "Reconsider after the existing false-signal defense no longer rejects the setup.";
  }

  if (conflicts.state !== "ALIGNED") {
    return "Wait for the conflicting market evidence to resolve before taking a directional position.";
  }

  const direction =
    setup.direction === "SELL"
      ? "SELL"
      : setup.direction === "BUY"
        ? "BUY"
        : "directional";

  return `The existing ${direction} direction is supported by the Scanner decision and should be monitored against the existing market conditions.`;
}

function buildInvalidation(
  pipeline: AIIntelligencePipelineResult,
): string {
  const reasons =
    pipeline.defense.invalidation.criticalReasons;

  if (reasons.length > 0) {
    return reasons[0] ?? "The existing invalidation layer has identified a critical condition.";
  }

  return pipeline.historical.currentSetup.direction ===
    "BUY"
    ? "Reconsider if the existing bullish structure materially deteriorates."
    : pipeline.historical.currentSetup.direction ===
        "SELL"
      ? "Reconsider if the existing bearish structure materially deteriorates."
      : "Reconsider if the existing directional evidence changes materially.";
}

function buildMarketView(
  market: MarketIntelligence,
): string {
  return (
    `Market regime is ${String(market.regime)}, ` +
    `with ${String(market.momentum).toLowerCase()} momentum, ` +
    `${String(market.volatilityState).toLowerCase()} volatility, ` +
    `breadth at ${Math.round(market.breadthScore)}/100 ` +
    `and market momentum at ${Math.round(market.momentumScore)}/100.`
  );
}

function buildFinalAssessment(
  action: VELORAAIAnalystOpinion["action"],
  pipeline: AIIntelligencePipelineResult,
): string {
  const direction =
    pipeline.historical.currentSetup.direction;

  switch (action) {
    case "BUY":
      return `BUY — the existing VELORA layers are sufficiently aligned around the ${direction} signal.`;

    case "SELL":
      return `SELL — the existing VELORA layers are sufficiently aligned around the ${direction} signal.`;

    case "AVOID":
      return "AVOID — an existing defense or invalidation layer identifies a material problem with the current setup.";

    default:
      return "WAIT — the existing evidence is not sufficiently aligned for an immediate directional conclusion.";
  }
}

function buildNativeOpinion({
  pipeline,
  market,
}: AnalystInput): VELORAAIAnalystOpinion {
  const action = buildAction(pipeline);

  const risk = buildRisk(pipeline);

  const {
    supporting,
    conflicts,
    risks,
  } = buildReasons(pipeline, market);

  const setup =
    pipeline.setupIntelligence.quality;

  const direction =
    pipeline.historical.currentSetup.direction;

  /*
   * There is deliberately no new VELORA confidence score.
   *
   * The field remains in the API for compatibility with
   * the existing frontend, but it mirrors the strongest
   * existing decision-layer confidence rather than creating
   * another evaluation system.
   */
  const scannerDecision =
    pipeline.decisionQuality.scannerDecision;

  /*
   * The Scanner Decision is the source-of-truth for the
   * directional decision. The internal decisionConfidence
   * layer remains validation evidence and must not create
   * a competing VELORA decision score.
   */
  const confidence =
    scannerDecision.decisionScore ??
    pipeline.decisionQuality.decisionConfidence
      .decisionConfidence;

  const scannerScore =
    scannerDecision.decisionScore;

  const upside =
    action === "BUY" || action === "SELL"
      ? scannerScore !== null
        ? scannerScore >= 85
          ? "HIGH"
          : scannerScore >= 70
            ? "MEDIUM"
            : "LOW"
        : setup.qualityScore >= 75
          ? "HIGH"
          : setup.qualityScore >= 60
            ? "MEDIUM"
            : "LOW"
      : "MEDIUM";

  const downside =
    risk === "EXTREME" || risk === "HIGH"
      ? "HIGH"
      : risk === "MEDIUM"
        ? "MEDIUM"
        : "LOW";

  const thesis = buildThesis(
    action,
    pipeline,
  );

  const confirmation =
    buildConfirmation(pipeline);

  const invalidation =
    buildInvalidation(pipeline);

  /*
   * Keep the analyst sections concise and evidence-driven.
   * Bull Case contains positive setup evidence.
   * Bear Case contains opposing/contextual evidence.
   * Risks contains execution and validation limitations.
   */
  const bullCase =
    supporting.length > 0
      ? supporting.slice(0, 5).join(" ")
      : "No material supporting evidence is currently reported by the existing analysis layers.";

  const bearCase =
    conflicts.length > 0
      ? conflicts.slice(0, 5).join(" ")
      : "No material opposing evidence is currently reported by the existing analysis layers.";

  const whyDecision = [
    scannerDecision.decision
      ? scannerDecision.decisionScore !== null
        ? `Scanner Decision is ${scannerDecision.decision} with a decision score of ${scannerDecision.decisionScore}/100 and ${String(scannerDecision.priority ?? "UNSPECIFIED")} priority.`
        : `Scanner Decision is ${scannerDecision.decision} with ${String(scannerDecision.priority ?? "UNSPECIFIED")} priority.`
      : "No Scanner Decision is available.",
    ...supporting.slice(0, 2),
    ...conflicts.slice(0, 2),
  ];

  return {
    action,
    confidence,
    risk,
    upside,
    downside,
    marketView: buildMarketView(market),
    bullCase,
    bearCase,
    thesis,
    risks,
    whyDecision: unique(whyDecision).slice(0, 5),
    entryView:
      action === "WAIT"
        ? "Wait for the existing conflicting or conditional conditions to resolve."
        : action === "AVOID"
          ? "Do not act on the current setup until the existing blocking condition is resolved."
          : `The existing analysis supports considering the ${direction.toLowerCase()} direction while its current conditions remain intact.`,
    confirmation,
    invalidation,
    finalAssessment:
      buildFinalAssessment(
        action,
        pipeline,
      ),
  };
}

export function buildVeloraAIAnalyst(
  input: AnalystInput,
  base: AIIntelligenceAnalysis,
): AIIntelligenceAnalysis {
  const clean = (value: string): boolean =>
    !value.startsWith("Setup quality is moderate at ") &&
    value !== "Strategy execution is conditional." &&
    value !== "No historical sample is available." &&
    value !== "No historical sample is available to validate the current decision pattern.";

  return {
    ...base,
    signal: {
      ...base.signal,
      blockers: base.signal.blockers.filter(clean),
    },
    decision: {
      ...base.decision,
      blockers: base.decision.blockers.filter(clean),
    },
    supportingFactors:
      base.supportingFactors.filter(clean),
    conflicts:
      base.conflicts.filter(clean),
    risks:
      base.risks.filter(clean),
    aiAnalyst: buildNativeOpinion(
      input,
    ),
  };
}
