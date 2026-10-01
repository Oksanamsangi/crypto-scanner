import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { WhyNotResult } from "./why-not-engine.service.js";
import type { SignalInvalidationResult } from "./signal-invalidation.service.js";
import type { RiskContradictionResult } from "./risk-contradiction.service.js";

import { ClaudeService } from "./claude.service.js";

export type AISignalAssessment =
  | "STRONG"
  | "SUPPORTED"
  | "MIXED"
  | "WEAK"
  | "INVALID";

export interface AISignalAnalysis {
  assessment: AISignalAssessment;
  summary: string;

  signal: {
    direction: string;
    confidence: number;
    strength: number;
    score: number;
  };

  defenses: {
    falseSignalRisk: string;
    falseSignalScore: number;
    conflictState: string;
    conflictScore: number;
    invalidationState: string;
    invalidationScore: number;
    riskState: string;
    riskLevel: string;
    contradictionScore: number;
  };

  decisionContext: {
    recommendation: string;
    shouldReject: boolean;
    invalidated: boolean;
    blockers: string[];
  };

  supportingFactors: string[];
  conflictingFactors: string[];
  risks: string[];
  watchItems: string[];

  recommendedFocus: string;
}

export interface AISignalAnalystInput {
  setup: SetupFingerprint;
  falseSignal?: FalseSignalResult | null;
  conflicts?: SignalConflictResult | null;
  whyNot?: WhyNotResult | null;
  invalidation?: SignalInvalidationResult | null;
  riskContradiction?: RiskContradictionResult | null;
}

export class AISignalAnalystService {
  private readonly claude: ClaudeService;

  constructor(
    claudeService = new ClaudeService(),
  ) {
    this.claude = claudeService;
  }

  async analyze(
    input: AISignalAnalystInput,
  ): Promise<AISignalAnalysis> {
    const {
      setup,
      falseSignal,
      conflicts,
      whyNot,
      invalidation,
      riskContradiction,
    } = input;

    const system = `
You are VELORA's AI Signal Analyst.

Your role is to interpret structured signal-defense
intelligence already calculated by VELORA's deterministic engines.

The deterministic engines have already evaluated:
- false signal risk
- signal conflicts
- rejection reasons
- signal invalidation
- risk contradictions

Do not recalculate scores.
Do not invent market data.
Do not invent historical outcomes.
Do not create a new signal.
Do not claim that a signal will be profitable.
Do not turn the analysis into personalized financial instructions.

Your task is to explain:
1. what supports the existing signal,
2. what conflicts with it,
3. what can invalidate it,
4. what risks remain,
5. what evidence should be monitored.

If deterministic engines indicate rejection, invalidation,
or critical contradiction, clearly reflect that in the analysis.

Return valid JSON only.
`;

    const prompt = `
Analyze this VELORA signal-defense context.

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

Return JSON with exactly these fields:

{
  "assessment": "STRONG | SUPPORTED | MIXED | WEAK | INVALID",
  "summary": "short evidence-based signal assessment",

  "signal": {
    "direction": "BUY | SELL | NEUTRAL",
    "confidence": 0,
    "strength": 0,
    "score": 0
  },

  "defenses": {
    "falseSignalRisk": "risk level",
    "falseSignalScore": 0,
    "conflictState": "state",
    "conflictScore": 0,
    "invalidationState": "state",
    "invalidationScore": 0,
    "riskState": "state",
    "riskLevel": "risk level",
    "contradictionScore": 0
  },

  "decisionContext": {
    "recommendation": "ACCEPT | CAUTION | DO_NOT_TRADE",
    "shouldReject": false,
    "invalidated": false,
    "blockers": []
  },

  "supportingFactors": [],
  "conflictingFactors": [],
  "risks": [],
  "watchItems": [],

  "recommendedFocus": "what evidence should be monitored"
}

Use only information supplied above.
`;

    const raw = await this.claude.generateText(
      system,
      prompt,
      1600,
    );

    return this.parseResponse(
      raw,
      setup,
      falseSignal,
      conflicts,
      whyNot,
      invalidation,
      riskContradiction,
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
  ): AISignalAnalysis {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Partial<AISignalAnalysis>;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        "Claude returned invalid JSON for AI Signal Analyst.",
      );
    }

    const validAssessments: AISignalAssessment[] = [
      "STRONG",
      "SUPPORTED",
      "MIXED",
      "WEAK",
      "INVALID",
    ];

    const assessment = validAssessments.includes(
      parsed.assessment as AISignalAssessment,
    )
      ? (parsed.assessment as AISignalAssessment)
      : this.getFallbackAssessment(
          setup,
          falseSignal,
          conflicts,
          invalidation,
          riskContradiction,
        );

    return {
      assessment,

      summary:
        parsed.summary?.trim() ||
        this.buildFallbackSummary(
          falseSignal,
          conflicts,
          whyNot,
          invalidation,
          riskContradiction,
        ),

      signal: {
        direction:
          parsed.signal?.direction ||
          setup.direction,

        confidence:
          parsed.signal?.confidence ??
          setup.confidence,

        strength:
          parsed.signal?.strength ??
          setup.signalStrength,

        score:
          parsed.signal?.score ??
          setup.score,
      },

      defenses: {
        falseSignalRisk:
          parsed.defenses?.falseSignalRisk ||
          falseSignal?.risk ||
          "UNKNOWN",

        falseSignalScore:
          parsed.defenses?.falseSignalScore ??
          falseSignal?.falseSignalScore ??
          0,

        conflictState:
          parsed.defenses?.conflictState ||
          conflicts?.state ||
          "UNKNOWN",

        conflictScore:
          parsed.defenses?.conflictScore ??
          conflicts?.conflictScore ??
          0,

        invalidationState:
          parsed.defenses?.invalidationState ||
          invalidation?.state ||
          "UNKNOWN",

        invalidationScore:
          parsed.defenses?.invalidationScore ??
          invalidation?.invalidationScore ??
          0,

        riskState:
          parsed.defenses?.riskState ||
          riskContradiction?.state ||
          "UNKNOWN",

        riskLevel:
          parsed.defenses?.riskLevel ||
          riskContradiction?.riskLevel ||
          "UNKNOWN",

        contradictionScore:
          parsed.defenses?.contradictionScore ??
          riskContradiction?.contradictionScore ??
          0,
      },

      decisionContext: {
        recommendation:
          parsed.decisionContext?.recommendation ||
          whyNot?.recommendation ||
          "CAUTION",

        shouldReject:
          parsed.decisionContext?.shouldReject ??
          whyNot?.shouldReject ??
          false,

        invalidated:
          parsed.decisionContext?.invalidated ??
          invalidation?.invalidated ??
          false,

        blockers:
          this.normalizeArray(
            parsed.decisionContext?.blockers,
            [
              ...(whyNot?.blockers ?? []),
              ...(invalidation?.criticalReasons ?? []),
              ...(riskContradiction?.contradictions ?? []),
            ],
          ),
      },

      supportingFactors:
        this.normalizeArray(
          parsed.supportingFactors,
          [
            ...(falseSignal?.protections ?? []),
            ...(conflicts?.agreements ?? []),
            ...(whyNot?.supportingFactors ?? []),
            ...(invalidation?.validConditions ?? []),
            ...(riskContradiction?.protections ?? []),
          ],
        ),

      conflictingFactors:
        this.normalizeArray(
          parsed.conflictingFactors,
          [
            ...(conflicts?.warnings ?? []),
            ...(whyNot?.warnings ?? []),
            ...(invalidation?.warnings ?? []),
            ...(riskContradiction?.warnings ?? []),
          ],
        ),

      risks:
        this.normalizeArray(
          parsed.risks,
          [
            ...(falseSignal?.triggers ?? []),
            ...(riskContradiction?.contradictions ?? []),
            ...(invalidation?.criticalReasons ?? []),
          ],
        ),

      watchItems:
        this.normalizeArray(
          parsed.watchItems,
          [
            ...(invalidation?.invalidationConditions ?? []),
            ...(falseSignal?.triggers ?? []),
            ...(whyNot?.warnings ?? []),
          ],
        ),

      recommendedFocus:
        parsed.recommendedFocus?.trim() ||
        "Monitor signal defenses, invalidation conditions, conflicts, and risk consistency.",
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

  private getFallbackAssessment(
    setup: SetupFingerprint,
    falseSignal?: FalseSignalResult | null,
    conflicts?: SignalConflictResult | null,
    invalidation?: SignalInvalidationResult | null,
    riskContradiction?: RiskContradictionResult | null,
  ): AISignalAssessment {
    if (
      setup.direction === "NEUTRAL" ||
      invalidation?.invalidated ||
      falseSignal?.state === "REJECT" ||
      conflicts?.state === "CONFLICTED" ||
      riskContradiction?.state === "CRITICAL"
    ) {
      return "INVALID";
    }

    if (
      setup.confidence >= 85 &&
      falseSignal?.risk === "LOW" &&
      conflicts?.state === "ALIGNED" &&
      invalidation?.state === "VALID" &&
      riskContradiction?.state === "ALIGNED"
    ) {
      return "STRONG";
    }

    if (
      setup.confidence >= 70 &&
      falseSignal?.risk !== "HIGH" &&
      falseSignal?.risk !== "CRITICAL"
    ) {
      return "SUPPORTED";
    }

    if (
      setup.confidence >= 50 &&
      invalidation?.state !== "INVALIDATED"
    ) {
      return "MIXED";
    }

    return "WEAK";
  }

  private buildFallbackSummary(
    falseSignal?: FalseSignalResult | null,
    conflicts?: SignalConflictResult | null,
    whyNot?: WhyNotResult | null,
    invalidation?: SignalInvalidationResult | null,
    riskContradiction?: RiskContradictionResult | null,
  ): string {
    if (invalidation?.invalidated) {
      return invalidation.explanation;
    }

    if (whyNot?.recommendation === "DO_NOT_TRADE") {
      return whyNot.explanation;
    }

    if (riskContradiction?.state === "CRITICAL") {
      return riskContradiction.explanation;
    }

    if (falseSignal?.state === "REJECT") {
      return falseSignal.explanation;
    }

    if (conflicts?.state === "CONFLICTED") {
      return conflicts.explanation;
    }

    return "Signal assessment is based on the available deterministic signal-defense intelligence.";
  }
}
