import type { AIMarketAnalysis } from "./ai-market-analyst.service.js";
import type { AISetupAnalysis } from "./ai-setup-analyst.service.js";
import type { AISignalAnalysis } from "./ai-signal-analyst.service.js";
import type { AIDecisionAnalysis } from "./ai-decision-analyst.service.js";
import type { AIStrategyAnalysis } from "./ai-strategy-analyst.service.js";
import { ClaudeService } from "./claude.service.js";

export type AIIntelligenceState =
  | "HIGH_CONVICTION"
  | "SUPPORTED"
  | "CONDITIONAL"
  | "LOW_CONVICTION"
  | "BLOCKED";

export interface VELORAAIAnalystOpinion {
  action: "BUY" | "SELL" | "WAIT" | "AVOID";
  confidence: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  upside: "LOW" | "MEDIUM" | "HIGH";
  downside: "LOW" | "MEDIUM" | "HIGH";
  marketView: string;
  bullCase: string;
  bearCase: string;
  thesis: string;
  risks: string[];
  whyDecision: string[];
  entryView: string;
  confirmation: string;
  invalidation: string;
  finalAssessment: string;
}

export interface AIIntelligenceAnalysis {
  state: AIIntelligenceState;
  summary: string;

  market: {
    outlook: AIMarketAnalysis["outlook"];
    summary: string;
    risk: string;
  };

  setup: {
    assessment: AISetupAnalysis["assessment"];
    summary: string;
    qualityScore: number | null;
  };

  signal: {
    assessment: AISignalAnalysis["assessment"];
    summary: string;
    confidence: number;
    blockers: string[];
  };

  decision: {
    assessment: AIDecisionAnalysis["assessment"];
    summary: string;
    confidence: number;
    trustScore: number | null;
    blockers: string[];
  };

  strategy: {
    assessment: AIStrategyAnalysis["assessment"];
    summary: string;
    selected: boolean;
    executionState: string;
  };

  supportingFactors: string[];
  conflicts: string[];
  risks: string[];
  watchItems: string[];

  recommendedFocus: string;
  aiAnalyst?: VELORAAIAnalystOpinion;
}

export interface AIIntelligenceInput {
  market: AIMarketAnalysis;
  setup: AISetupAnalysis;
  signal: AISignalAnalysis;
  decision: AIDecisionAnalysis;
  strategy: AIStrategyAnalysis;
}

export class AIIntelligenceOrchestratorService {
  private readonly claude: ClaudeService;

  constructor(
    claudeService = new ClaudeService(),
  ) {
    this.claude = claudeService;
  }

  async analyze(
    input: AIIntelligenceInput,
  ): Promise<AIIntelligenceAnalysis> {
    const {
      market,
      setup,
      signal,
      decision,
      strategy,
    } = input;

    const system = `
You are VELORA's AI Intelligence Orchestrator.

You synthesize five deterministic AI analysis layers:

Market → Setup → Signal → Decision → Strategy

Each layer has already been analyzed by a specialized VELORA AI analyst.

Your job is to produce ONE coherent intelligence summary.

Do not:
- invent data,
- recalculate scores,
- create new signals,
- create new strategies,
- override deterministic blockers,
- claim guaranteed or expected profits,
- provide personalized financial instructions.

Preserve contradictions when they exist.

The final state must reflect the strongest blocking condition.
A BLOCKED decision must remain BLOCKED even if other layers appear strong.

Return valid JSON only.
`;

    const prompt = `
Synthesize the following VELORA intelligence layers.

<market_analysis>
${JSON.stringify(market, null, 2)}
</market_analysis>

<setup_analysis>
${JSON.stringify(setup, null, 2)}
</setup_analysis>

<signal_analysis>
${JSON.stringify(signal, null, 2)}
</signal_analysis>

<decision_analysis>
${JSON.stringify(decision, null, 2)}
</decision_analysis>

<strategy_analysis>
${JSON.stringify(strategy, null, 2)}
</strategy_analysis>

Return JSON with exactly this structure:

{
  "state": "HIGH_CONVICTION",
  "summary": "",

  "market": {
    "outlook": "",
    "summary": "",
    "risk": ""
  },

  "setup": {
    "assessment": "",
    "summary": "",
    "qualityScore": null
  },

  "signal": {
    "assessment": "",
    "summary": "",
    "confidence": 0,
    "blockers": []
  },

  "decision": {
    "assessment": "",
    "summary": "",
    "confidence": 0,
    "trustScore": null,
    "blockers": []
  },

  "strategy": {
    "assessment": "",
    "summary": "",
    "selected": false,
    "executionState": ""
  },

  "supportingFactors": [],
  "conflicts": [],
  "risks": [],
  "watchItems": [],

  "recommendedFocus": ""
}

State meaning:
HIGH_CONVICTION = strong agreement across layers and no blocking condition.
SUPPORTED = evidence is broadly aligned.
CONDITIONAL = meaningful caution or conditional execution exists.
LOW_CONVICTION = evidence is weak or inconsistent.
BLOCKED = a deterministic blocking condition exists.

Use only the supplied intelligence.
`;

    const raw = await this.claude.generateText(
      system,
      prompt,
      1800,
    );

    return this.parseResponse(
      raw,
      input,
    );
  }

  private parseResponse(
    raw: string,
    input: AIIntelligenceInput,
  ): AIIntelligenceAnalysis {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Partial<AIIntelligenceAnalysis>;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        "Claude returned invalid JSON for AI Intelligence Orchestrator.",
      );
    }

    const fallback = this.getFallbackState(input);

    return {
      state:
        this.isState(parsed.state)
          ? parsed.state
          : fallback,

      summary:
        parsed.summary?.trim() ||
        input.decision.summary ||
        "VELORA AI intelligence synthesis is based on the available analysis layers.",

      market: {
        outlook:
          parsed.market?.outlook ||
          input.market.outlook,

        summary:
          parsed.market?.summary ||
          input.market.summary,

        risk:
          parsed.market?.risk ||
          input.market.risk,
      },

      setup: {
        assessment:
          parsed.setup?.assessment ||
          input.setup.assessment,

        summary:
          parsed.setup?.summary ||
          input.setup.summary,

        qualityScore:
          parsed.setup?.qualityScore ??
          input.setup.quality.score ??
          null,
      },

      signal: {
        assessment:
          parsed.signal?.assessment ||
          input.signal.assessment,

        summary:
          parsed.signal?.summary ||
          input.signal.summary,

        confidence:
          parsed.signal?.confidence ??
          input.signal.signal.confidence,

        blockers:
          this.normalizeArray(
            parsed.signal?.blockers,
            input.signal.decisionContext.blockers,
          ),
      },

      decision: {
        assessment:
          parsed.decision?.assessment ||
          input.decision.assessment,

        summary:
          parsed.decision?.summary ||
          input.decision.summary,

        confidence:
          parsed.decision?.confidence ??
          input.decision.decision.confidence,

        trustScore:
          parsed.decision?.trustScore ??
          input.decision.decision.trustScore ??
          null,

        blockers:
          this.normalizeArray(
            parsed.decision?.blockers,
            input.decision.evidence.blockers,
          ),
      },

      strategy: {
        assessment:
          parsed.strategy?.assessment ||
          input.strategy.assessment,

        summary:
          parsed.strategy?.summary ||
          input.strategy.summary,

        selected:
          parsed.strategy?.selected ??
          input.strategy.selection.selected,

        executionState:
          parsed.strategy?.executionState ||
          input.strategy.execution.state,
      },

      supportingFactors:
        this.normalizeArray(
          parsed.supportingFactors,
          [
            ...input.market.supportingFactors,
            ...input.setup.supportingFactors,
            ...input.signal.supportingFactors,
            ...input.decision.evidence.supportingFactors,
            ...input.strategy.supportingFactors,
          ],
        ),

      conflicts:
        this.normalizeArray(
          parsed.conflicts,
          [
            ...input.market.conflictingFactors,
            ...input.setup.conflictingFactors,
            ...input.signal.conflictingFactors,
            ...input.decision.evidence.conflictingFactors,
            ...input.strategy.conflictingFactors,
          ],
        ),

      risks:
        this.normalizeArray(
          parsed.risks,
          [
            ...input.market.keyRisks,
            ...input.setup.risks,
            ...input.signal.risks,
            ...input.decision.evidence.risks,
            ...input.strategy.risks,
          ],
        ),

      watchItems:
        this.normalizeArray(
          parsed.watchItems,
          [
            ...input.market.watchItems,
            ...input.setup.watchItems,
            ...input.signal.watchItems,
            ...input.decision.watchItems,
            ...input.strategy.watchItems,
          ],
        ),

      recommendedFocus:
        parsed.recommendedFocus?.trim() ||
        input.decision.recommendedFocus ||
        input.strategy.recommendedFocus ||
        "Continue monitoring changes across market, setup, signal, decision, and strategy layers.",
    };
  }

  private normalizeArray(
    value: unknown,
    fallback: string[],
  ): string[] {
    const source = Array.isArray(value)
      ? value
      : fallback;

    const isSynthesisRelevant = (
      item: string,
    ): boolean =>
      !item.startsWith("Setup quality is moderate at ") &&
      item !== "Strategy execution is conditional." &&
      item !== "No historical sample is available." &&
      item !==
        "No historical sample is available to validate the current decision pattern.";

    return source
      .filter(
        (item): item is string =>
          typeof item === "string",
      )
      .map((item) => item.trim())
      .filter(Boolean)
      .filter(isSynthesisRelevant);
  }

  private isState(
    value: unknown,
  ): value is AIIntelligenceState {
    return (
      value === "HIGH_CONVICTION" ||
      value === "SUPPORTED" ||
      value === "CONDITIONAL" ||
      value === "LOW_CONVICTION" ||
      value === "BLOCKED"
    );
  }

  private getFallbackState(
    input: AIIntelligenceInput,
  ): AIIntelligenceState {
    if (
      input.decision.assessment === "BLOCKED" ||
      input.signal.assessment === "INVALID" ||
      input.strategy.assessment === "BLOCKED"
    ) {
      return "BLOCKED";
    }

    if (
      input.decision.assessment === "HIGH_CONVICTION" &&
      input.strategy.assessment === "STRONG"
    ) {
      return "HIGH_CONVICTION";
    }

    if (
      input.decision.assessment === "SUPPORTED" ||
      input.strategy.assessment === "SUPPORTED"
    ) {
      return "SUPPORTED";
    }

    if (
      input.decision.assessment === "CONDITIONAL" ||
      input.strategy.assessment === "MIXED"
    ) {
      return "CONDITIONAL";
    }

    return "LOW_CONVICTION";
  }
}
