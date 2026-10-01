import {
  ContextAwareSignalService,
} from "../services/context-aware-signal.service.js";
import {
  getMarketSnapshot,
} from "../intellegence/marketData.js";
import {
  buildContextIntelligence,
} from "../services/context-intelligence-adapter.service.js";
import { evaluateDecision } from "../services/decision-engine.service.js";
import express from "express";

import {
  AIIntelligenceBridgeService,
} from "../services/ai-intelligence-bridge.service.js";

import {
  AIIntelligencePipelineService,
  type AIIntelligencePipelineInput,
} from "../services/ai-intelligence-pipeline.service.js";

import type { MarketIntelligence } from "../services/market-intelligence.service.js";
import type { ScanResult } from "../services/scanner.service.js";

const router = express.Router();

const pipeline = new AIIntelligencePipelineService();
const bridge = new AIIntelligenceBridgeService();

function signalStrengthToScore(
  signalStrength: ScanResult["signalStrength"],
): number {
  switch (signalStrength) {
    case "STRONG":
      return 100;

    case "MODERATE":
      return 70;

    case "WEAK":
      return 40;

    case "NONE":
    default:
      return 0;
  }
}

function isScanResult(value: unknown): value is ScanResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<ScanResult>;

  return (
    typeof result.symbol === "string" &&
    typeof result.timeframe === "string" &&
    typeof result.signal === "string" &&
    typeof result.confidence === "number" &&
    typeof result.score === "number" &&
    typeof result.signalStrength === "string"
  );
}

function isMarketIntelligence(
  value: unknown,
): value is MarketIntelligence {
  if (!value || typeof value !== "object") {
    return false;
  }

  const market = value as Partial<MarketIntelligence>;

  return (
    typeof market.regime === "string" &&
    typeof market.confidence === "number" &&
    typeof market.breadthScore === "number" &&
    typeof market.momentumScore === "number" &&
    typeof market.volatilityScore === "number" &&
    typeof market.volatilityState === "string" &&
    typeof market.momentumAlignment === "string" &&
    typeof market.volatilityEnvironment === "string" &&
    typeof market.momentum === "string" &&
    typeof market.risk === "string" &&
    Array.isArray(market.reasons)
  );
}

router.post("/analyze", async (req, res) => {
  console.log("[VELORA AI ROUTE HIT]", new Date().toISOString());
  try {
    const body = req.body as {
      result?: unknown;
      market?: unknown;
    };

    if (!isScanResult(body.result)) {
      return res.status(400).json({
        error:
          "AI intelligence requires a valid scanner result.",
      });
    }

    if (!isMarketIntelligence(body.market)) {
      return res.status(400).json({
        error:
          "AI intelligence requires market intelligence from the scanner.",
      });
    }

    const result = body.result;
    const market = body.market;

    let contextResult = null;
    let decisionResult = null;

    if (result.signal !== "NEUTRAL") {
      const snapshot = await getMarketSnapshot(
        result.symbol,
        result.timeframe,
      );

      const contextIntelligence =
        buildContextIntelligence(
          result,
          snapshot,
        );

      const contextAwareSignalService =
        new ContextAwareSignalService();

      contextResult =
        contextAwareSignalService.analyze(
          {
            signal: result.signal,
            confidence: result.confidence,
            signalStrength:
              result.signalStrength,
            score: result.score,
          },
          contextIntelligence,
        );

      decisionResult =
        evaluateDecision(
          contextResult,
          result.riskRewardRatio,
        );
    }

    const pipelineInput: AIIntelligencePipelineInput = {
      symbol: result.symbol,
      interval: result.timeframe,
      signal: result.signal,
      confidence: result.confidence,
      signalStrength:
        signalStrengthToScore(
          result.signalStrength,
        ),
      score: result.score,

      currentPrice: result.currentPrice,
      ema20: result.ema20,
      ema50: result.ema50,
      rsi14: result.rsi14,
      macd: result.macd,
      macdSignal: result.macdSignal,
      macdHistogram: result.macdHistogram,
      atr14: result.atr14,

      changePercent: null,
      volumeRatio: null,

      context: {
        finalSignal:
          contextResult?.finalSignal ??
          result.signal,
        finalConfidence:
          contextResult?.finalConfidence ??
          result.confidence,
        setupQuality:
          contextResult?.setupQuality === "EXCELLENT"
            ? 100
            : contextResult?.setupQuality === "GOOD"
              ? 80
              : contextResult?.setupQuality === "CAUTION"
                ? 60
                : contextResult?.setupQuality === "POOR"
                  ? 40
                  : contextResult?.setupQuality === "INVALID"
                    ? 20
                    : null,
        decision:
          contextResult?.decision ??
          null,
        decisionScore:
          decisionResult?.decisionScore ??
          null,
        decisionPriority:
          decisionResult?.priority ??
          null,
        contextScore: null,
      },

      market: {
        regime: market.regime,
        phase: null,
        momentum: market.momentum,
        volatility: market.volatilityState,
        breadthScore: market.breadthScore,
        crossMarketScore: null,
      },
    };

    const pipelineResult =
      await pipeline.build(
        pipelineInput,
      );

    console.log(
      "[VELORA AI DIAGNOSTIC]",
      JSON.stringify(
        {
          symbol: result.symbol,
          signal: result.signal,
          confidence: result.confidence,
          signalStrength: result.signalStrength,
          falseSignal: pipelineResult.defense.falseSignal,
          conflicts: pipelineResult.defense.conflicts,
          whyNot: pipelineResult.defense.whyNot,
          invalidation: pipelineResult.defense.invalidation,
          decisionConfidence:
            pipelineResult.decisionQuality.decisionConfidence,
          trustScore:
            pipelineResult.decisionQuality.trustScore,
          reliability:
            pipelineResult.decisionQuality.reliability,
          execution:
            pipelineResult.strategy.execution,
          rules:
            pipelineResult.strategy.rules,
        },
        null,
        2,
      ),
    );

    const analysis =
      await bridge.analyze({
        pipeline: pipelineResult,
        market,
      });

    return res.json({
      symbol: result.symbol,
      interval: result.timeframe,
      analysis,
    });
  } catch (error) {
    console.error(
      "AI intelligence analysis failed:",
      error,
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "AI intelligence analysis failed.",
    });
  }
});

export default router;
