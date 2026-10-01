import type { StrategyDefinition } from "./strategy-definition.service.js";
import type { StrategyRulesResult } from "./strategy-rules-engine.service.js";
import type { ExecutionPlan } from "./strategy-execution-engine.service.js";
import type { StrategyPerformanceResult } from "./strategy-performance.service.js";
import type { StrategyComparisonResult } from "./strategy-comparison.service.js";
import type { StrategySelectionResult } from "./strategy-selection.service.js";
import { ClaudeService } from "./claude.service.js";

export type AIStrategyAssessment =
  | "STRONG"
  | "SUPPORTED"
  | "MIXED"
  | "WEAK"
  | "BLOCKED";

export interface AIStrategyAnalysis {
  assessment: AIStrategyAssessment;
  summary: string;

  strategy: {
    id: string;
    name: string;
    direction: string;
    timeframe: string;
    riskProfile: string;
    status: string;
  };

  rules: {
    state: string;
    ruleScore: number;
    confidence: number;
    passed: number;
    caution: number;
    failed: number;
  };

  execution: {
    state: string;
    direction: string;
    confidence: number;
    blockers: string[];
    warnings: string[];
  };

  performance: {
    score: number | null;
    grade: string | null;
    winRate: number | null;
    expectancy: number | null;
    profitFactor: number | null;
    sampleSize: number | null;
  };

  comparison: {
    rank: number | null;
    score: number | null;
    winner: boolean;
    explanation: string | null;
  };

  selection: {
    state: string | null;
    selected: boolean;
    score: number | null;
    confidence: number | null;
    blockers: string[];
    warnings: string[];
  };

  supportingFactors: string[];
  conflictingFactors: string[];
  risks: string[];
  watchItems: string[];
  recommendedFocus: string;
}

export interface AIStrategyAnalystInput {
  strategy: StrategyDefinition;
  rules?: StrategyRulesResult | null;
  execution?: ExecutionPlan | null;
  performance?: StrategyPerformanceResult | null;
  comparison?: StrategyComparisonResult | null;
  selection?: StrategySelectionResult | null;
}

export class AIStrategyAnalystService {
  private readonly claude: ClaudeService;

  constructor(claudeService = new ClaudeService()) {
    this.claude = claudeService;
  }

  async analyze(
    input: AIStrategyAnalystInput,
  ): Promise<AIStrategyAnalysis> {
    const {
      strategy,
      rules,
      execution,
      performance,
      comparison,
      selection,
    } = input;

    const system = `
You are VELORA's AI Strategy Analyst.

Your role is to interpret strategy intelligence already calculated
by VELORA's deterministic engines.

The deterministic engines have already evaluated:
- strategy definition
- strategy rules
- execution eligibility
- historical strategy performance
- strategy comparison
- strategy selection

Do not invent data.
Do not recalculate scores.
Do not modify strategy rules.
Do not create a new strategy.
Do not claim that a strategy will be profitable.
Do not provide personalized financial instructions.

Preserve deterministic blockers and conclusions.

Explain:
1. how well the strategy satisfies its rules,
2. whether execution is approved, conditional, or blocked,
3. what historical performance shows,
4. how the strategy compares with alternatives,
5. whether the selection engine selected it,
6. what risks and limitations remain.

Return valid JSON only.
`;

    const prompt = `
Analyze this VELORA strategy context.

<strategy>
${JSON.stringify(strategy, null, 2)}
</strategy>

<rules>
${JSON.stringify(rules ?? null, null, 2)}
</rules>

<execution>
${JSON.stringify(execution ?? null, null, 2)}
</execution>

<performance>
${JSON.stringify(performance ?? null, null, 2)}
</performance>

<comparison>
${JSON.stringify(comparison ?? null, null, 2)}
</comparison>

<selection>
${JSON.stringify(selection ?? null, null, 2)}
</selection>

Return JSON with exactly this structure:

{
  "assessment": "STRONG",
  "summary": "short evidence-based assessment",

  "strategy": {
    "id": "",
    "name": "",
    "direction": "",
    "timeframe": "",
    "riskProfile": "",
    "status": ""
  },

  "rules": {
    "state": "PASS",
    "ruleScore": 0,
    "confidence": 0,
    "passed": 0,
    "caution": 0,
    "failed": 0
  },

  "execution": {
    "state": "APPROVED",
    "direction": "LONG",
    "confidence": 0,
    "blockers": [],
    "warnings": []
  },

  "performance": {
    "score": null,
    "grade": null,
    "winRate": null,
    "expectancy": null,
    "profitFactor": null,
    "sampleSize": null
  },

  "comparison": {
    "rank": null,
    "score": null,
    "winner": false,
    "explanation": null
  },

  "selection": {
    "state": null,
    "selected": false,
    "score": null,
    "confidence": null,
    "blockers": [],
    "warnings": []
  },

  "supportingFactors": [],
  "conflictingFactors": [],
  "risks": [],
  "watchItems": [],
  "recommendedFocus": ""
}

Use only the supplied data.
`;

    const raw = await this.claude.generateText(
      system,
      prompt,
      1800,
    );

    return this.parseResponse(
      raw,
      strategy,
      rules,
      execution,
      performance,
      comparison,
      selection,
    );
  }

  private parseResponse(
    raw: string,
    strategy: StrategyDefinition,
    rules?: StrategyRulesResult | null,
    execution?: ExecutionPlan | null,
    performance?: StrategyPerformanceResult | null,
    comparison?: StrategyComparisonResult | null,
    selection?: StrategySelectionResult | null,
  ): AIStrategyAnalysis {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Partial<AIStrategyAnalysis>;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        "Claude returned invalid JSON for AI Strategy Analyst.",
      );
    }

    const assessment: AIStrategyAssessment =
      this.isAssessment(parsed.assessment)
        ? parsed.assessment
        : this.getFallbackAssessment(
            rules,
            execution,
            performance,
            selection,
          );

    const ranking = comparison?.ranking.find(
      (item) => item.strategyId === strategy.id,
    );

    const comparisonWinner =
      comparison?.winnerStrategyId === strategy.id;

    return {
      assessment,

      summary:
        parsed.summary?.trim() ||
        performance?.explanation ||
        rules?.explanation ||
        "Strategy analysis is based on the available VELORA strategy intelligence.",

      strategy: {
        id:
          parsed.strategy?.id ||
          strategy.id,

        name:
          parsed.strategy?.name ||
          strategy.name,

        direction:
          parsed.strategy?.direction ||
          strategy.direction,

        timeframe:
          parsed.strategy?.timeframe ||
          strategy.timeframe,

        riskProfile:
          parsed.strategy?.riskProfile ||
          strategy.riskProfile,

        status:
          parsed.strategy?.status ||
          strategy.status,
      },

      rules: {
        state:
          parsed.rules?.state ||
          rules?.state ||
          "UNKNOWN",

        ruleScore:
          parsed.rules?.ruleScore ??
          rules?.ruleScore ??
          0,

        confidence:
          parsed.rules?.confidence ??
          rules?.confidence ??
          0,

        passed:
          parsed.rules?.passed ??
          rules?.passedRules.length ??
          0,

        caution:
          parsed.rules?.caution ??
          rules?.cautionRules.length ??
          0,

        failed:
          parsed.rules?.failed ??
          rules?.failedRules.length ??
          0,
      },

      execution: {
        state:
          parsed.execution?.state ||
          execution?.state ||
          "UNKNOWN",

        direction:
          parsed.execution?.direction ||
          execution?.direction ||
          "NONE",

        confidence:
          parsed.execution?.confidence ??
          execution?.confidence ??
          0,

        blockers:
          this.normalizeArray(
            parsed.execution?.blockers,
            execution?.blockers ?? [],
          ),

        warnings:
          this.normalizeArray(
            parsed.execution?.warnings,
            execution?.warnings ?? [],
          ),
      },

      performance: {
        score:
          parsed.performance?.score ??
          performance?.performanceScore ??
          null,

        grade:
          parsed.performance?.grade ??
          performance?.grade ??
          null,

        winRate:
          parsed.performance?.winRate ??
          performance?.winRate ??
          null,

        expectancy:
          parsed.performance?.expectancy ??
          performance?.expectancy ??
          null,

        profitFactor:
          parsed.performance?.profitFactor ??
          performance?.profitFactor ??
          null,

        sampleSize:
          parsed.performance?.sampleSize ??
          performance?.sampleSize ??
          null,
      },

      comparison: {
        rank:
          parsed.comparison?.rank ??
          ranking?.rank ??
          null,

        score:
          parsed.comparison?.score ??
          ranking?.score ??
          null,

        winner:
          parsed.comparison?.winner ??
          comparisonWinner,

        explanation:
          parsed.comparison?.explanation ??
          (comparisonWinner
            ? comparison?.explanation ?? null
            : null),
      },

      selection: {
        state:
          parsed.selection?.state ||
          selection?.state ||
          null,

        selected:
          parsed.selection?.selected ??
          (selection?.state === "SELECTED"),

        score:
          parsed.selection?.score ??
          selection?.score ??
          null,

        confidence:
          parsed.selection?.confidence ??
          selection?.confidence ??
          null,

        blockers:
          this.normalizeArray(
            parsed.selection?.blockers,
            selection?.blockers ?? [],
          ),

        warnings:
          this.normalizeArray(
            parsed.selection?.warnings,
            selection?.warnings ?? [],
          ),
      },

      supportingFactors:
        this.normalizeArray(
          parsed.supportingFactors,
          [
            ...(rules?.passedRules ?? []),
            ...(performance?.strengths ?? []),
            ...(selection?.reasons ?? []),
          ],
        ),

      conflictingFactors:
        this.normalizeArray(
          parsed.conflictingFactors,
          [
            ...(rules?.cautionRules ?? []),
            ...(rules?.failedRules ?? []),
            ...(performance?.weaknesses ?? []),
            ...(execution?.warnings ?? []),
          ],
        ),

      risks:
        this.normalizeArray(
          parsed.risks,
          [
            ...(rules?.blockers ?? []),
            ...(rules?.warnings ?? []),
            ...(execution?.blockers ?? []),
            ...(performance?.weaknesses ?? []),
            ...(selection?.blockers ?? []),
          ],
        ),

      watchItems:
        this.normalizeArray(
          parsed.watchItems,
          [
            ...(rules?.warnings ?? []),
            ...(execution?.warnings ?? []),
            ...(selection?.warnings ?? []),
          ],
        ),

      recommendedFocus:
        parsed.recommendedFocus?.trim() ||
        "Continue monitoring strategy rule compliance, execution state, historical performance, and selection evidence.",
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

  private isAssessment(
    value: unknown,
  ): value is AIStrategyAssessment {
    return (
      value === "STRONG" ||
      value === "SUPPORTED" ||
      value === "MIXED" ||
      value === "WEAK" ||
      value === "BLOCKED"
    );
  }

  private getFallbackAssessment(
    rules?: StrategyRulesResult | null,
    execution?: ExecutionPlan | null,
    performance?: StrategyPerformanceResult | null,
    selection?: StrategySelectionResult | null,
  ): AIStrategyAssessment {
    if (
      rules?.state === "FAIL" ||
      execution?.state === "BLOCKED" ||
      selection?.state === "NO_STRATEGY"
    ) {
      return "BLOCKED";
    }

    if (
      selection?.state === "SELECTED" &&
      execution?.state === "APPROVED" &&
      (performance?.performanceScore ?? 0) >= 80
    ) {
      return "STRONG";
    }

    if (
      selection?.state === "SELECTED" &&
      execution?.state === "APPROVED"
    ) {
      return "SUPPORTED";
    }

    if (
      execution?.state === "CONDITIONAL" ||
      selection?.state === "ALTERNATIVE" ||
      rules?.state === "CAUTION"
    ) {
      return "MIXED";
    }

    return "WEAK";
  }
}
