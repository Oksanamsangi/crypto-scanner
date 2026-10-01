import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { WhyNotResult } from "./why-not-engine.service.js";
import type { SignalInvalidationResult } from "./signal-invalidation.service.js";
import type { RiskContradictionResult } from "./risk-contradiction.service.js";
import type { TrustScoreResult } from "./trust-score.service.js";
import type { DecisionConfidenceResult } from "./decision-confidence.service.js";
import type { SignalReliabilityResult } from "./signal-reliability.service.js";
import type { ConfidenceCalibrationResult } from "./confidence-calibration.service.js";
import type { HistoricalAccuracyResult } from "./historical-accuracy.service.js";
import type { ExecutionPlan } from "./strategy-execution-engine.service.js";

import { ClaudeService } from "./claude.service.js";

export type AIDecisionAssessment =
  | "HIGH_CONVICTION"
  | "SUPPORTED"
  | "CONDITIONAL"
  | "LOW_CONVICTION"
  | "BLOCKED";

export interface AIDecisionAnalysis {
  assessment: AIDecisionAssessment;
  summary: string;

  decision: {
    state: string;
    executionState: string;
    confidence: number;
    trustScore: number | null;
    reliabilityScore: number | null;
  };

  evidence: {
    supportingFactors: string[];
    conflictingFactors: string[];
    blockers: string[];
    risks: string[];
  };

  quality: {
    calibrationState: string | null;
    historicalAccuracy: number | null;
    sampleSize: number;
    falseSignalRisk: string | null;
    conflictState: string | null;
    riskState: string | null;
    invalidationState: string | null;
  };

  strategy: {
    executionState: string;
    direction: string;
    warnings: string[];
    blockers: string[];
  };

  watchItems: string[];
  recommendedFocus: string;
}

export interface AIDecisionAnalystInput {
  setup: SetupFingerprint;

  falseSignal?: FalseSignalResult | null;
  conflicts?: SignalConflictResult | null;
  whyNot?: WhyNotResult | null;
  invalidation?: SignalInvalidationResult | null;
  riskContradiction?: RiskContradictionResult | null;

  calibration?: ConfidenceCalibrationResult | null;
  reliability?: SignalReliabilityResult | null;
  historicalAccuracy?: HistoricalAccuracyResult | null;
  trustScore?: TrustScoreResult | null;
  decisionConfidence?: DecisionConfidenceResult | null;

  execution?: ExecutionPlan | null;
}

export class AIDecisionAnalystService {
  private readonly claude: ClaudeService;

  constructor(
    claudeService = new ClaudeService(),
  ) {
    this.claude = claudeService;
  }

  async analyze(
    input: AIDecisionAnalystInput,
  ): Promise<AIDecisionAnalysis> {
    const {
      setup,
      falseSignal,
      conflicts,
      whyNot,
      invalidation,
      riskContradiction,
      calibration,
      reliability,
      historicalAccuracy,
      trustScore,
      decisionConfidence,
      execution,
    } = input;

    const system = `
You are VELORA's AI Decision Analyst.

Your role is to explain the final decision context
already calculated by VELORA's deterministic intelligence engines.

VELORA has already calculated:
- setup intelligence
- signal defenses
- false signal risk
- signal conflicts
- rejection reasons
- signal invalidation
- risk contradictions
- confidence calibration
- signal reliability
- historical accuracy
- trust score
- decision confidence
- strategy execution state

Do not recalculate scores.
Do not invent data.
Do not invent historical outcomes.
Do not create a new signal.
Do not override deterministic engine results.
Do not claim that any outcome is guaranteed.
Do not provide personalized financial instructions.

The most important rule is:

SIGNAL != DECISION.

Explain why the existing VELORA decision has its current
strength or weakness.

If the deterministic system is BLOCKED, INVALIDATED,
REJECTED, or otherwise indicates a blocker, clearly preserve
that conclusion.

Return valid JSON only.
`;

    const prompt = `
Analyze this complete VELORA decision context.

<setup>
${JSON.stringify(setup, null, 2)}
</setup>

<false_signal>
${JSON.stringify(falseSignal ?? null, null, 2)}
</false_signal>

<conflicts>
${JSON.stringify(conflicts ?? null, null, 2)}
</conflicts>

<why_not>
${JSON.stringify(whyNot ?? null, null, 2)}
</why_not>

<invalidation>
${JSON.stringify(invalidation ?? null, null, 2)}
</invalidation>

<risk_contradiction>
${JSON.stringify(riskContradiction ?? null, null, 2)}
</risk_contradiction>

<calibration>
${JSON.stringify(calibration ?? null, null, 2)}
</calibration>

<reliability>
${JSON.stringify(reliability ?? null, null, 2)}
</reliability>

<historical_accuracy>
${JSON.stringify(historicalAccuracy ?? null, null, 2)}
</historical_accuracy>

<trust_score>
${JSON.stringify(trustScore ?? null, null, 2)}
</trust_score>

<decision_confidence>
${JSON.stringify(decisionConfidence ?? null, null, 2)}
</decision_confidence>

<strategy_execution>
${JSON.stringify(execution ?? null, null, 2)}
</strategy_execution>

Return JSON with exactly these fields:

{
  "assessment": "HIGH_CONVICTION | SUPPORTED | CONDITIONAL | LOW_CONVICTION | BLOCKED",

  "summary": "short evidence-based explanation of the final decision context",

  "decision": {
    "state": "decision state",
    "executionState": "APPROVED | CONDITIONAL | BLOCKED | UNKNOWN",
    "confidence": 0,
    "trustScore": 0,
    "reliabilityScore": 0
  },

  "evidence": {
    "supportingFactors": [],
    "conflictingFactors": [],
    "blockers": [],
    "risks": []
  },

  "quality": {
    "calibrationState": "state or null",
    "historicalAccuracy": 0,
    "sampleSize": 0,
    "falseSignalRisk": "risk or null",
    "conflictState": "state or null",
    "riskState": "state or null",
    "invalidationState": "state or null"
  },

  "strategy": {
    "executionState": "APPROVED | CONDITIONAL | BLOCKED | UNKNOWN",
    "direction": "LONG | SHORT | NONE | UNKNOWN",
    "warnings": [],
    "blockers": []
  },

  "watchItems": [],
  "recommendedFocus": "what evidence should continue to be monitored"
}

Use only information supplied above.
`;

    const raw = await this.claude.generateText(
      system,
      prompt,
      1800,
    );

    return this.parseResponse(
      raw,
      setup,
      falseSignal,
      conflicts,
      whyNot,
      invalidation,
      riskContradiction,
      calibration,
      reliability,
      historicalAccuracy,
      trustScore,
      decisionConfidence,
      execution,
    );
  }

  private parseResponse(
    raw: string,
    setup: SetupFingerprint,
    falseSignal?: FalseSignalResult | null,
    conflicts?: SignalConflictResult | null,
    whyNot?: WhyNotResult | null,
    invalidation?: SignalInvalidationResult | null,
    riskContradiction?: RiskContradictionResult | null,
    calibration?: ConfidenceCalibrationResult | null,
    reliability?: SignalReliabilityResult | null,
    historicalAccuracy?: HistoricalAccuracyResult | null,
    trustScore?: TrustScoreResult | null,
    decisionConfidence?: DecisionConfidenceResult | null,
    execution?: ExecutionPlan | null,
  ): AIDecisionAnalysis {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Partial<AIDecisionAnalysis>;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        "Claude returned invalid JSON for AI Decision Analyst.",
      );
    }

    const validAssessments: AIDecisionAssessment[] = [
      "HIGH_CONVICTION",
      "SUPPORTED",
      "CONDITIONAL",
      "LOW_CONVICTION",
      "BLOCKED",
    ];

    const assessment = validAssessments.includes(
      parsed.assessment as AIDecisionAssessment,
    )
      ? (parsed.assessment as AIDecisionAssessment)
      : this.getFallbackAssessment(
          decisionConfidence,
          execution,
          invalidation,
          falseSignal,
          conflicts,
          riskContradiction,
        );

    const executionState =
      decisionConfidence?.executionState ??
      this.getExecutionState(execution);

    return {
      assessment,

      summary:
        parsed.summary?.trim() ||
        decisionConfidence?.explanation ||
        "Decision analysis is based on the available VELORA intelligence.",

      decision: {
        state:
          parsed.decision?.state ||
          decisionConfidence?.state ||
          "UNKNOWN",

        executionState:
          parsed.decision?.executionState ||
          executionState,

        confidence:
          parsed.decision?.confidence ??
          decisionConfidence?.decisionConfidence ??
          setup.confidence,

        trustScore:
          parsed.decision?.trustScore ??
          trustScore?.trustScore ??
          null,

        reliabilityScore:
          parsed.decision?.reliabilityScore ??
          reliability?.reliabilityScore ??
          null,
      },

      evidence: {
        supportingFactors:
          this.normalizeArray(
            parsed.evidence?.supportingFactors,
            [
              ...(decisionConfidence?.reasons ?? []),
              ...(trustScore?.supportingFactors ?? []),
              ...(reliability?.supportingFactors ?? []),
              ...(falseSignal?.protections ?? []),
              ...(conflicts?.agreements ?? []),
            ],
          ),

        conflictingFactors:
          this.normalizeArray(
            parsed.evidence?.conflictingFactors,
            [
              ...(decisionConfidence?.warnings ?? []),
              ...(trustScore?.riskFactors ?? []),
              ...(reliability?.riskFactors ?? []),
              ...(conflicts?.warnings ?? []),
              ...(invalidation?.warnings ?? []),
            ],
          ),

        blockers:
          this.normalizeArray(
            parsed.evidence?.blockers,
            [
              ...(decisionConfidence?.blockers ?? []),
              ...(whyNot?.blockers ?? []),
              ...(invalidation?.criticalReasons ?? []),
              ...(riskContradiction?.contradictions ?? []),
              ...(execution?.blockers ?? []),
            ],
          ),

        risks:
          this.normalizeArray(
            parsed.evidence?.risks,
            [
              ...(falseSignal?.triggers ?? []),
              ...(riskContradiction?.contradictions ?? []),
              ...(reliability?.riskFactors ?? []),
            ],
          ),
      },

      quality: {
        calibrationState:
          parsed.quality?.calibrationState ||
          calibration?.calibrationState ||
          null,

        historicalAccuracy:
          parsed.quality?.historicalAccuracy ??
          historicalAccuracy?.accuracy ??
          null,

        sampleSize:
          parsed.quality?.sampleSize ??
          decisionConfidence?.sampleSize ??
          trustScore?.sampleSize ??
          historicalAccuracy?.sampleSize ??
          reliability?.sampleSize ??
          calibration?.sampleSize ??
          0,

        falseSignalRisk:
          parsed.quality?.falseSignalRisk ||
          falseSignal?.risk ||
          null,

        conflictState:
          parsed.quality?.conflictState ||
          conflicts?.state ||
          null,

        riskState:
          parsed.quality?.riskState ||
          riskContradiction?.state ||
          null,

        invalidationState:
          parsed.quality?.invalidationState ||
          invalidation?.state ||
          null,
      },

      strategy: {
        executionState:
          parsed.strategy?.executionState ||
          executionState,

        direction:
          parsed.strategy?.direction ||
          execution?.direction ||
          "UNKNOWN",

        warnings:
          this.normalizeArray(
            parsed.strategy?.warnings,
            execution?.warnings ?? [],
          ),

        blockers:
          this.normalizeArray(
            parsed.strategy?.blockers,
            execution?.blockers ?? [],
          ),
      },

      watchItems:
        this.normalizeArray(
          parsed.watchItems,
          [
            ...(decisionConfidence?.warnings ?? []),
            ...(invalidation?.invalidationConditions ?? []),
            ...(falseSignal?.triggers ?? []),
            ...(whyNot?.warnings ?? []),
          ],
        ),

      recommendedFocus:
        parsed.recommendedFocus?.trim() ||
        "Monitor decision confidence, trust, reliability, invalidation conditions, and risk consistency.",
    };
  }

  private normalizeArray(
    value: unknown,
    fallback: string[],
  ): string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }

    return value
      .filter(
        (item): item is string =>
          typeof item === "string",
      )
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private getExecutionState(
    execution?: ExecutionPlan | null,
  ): "APPROVED" | "CONDITIONAL" | "BLOCKED" | "UNKNOWN" {
    if (!execution) {
      return "UNKNOWN";
    }

    if (execution.state === "APPROVED") {
      return "APPROVED";
    }

    if (execution.state === "CONDITIONAL") {
      return "CONDITIONAL";
    }

    if (execution.state === "BLOCKED") {
      return "BLOCKED";
    }

    return "UNKNOWN";
  }

  private getFallbackAssessment(
    decisionConfidence?: DecisionConfidenceResult | null,
    execution?: ExecutionPlan | null,
    invalidation?: SignalInvalidationResult | null,
    falseSignal?: FalseSignalResult | null,
    conflicts?: SignalConflictResult | null,
    riskContradiction?: RiskContradictionResult | null,
  ): AIDecisionAssessment {
    if (
      execution?.state === "BLOCKED" ||
      decisionConfidence?.executionState === "BLOCKED" ||
      invalidation?.invalidated ||
      falseSignal?.state === "REJECT" ||
      conflicts?.state === "CONFLICTED" ||
      riskContradiction?.state === "CRITICAL"
    ) {
      return "BLOCKED";
    }

    if (
      decisionConfidence &&
      decisionConfidence.decisionConfidence >= 90 &&
      execution?.state === "APPROVED"
    ) {
      return "HIGH_CONVICTION";
    }

    if (
      decisionConfidence &&
      decisionConfidence.decisionConfidence >= 75 &&
      execution?.state === "APPROVED"
    ) {
      return "SUPPORTED";
    }

    if (
      execution?.state === "CONDITIONAL" ||
      decisionConfidence?.state === "MODERATE"
    ) {
      return "CONDITIONAL";
    }

    return "LOW_CONVICTION";
  }
}
