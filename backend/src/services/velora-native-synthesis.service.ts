import type { AIIntelligenceAnalysis } from "./ai-intelligence-orchestrator.service.js";
import type { AIIntelligencePipelineResult } from "./ai-intelligence-pipeline.service.js";
import type { MarketIntelligence } from "./market-intelligence.service.js";

export interface VeloraNativeSynthesisInput {
  pipeline: AIIntelligencePipelineResult;
  market: MarketIntelligence;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function directionLabel(signal: string): string {
  if (signal === "BUY") return "bullish";
  if (signal === "SELL") return "bearish";
  return "neutral";
}

function marketOutlook(
  market: MarketIntelligence,
): AIIntelligenceAnalysis["market"]["outlook"] {
  const regime = String(market.regime).toUpperCase();

  if (
    regime.includes("HIGH") ||
    regime.includes("RISK") ||
    market.volatilityState === "HIGH"
  ) {
    return "HIGH_RISK";
  }

  if (market.momentumScore >= 60 && market.breadthScore >= 55) {
    return "BULLISH";
  }

  if (market.momentumScore <= 40 && market.breadthScore <= 45) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function setupAssessment(
  quality: AIIntelligencePipelineResult["setupIntelligence"]["quality"],
): AIIntelligenceAnalysis["setup"]["assessment"] {
  if (quality.qualityScore >= 90) return "STRONG";
  if (quality.qualityScore >= 75) return "PROMISING";
  if (quality.qualityScore >= 60) return "MIXED";
  if (quality.qualityScore >= 40) return "WEAK";
  return "INVALID";
}

function signalAssessment(
  pipeline: AIIntelligencePipelineResult,
): AIIntelligenceAnalysis["signal"]["assessment"] {
  const falseSignal = pipeline.defense.falseSignal;
  const conflicts = pipeline.defense.conflicts;
  const invalidation = pipeline.defense.invalidation;

  /*
   * VELORA synthesis rule:
   * Defense layers describe evidence and risk.
   * They do not automatically become a competing signal engine.
   *
   * Only an explicit false-signal REJECT invalidates the signal itself.
   * Conflicts and invalidation are preserved as cautionary evidence.
   */

  if (falseSignal.state === "REJECT") {
    return "INVALID";
  }

  if (
    falseSignal.state === "CAUTION" ||
    conflicts.state === "CONFLICTED" ||
    conflicts.state === "MIXED" ||
    invalidation.invalidated ||
    invalidation.state === "AT_RISK"
  ) {
    return "MIXED";
  }

  if (pipeline.historical.currentSetup.confidence >= 80) {
    return "STRONG";
  }

  if (pipeline.historical.currentSetup.confidence >= 60) {
    return "SUPPORTED";
  }

  return "WEAK";
}

function decisionAssessment(
  pipeline: AIIntelligencePipelineResult,
): AIIntelligenceAnalysis["decision"]["assessment"] {
  const decision = pipeline.decisionQuality.decisionConfidence;
  const execution = pipeline.strategy.execution;
  const whyNot = pipeline.defense.whyNot;

  /*
   * Decision confidence remains the Decision layer's measurement.
   * Execution blockers and Why-Not warnings describe tradeability,
   * but VELORA must synthesize them rather than blindly inherit them.
   */

  if (decision.executionState === "BLOCKED") {
    return "CONDITIONAL";
  }

  if (
    execution.state === "BLOCKED" ||
    execution.state === "CONDITIONAL" ||
    whyNot.shouldReject ||
    whyNot.recommendation === "CAUTION"
  ) {
    return "CONDITIONAL";
  }

  if (decision.executionState === "CONDITIONAL") {
    return "CONDITIONAL";
  }

  if (decision.decisionConfidence >= 80) {
    return "HIGH_CONVICTION";
  }

  if (decision.decisionConfidence >= 60) {
    return "SUPPORTED";
  }

  return "LOW_CONVICTION";
}

function strategyAssessment(
  pipeline: AIIntelligencePipelineResult,
): AIIntelligenceAnalysis["strategy"]["assessment"] {
  const execution = pipeline.strategy.execution;
  const rules = pipeline.strategy.rules;

  /*
   * Strategy is an execution/evidence layer.
   * Failed rules describe why execution is currently difficult;
   * they do not create a second VELORA verdict.
   */

  if (
    execution.state === "CONDITIONAL" ||
    execution.state === "BLOCKED" ||
    rules.failedRules.length > 0
  ) {
    return "MIXED";
  }

  if (rules.confidence >= 80 && rules.failedRules.length === 0) {
    return "STRONG";
  }

  if (rules.confidence >= 60) {
    return "SUPPORTED";
  }

  return "WEAK";
}

function buildState(
  pipeline: AIIntelligencePipelineResult,
  decision: AIIntelligenceAnalysis["decision"]["assessment"],
  signal: AIIntelligenceAnalysis["signal"]["assessment"],
): AIIntelligenceAnalysis["state"] {
  const {
    falseSignal,
    conflicts,
    invalidation,
    whyNot,
  } = pipeline.defense;

  /*
   * VELORA state is a synthesis state, not an execution-state mirror.
   *
   * A true false-signal REJECT is the only deterministic defense
   * condition that invalidates the underlying signal itself.
   *
   * Conflicts, invalidation warnings, Why-Not rejection and strategy
   * blockers remain important evidence, but are surfaced as risk/
   * conditionality instead of automatically forcing BLOCKED.
   */

  if (falseSignal.state === "REJECT") {
    return "BLOCKED";
  }

  if (
    signal === "INVALID" ||
    decision === "LOW_CONVICTION"
  ) {
    return "LOW_CONVICTION";
  }

  if (
    conflicts.state === "CONFLICTED" ||
    conflicts.state === "MIXED" ||
    invalidation.invalidated ||
    invalidation.state === "AT_RISK" ||
    whyNot.shouldReject ||
    decision === "CONDITIONAL" ||
    signal === "MIXED" ||
    pipeline.strategy.execution.state === "BLOCKED" ||
    pipeline.strategy.execution.state === "CONDITIONAL"
  ) {
    return "CONDITIONAL";
  }

  const confidence =
    pipeline.decisionQuality.decisionConfidence.decisionConfidence;

  if (confidence >= 80 && signal === "STRONG") {
    return "HIGH_CONVICTION";
  }

  return "SUPPORTED";
}

function buildSummary(
  state: AIIntelligenceAnalysis["state"],
  signal: string,
  confidence: number,
): string {
  const direction = directionLabel(signal);

  switch (state) {
    case "HIGH_CONVICTION":
      return `VELORA identifies a high-conviction ${direction} setup with aligned deterministic evidence and ${Math.round(confidence)}% decision confidence.`;

    case "SUPPORTED":
      return `VELORA identifies a supported ${direction} setup with broadly aligned deterministic evidence and ${Math.round(confidence)}% decision confidence.`;

    case "CONDITIONAL":
      return `VELORA identifies a conditional ${direction} setup. Evidence is present, but one or more risk, conflict, or execution conditions require caution.`;

    case "LOW_CONVICTION":
      return `VELORA identifies a low-conviction ${direction} setup. The available evidence is insufficiently aligned for strong confirmation.`;

    case "BLOCKED":
      return `VELORA has blocked the current ${direction} setup because deterministic defense or execution conditions identify a material rejection condition.`;
  }
}

export function buildVeloraNativeSynthesis(
  input: VeloraNativeSynthesisInput,
): AIIntelligenceAnalysis {
  const { pipeline, market } = input;

  const { currentSetup } = pipeline.historical;
  const quality = pipeline.setupIntelligence.quality;
  const falseSignal = pipeline.defense.falseSignal;
  const conflicts = pipeline.defense.conflicts;
  const whyNot = pipeline.defense.whyNot;
  const invalidation = pipeline.defense.invalidation;

  const reliability = pipeline.decisionQuality.reliability;
  const trust = pipeline.decisionQuality.trustScore;
  const decisionConfidence =
    pipeline.decisionQuality.decisionConfidence;

  const execution = pipeline.strategy.execution;
  const rules = pipeline.strategy.rules;

  const setup = setupAssessment(quality);
  const signal = signalAssessment(pipeline);
  const decision = decisionAssessment(pipeline);
  const strategy = strategyAssessment(pipeline);

  const state = buildState(pipeline, decision, signal);

  const blockers = unique([
    ...whyNot.blockers,
    ...decisionConfidence.blockers,
    ...execution.blockers,
    ...invalidation.criticalReasons,
  ]);

  const conflictsList = unique([
    ...conflicts.warnings,
    ...conflicts.conflicts.map(
      (item) => `${item.name}: ${item.reason}`,
    ),
    ...whyNot.warnings,
    ...pipeline.decisionQuality.reliability.warnings,
  ]);

  const risks = unique([
    ...falseSignal.triggers,
    ...pipeline.decisionQuality.trustScore.riskFactors,
    ...pipeline.decisionQuality.decisionConfidence.warnings,
    ...pipeline.strategy.execution.warnings,
    ...pipeline.defense.invalidation.warnings,
  ]);

  const supportingFactors = unique([
    ...quality.strengths,
    ...falseSignal.protections,
    ...conflicts.agreements,
    ...whyNot.supportingFactors,
    ...reliability.supportingFactors,
    ...trust.supportingFactors,
    ...pipeline.decisionQuality.historicalAccuracy.strengths,
  ]);

  const watchItems = unique([
    ...quality.warnings,
    ...whyNot.warnings,
    ...invalidation.warnings,
    ...pipeline.strategy.execution.warnings,
  ]);

  const outlook = marketOutlook(market);

  const marketSummary =
    `Market regime ${String(market.regime)} with ${String(
      market.momentum,
    ).toLowerCase()} momentum and ${String(
      market.volatilityState,
    ).toLowerCase()} volatility. Breadth ${Math.round(
      market.breadthScore,
    )}/100 and momentum ${Math.round(
      market.momentumScore,
    )}/100.`;

  const setupSummary =
    `Setup quality is ${quality.grade} (${Math.round(
      quality.qualityScore,
    )}/100), classified as ${quality.state.toLowerCase()}. ${quality.explanation}`;

  const signalSummary =
    `The ${currentSetup.direction} signal has ${Math.round(
      currentSetup.confidence,
    )}% confidence and ${Math.round(
      currentSetup.signalStrength,
    )} strength. False-signal state is ${falseSignal.state}, conflict state is ${conflicts.state}, and invalidation state is ${invalidation.state}.`;

  const decisionSummary =
    `Decision confidence is ${Math.round(
      decisionConfidence.decisionConfidence,
    )}% (${decisionConfidence.grade}), with trust at ${Math.round(
      trust.trustScore,
    )}/100 and reliability at ${Math.round(
      reliability.reliabilityScore,
    )}/100. Execution state is ${execution.state}.`;

  const strategySummary =
    `VELORA Balanced Analysis is ${strategy.toLowerCase()} with rule confidence ${Math.round(
      rules.confidence,
    )}%. Execution is ${execution.state.toLowerCase()} and direction is ${execution.direction}.`;

  const recommendedFocus =
    state === "BLOCKED"
      ? blockers[0] ??
        "Resolve the deterministic blocking conditions before considering the setup again."
      : watchItems[0] ??
        pipeline.strategy.execution.explanation ??
        "Continue monitoring the deterministic confirmation and invalidation conditions.";

  return {
    state,

    summary: buildSummary(
      state,
      currentSetup.direction,
      decisionConfidence.decisionConfidence,
    ),

    market: {
      outlook,
      summary: marketSummary,
      risk: String(market.risk),
    },

    setup: {
      assessment: setup,
      summary: setupSummary,
      qualityScore: quality.qualityScore,
    },

    signal: {
      assessment: signal,
      summary: signalSummary,
      confidence: clamp(currentSetup.confidence),
      blockers,
    },

    decision: {
      assessment: decision,
      summary: decisionSummary,
      confidence: clamp(decisionConfidence.decisionConfidence),
      trustScore: trust.trustScore,
      blockers,
    },

    strategy: {
      assessment: strategy,
      summary: strategySummary,
      selected: true,
      executionState: execution.state,
    },

    supportingFactors,
    conflicts: conflictsList,
    risks,
    watchItems,

    recommendedFocus,
  };
}
