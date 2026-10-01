import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { HistoricalSimilarity } from "./historical-similarity.service.js";
import type { SetupEvolutionResult } from "./setup-evolution.service.js";
import type { SetupQualityScoreResult } from "./setup-quality-score.service.js";

import { ClaudeService } from "./claude.service.js";

export type AISetupAssessment =
  | "STRONG"
  | "PROMISING"
  | "MIXED"
  | "WEAK"
  | "INVALID";

export interface AISetupAnalysis {
  assessment: AISetupAssessment;
  summary: string;

  setup: {
    direction: string;
    trend: string;
    momentum: string;
    volatility: string;
    volume: string;
  };

  quality: {
    score: number | null;
    grade: string | null;
    state: string | null;
  };

  historicalContext: {
    similarity: number | null;
    comparable: boolean;
    strength: string | null;
  };

  evolution: {
    state: string | null;
    direction: string | null;
    score: number | null;
    improving: boolean;
  };

  supportingFactors: string[];
  conflictingFactors: string[];
  risks: string[];
  watchItems: string[];

  recommendedFocus: string;
}

export interface AISetupAnalystInput {
  fingerprint: SetupFingerprint;
  similarity?: HistoricalSimilarity | null;
  evolution?: SetupEvolutionResult | null;
  quality?: SetupQualityScoreResult | null;
}

export class AISetupAnalystService {
  private readonly claude: ClaudeService;

  constructor(
    claudeService = new ClaudeService(),
  ) {
    this.claude = claudeService;
  }

  async analyze(
    input: AISetupAnalystInput,
  ): Promise<AISetupAnalysis> {
    const {
      fingerprint,
      similarity,
      evolution,
      quality,
    } = input;

    const system = `
You are VELORA's AI Setup Analyst.

Your role is to interpret structured setup intelligence
already calculated by VELORA.

The deterministic engines have already calculated:
- setup fingerprint
- historical similarity
- setup evolution
- setup quality

Do not recalculate indicators.
Do not invent market data.
Do not invent historical outcomes.
Do not claim that a setup will be profitable.
Do not turn the analysis into personalized financial instructions.

Your task is to explain what the existing evidence says,
what supports the setup, what conflicts with it,
and what should be monitored.

Return valid JSON only.
`;

    const prompt = `
Analyze this VELORA setup.

SETUP FINGERPRINT:
${JSON.stringify(fingerprint, null, 2)}

HISTORICAL SIMILARITY:
${JSON.stringify(similarity ?? null, null, 2)}

SETUP EVOLUTION:
${JSON.stringify(evolution ?? null, null, 2)}

SETUP QUALITY:
${JSON.stringify(quality ?? null, null, 2)}

Return JSON with exactly these fields:

{
  "assessment": "STRONG | PROMISING | MIXED | WEAK | INVALID",
  "summary": "short evidence-based setup assessment",

  "setup": {
    "direction": "setup direction",
    "trend": "trend structure",
    "momentum": "momentum structure",
    "volatility": "volatility structure",
    "volume": "volume structure"
  },

  "quality": {
    "score": 0,
    "grade": "grade or null",
    "state": "state or null"
  },

  "historicalContext": {
    "similarity": 0,
    "comparable": false,
    "strength": "strength or null"
  },

  "evolution": {
    "state": "state or null",
    "direction": "direction or null",
    "score": 0,
    "improving": false
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
      1400,
    );

    return this.parseResponse(
      raw,
      fingerprint,
      similarity,
      evolution,
      quality,
    );
  }

  private parseResponse(
    raw: string,
    fingerprint: SetupFingerprint,
    similarity?: HistoricalSimilarity | null,
    evolution?: SetupEvolutionResult | null,
    quality?: SetupQualityScoreResult | null,
  ): AISetupAnalysis {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Partial<AISetupAnalysis>;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        "Claude returned invalid JSON for AI Setup Analyst.",
      );
    }

    const validAssessments: AISetupAssessment[] = [
      "STRONG",
      "PROMISING",
      "MIXED",
      "WEAK",
      "INVALID",
    ];

    const assessment = validAssessments.includes(
      parsed.assessment as AISetupAssessment,
    )
      ? (parsed.assessment as AISetupAssessment)
      : this.getFallbackAssessment(
          fingerprint,
          quality,
        );

    return {
      assessment,

      summary:
        parsed.summary?.trim() ||
        quality?.explanation ||
        "Setup analysis is based on the available deterministic setup intelligence.",

      setup: {
        direction:
          parsed.setup?.direction ||
          fingerprint.direction,

        trend:
          parsed.setup?.trend ||
          fingerprint.trend,

        momentum:
          parsed.setup?.momentum ||
          fingerprint.momentum,

        volatility:
          parsed.setup?.volatility ||
          fingerprint.volatility,

        volume:
          parsed.setup?.volume ||
          fingerprint.volume,
      },

      quality: {
        score:
          parsed.quality?.score ??
          quality?.qualityScore ??
          fingerprint.setupQuality,

        grade:
          parsed.quality?.grade ??
          quality?.grade ??
          null,

        state:
          parsed.quality?.state ??
          quality?.state ??
          null,
      },

      historicalContext: {
        similarity:
          parsed.historicalContext?.similarity ??
          similarity?.similarity ??
          null,

        comparable:
          parsed.historicalContext?.comparable ??
          similarity?.comparable ??
          false,

        strength:
          parsed.historicalContext?.strength ??
          similarity?.strength ??
          null,
      },

      evolution: {
        state:
          parsed.evolution?.state ??
          evolution?.state ??
          null,

        direction:
          parsed.evolution?.direction ??
          evolution?.direction ??
          null,

        score:
          parsed.evolution?.score ??
          evolution?.evolutionScore ??
          null,

        improving:
          parsed.evolution?.improving ??
          this.isImproving(evolution),
      },

      supportingFactors:
        this.normalizeArray(
          parsed.supportingFactors,
          quality?.strengths ?? fingerprint.characteristics,
        ),

      conflictingFactors:
        this.normalizeArray(
          parsed.conflictingFactors,
          quality?.weaknesses ?? [],
        ),

      risks:
        this.normalizeArray(
          parsed.risks,
          quality?.warnings ?? [],
        ),

      watchItems:
        this.normalizeArray(
          parsed.watchItems,
          evolution?.warnings ?? [],
        ),

      recommendedFocus:
        parsed.recommendedFocus?.trim() ||
        "Monitor setup quality, historical comparability, and setup evolution.",
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

  private isImproving(
    evolution?: SetupEvolutionResult | null,
  ): boolean {
    if (!evolution) {
      return false;
    }

    return evolution.evolutionScore > 60;
  }

  private getFallbackAssessment(
    fingerprint: SetupFingerprint,
    quality?: SetupQualityScoreResult | null,
  ): AISetupAssessment {
    const score =
      quality?.qualityScore ??
      fingerprint.setupQuality ??
      0;

    if (
      fingerprint.direction === "NEUTRAL" ||
      score < 40
    ) {
      return "INVALID";
    }

    if (score >= 85) {
      return "STRONG";
    }

    if (score >= 70) {
      return "PROMISING";
    }

    if (score >= 50) {
      return "MIXED";
    }

    return "WEAK";
  }
}
