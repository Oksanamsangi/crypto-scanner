import prisma from "../lib/prisma.js";

import {
  buildSetupFingerprint,
  type SetupFingerprint,
} from "./setup-fingerprint.service.js";

import {
  compareHistoricalSetup,
  type HistoricalSimilarity,
} from "./historical-similarity.service.js";

import {
  analyzeSetupEvolution,
  type SetupEvolutionResult,
} from "./setup-evolution.service.js";

import {
  calculateSetupQualityScore,
  type SetupQualityScoreResult,
} from "./setup-quality-score.service.js";

import {
  recognizePattern,
  type PatternRecognitionResult,
} from "./pattern-recognition.service.js";

import {
  calibrateConfidence,
  type ConfidenceObservation,
} from "./confidence-calibration.service.js";

import {
  assessSignalReliability,
  type SignalReliabilityResult,
} from "./signal-reliability.service.js";

import {
  calculateHistoricalAccuracy,
  type HistoricalSignal,
  type HistoricalAccuracyResult,
} from "./historical-accuracy.service.js";

import {
  calculateTrustScore,
  type TrustScoreResult,
} from "./trust-score.service.js";

import {
  calculateDecisionConfidence,
  type DecisionConfidenceResult,
} from "./decision-confidence.service.js";

import {
  detectFalseSignal,
  type FalseSignalResult,
} from "./false-signal-detector.service.js";

import {
  detectSignalConflicts,
  type SignalConflictResult,
} from "./signal-conflict-detector.service.js";

import {
  buildWhyNotEngine,
  type WhyNotResult,
} from "./why-not-engine.service.js";

import {
  detectSignalInvalidation,
  type SignalInvalidationResult,
} from "./signal-invalidation.service.js";

import {
  defineStrategy,
  type StrategyDefinition,
} from "./strategy-definition.service.js";

import {
  evaluateStrategyRules,
  type StrategyRulesResult,
} from "./strategy-rules-engine.service.js";

import {
  buildStrategyExecutionPlan,
  type ExecutionPlan,
} from "./strategy-execution-engine.service.js";

export interface AIIntelligencePipelineInput {
  symbol: string;
  interval: string;

  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  signalStrength: number;
  score: number;

  currentPrice?: number | null;
  ema20?: number | null;
  ema50?: number | null;
  rsi14?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHistogram?: number | null;
  atr14?: number | null;
  changePercent?: number | null;
  volumeRatio?: number | null;

  context?: {
    finalSignal?: "BUY" | "SELL" | "NEUTRAL" | null;
    finalConfidence?: number | null;
    setupQuality?: number | null;
    decision?: string | null;
    decisionScore?: number | null;
    decisionPriority?: string | null;
    contextScore?: number | null;
  };

  market?: {
    regime?: string | null;
    phase?: string | null;
    momentum?: string | null;
    volatility?: string | null;
    breadthScore?: number | null;
    crossMarketScore?: number | null;
  };
}

export interface AIHistoricalContext {
  currentSetup: SetupFingerprint;
  historicalSetups: SetupFingerprint[];
  similarities: HistoricalSimilarity[];
  completedOutcomes: Array<{
    status: string;
    returnPercent: number;
  }>;
}

export interface AISetupIntelligenceContext {
  pattern: PatternRecognitionResult;
  evolution: SetupEvolutionResult;
  quality: SetupQualityScoreResult;
}

export interface AIDefenseContext {
  falseSignal: FalseSignalResult;
  conflicts: SignalConflictResult;
  whyNot: WhyNotResult;
  invalidation: SignalInvalidationResult;
}

export interface AIDecisionQualityContext {
  historicalAccuracy: HistoricalAccuracyResult;
  calibration: ReturnType<typeof calibrateConfidence>;
  reliability: SignalReliabilityResult;
  trustScore: TrustScoreResult;
  decisionConfidence: DecisionConfidenceResult;

  scannerDecision: {
    decision: string | null;
    decisionScore: number | null;
    priority: string | null;
  };
}

export interface AIStrategyContext {
  strategy: StrategyDefinition;
  rules: StrategyRulesResult;
  execution: ExecutionPlan;
}

export interface AIIntelligencePipelineResult {
  historical: AIHistoricalContext;
  setupIntelligence: AISetupIntelligenceContext;
  defense: AIDefenseContext;
  decisionQuality: AIDecisionQualityContext;
  strategy: AIStrategyContext;
  technical: {
    currentPrice: number | null;
    ema20: number | null;
    ema50: number | null;
    rsi14: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    atr14: number | null;
    volumeRatio: number | null;
  };
}

function toFingerprint(row: {
  id: string;
  symbol: string;
  interval: string;
  direction: string;
  trend: string;
  momentum: string;
  volatility: string;
  volume: string;
  confidence: number;
  signalStrength: number;
  score: number;
  rsi: number | null;
  atr: number | null;
  emaStructure: string;
  priceVsEma: string;
  changePercent: number | null;
  volumeRatio: number | null;
  setupQuality: number | null;
  contextConfidence: number | null;
  marketRegime: string | null;
  marketPhase: string | null;
  breadthScore: number | null;
  crossMarketScore: number | null;
  characteristics: unknown;
  fingerprint: string;
}): SetupFingerprint {
  return {
    id: row.id,
    symbol: row.symbol,
    interval: row.interval,
    direction: row.direction as SetupFingerprint["direction"],
    trend: row.trend as SetupFingerprint["trend"],
    momentum: row.momentum as SetupFingerprint["momentum"],
    volatility: row.volatility as SetupFingerprint["volatility"],
    volume: row.volume as SetupFingerprint["volume"],
    confidence: row.confidence,
    signalStrength: row.signalStrength,
    score: row.score,
    rsi: row.rsi,
    atr: row.atr,
    emaStructure:
      row.emaStructure as SetupFingerprint["emaStructure"],
    priceVsEma:
      row.priceVsEma as SetupFingerprint["priceVsEma"],
    changePercent: row.changePercent,
    volumeRatio: row.volumeRatio,
    setupQuality: row.setupQuality,
    contextConfidence: row.contextConfidence,
    marketRegime: row.marketRegime,
    marketPhase: row.marketPhase,
    breadthScore: row.breadthScore,
    crossMarketScore: row.crossMarketScore,
    characteristics: Array.isArray(row.characteristics)
      ? row.characteristics.filter(
          (value): value is string =>
            typeof value === "string",
        )
      : [],
    fingerprint: row.fingerprint,
  };
}

export class AIIntelligencePipelineService {
  async build(
    input: AIIntelligencePipelineInput,
  ): Promise<AIIntelligencePipelineResult> {
    const currentSetup = buildSetupFingerprint({
      symbol: input.symbol,
      interval: input.interval,
      signal: input.signal,
      confidence: input.confidence,
      signalStrength: input.signalStrength,
      score: input.score,
      ...(input.currentPrice !== undefined
        ? { currentPrice: input.currentPrice }
        : {}),
      ...(input.ema20 !== undefined
        ? { ema20: input.ema20 }
        : {}),
      ...(input.ema50 !== undefined
        ? { ema50: input.ema50 }
        : {}),
      ...(input.rsi14 !== undefined
        ? { rsi14: input.rsi14 }
        : {}),
      ...(input.atr14 !== undefined
        ? { atr14: input.atr14 }
        : {}),
      ...(input.changePercent !== undefined
        ? { changePercent: input.changePercent }
        : {}),
      ...(input.volumeRatio !== undefined
        ? { volumeRatio: input.volumeRatio }
        : {}),
      ...(input.context !== undefined
        ? { context: input.context }
        : {}),
      ...(input.market !== undefined
        ? { market: input.market }
        : {}),
    });

    const rows = await prisma.setupMemory.findMany({
      where: {
        symbol: input.symbol,
        interval: input.interval,
      },
      orderBy: {
        observedAt: "desc",
      },
      take: 50,
    });

    const historicalSetups = rows.map(toFingerprint);

    const similarities = historicalSetups
      .filter((setup) => setup.id !== currentSetup.id)
      .map((setup) =>
        compareHistoricalSetup(
          currentSetup,
          setup,
        ),
      )
      .sort(
        (a, b) =>
          b.similarity - a.similarity,
      )
      .slice(0, 10);

    const topSimilarity =
      similarities[0] ?? null;

    const pattern =
      recognizePattern(
        currentSetup,
        historicalSetups,
        10,
      );

    const evolution =
      analyzeSetupEvolution(
        currentSetup,
        historicalSetups,
        10,
      );

    const quality =
      calculateSetupQualityScore(
        currentSetup,
        topSimilarity,
        pattern,
        evolution,
      );

    const marketContext = input.market
      ? {
          ...(input.market.breadthScore !== undefined
            ? { breadthScore: input.market.breadthScore }
            : {}),
          ...(input.market.crossMarketScore !== undefined
            ? { crossMarketScore: input.market.crossMarketScore }
            : {}),
          ...(input.market.regime !== undefined
            ? { regime: input.market.regime }
            : {}),
          ...(input.market.momentum !== undefined
            ? { momentum: input.market.momentum }
            : {}),
          ...(input.market.volatility !== undefined
            ? { volatilityState: input.market.volatility }
            : {}),
        }
      : null;

    const falseSignal = detectFalseSignal({
      setup: currentSetup,
      quality,
      pattern,
      evolution,
      market: marketContext,
    });

    const conflicts = detectSignalConflicts({
      setup: currentSetup,
      quality,
      pattern,
      evolution,
      market: marketContext,
    });

    const whyNot = buildWhyNotEngine({
      setup: currentSetup,
      quality,
      pattern,
      evolution,
      falseSignal,
      conflicts,
      market: marketContext,
    });

    const previousSetup =
      historicalSetups.find(
        (setup) =>
          setup.symbol === currentSetup.symbol &&
          setup.interval === currentSetup.interval &&
          setup.id !== currentSetup.id,
      ) ?? null;

    const invalidation = detectSignalInvalidation({
      setup: currentSetup,
      previous: previousSetup,
      evolution,
      conflicts,
      falseSignal,
      market: marketContext,
    });

    const strategy = defineStrategy({
      id: "velora-balanced-analysis",
      name: "VELORA Balanced Analysis",
      description:
        "Default deterministic strategy profile used to evaluate the current setup without making an execution recommendation.",
      direction: "BOTH",
      riskProfile: "BALANCED",
      status: "ACTIVE",
      tags: [
        "VELORA",
        "DEFAULT",
        "ANALYSIS",
      ],
    });

    const strategyRules = evaluateStrategyRules({
      strategy,
      setup: currentSetup,
      pattern,
      falseSignal,
      conflicts,
      market: marketContext
        ? {
            ...(marketContext.regime !== undefined
              ? { regime: marketContext.regime }
              : {}),
            ...(marketContext.breadthScore !== undefined
              ? { breadthScore: marketContext.breadthScore }
              : {}),
            ...(marketContext.crossMarketScore !== undefined
              ? { crossMarketScore: marketContext.crossMarketScore }
              : {}),
          }
        : null,
    });

    const strategyExecution =
      buildStrategyExecutionPlan({
        strategy,
        setup: currentSetup,
        rules: strategyRules,
      });

    const completedRows = rows.filter(
      (row) =>
        row.outcomeStatus !== null &&
        row.outcomeReturn !== null &&
        Number.isFinite(row.outcomeReturn),
    );

    const completedOutcomes = completedRows.map((row) => ({
      status: row.outcomeStatus as string,
      returnPercent: row.outcomeReturn as number,
    }));

    const historicalSignals: HistoricalSignal[] =
      completedRows
        .filter(
          (row) =>
            row.outcomeStatus === "WIN" ||
            row.outcomeStatus === "LOSS" ||
            row.outcomeStatus === "BREAKEVEN",
        )
        .map((row) => ({
          id: row.id,
          confidence: row.confidence,
          direction:
            row.direction === "SHORT" || row.direction === "SELL"
              ? "SHORT"
              : "LONG",
          outcome: row.outcomeStatus as
            | "WIN"
            | "LOSS"
            | "BREAKEVEN",
          returnPercent: row.outcomeReturn as number,
          completedAt: row.outcomeAt,
        }));

    const historicalAccuracy =
      calculateHistoricalAccuracy(
        historicalSignals,
      );

    const confidenceObservations: ConfidenceObservation[] =
      historicalSignals.map((signal) => ({
        confidence: signal.confidence,
        outcome: signal.outcome,
      }));

    const calibration = calibrateConfidence(
      input.context?.finalConfidence ??
        input.confidence,
      confidenceObservations,
    );

    const reliability = assessSignalReliability({
      confidence:
        input.context?.finalConfidence ??
        input.confidence,
      setupQuality: quality.qualityScore,
      calibration,
      falseSignal,
      conflicts,
      pattern,
      marketConfirmation:
        input.market?.crossMarketScore ?? null,
      sampleSize:
        historicalAccuracy.sampleSize,
    });

    const trustScore = calculateTrustScore({
      confidence:
        input.context?.finalConfidence ??
        input.confidence,
      calibration,
      reliability,
      historicalAccuracy,
      setupQuality: quality,
      falseSignal,
      conflicts,
    });

    const decisionConfidence =
      calculateDecisionConfidence({
        confidence:
          input.context?.finalConfidence ??
          input.confidence,
        calibration,
        reliability,
        historicalAccuracy,
        trustScore,
        falseSignal,
        conflicts,
        execution: strategyExecution,
      });

    return {
      historical: {
        currentSetup,
        historicalSetups,
        similarities,
        completedOutcomes,
      },
      setupIntelligence: {
        pattern,
        evolution,
        quality,
      },
      defense: {
        falseSignal,
        conflicts,
        whyNot,
        invalidation,
      },
      decisionQuality: {
        historicalAccuracy,
        calibration,
        reliability,
        trustScore,
        decisionConfidence,

        scannerDecision: {
          decision:
            input.context?.decision ??
            null,
          decisionScore:
            input.context?.decisionScore ??
            null,
          priority:
            input.context?.decisionPriority ??
            null,
        },
      },
      strategy: {
        strategy,
        rules: strategyRules,
        execution: strategyExecution,
      },
      technical: {
        currentPrice: input.currentPrice ?? null,
        ema20: input.ema20 ?? null,
        ema50: input.ema50 ?? null,
        rsi14: input.rsi14 ?? null,
        macd: input.macd ?? null,
        macdSignal: input.macdSignal ?? null,
        macdHistogram: input.macdHistogram ?? null,
        atr14: input.atr14 ?? null,
        volumeRatio: input.volumeRatio ?? null,
      },
    };
  }
}
