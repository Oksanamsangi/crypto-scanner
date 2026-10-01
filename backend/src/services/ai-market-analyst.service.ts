import type {
  MarketIntelligence,
} from "./market-intelligence.service.js";

import { ClaudeService } from "./claude.service.js";

export type MarketOutlook =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL"
  | "HIGH_RISK";

export interface AIMarketAnalysis {
  outlook: MarketOutlook;
  summary: string;
  marketRegime: string;
  momentum: string;
  volatility: string;
  risk: string;
  supportingFactors: string[];
  conflictingFactors: string[];
  keyRisks: string[];
  watchItems: string[];
  recommendedFocus: string;
}

export interface AIMarketAnalystInput {
  market: MarketIntelligence;
}

export class AIMarketAnalystService {
  private readonly claude: ClaudeService;

  constructor(
    claudeService = new ClaudeService(),
  ) {
    this.claude = claudeService;
  }

  async analyze(
    input: AIMarketAnalystInput,
  ): Promise<AIMarketAnalysis> {
    const { market } = input;

    const system = `
You are VELORA's AI Market Analyst.

Your role is to explain structured market intelligence
already calculated by VELORA's deterministic engines.

Rules:
- Do not invent market data.
- Do not invent prices, indicators, statistics, news,
  or events that are not provided.
- Do not override VELORA's calculated market regime.
- Do not make promises about financial outcomes.
- Clearly distinguish supporting evidence from conflicting evidence.
- Focus on market structure, momentum, volatility,
  breadth, confirmation, and risk.
- Be concise, analytical, and evidence-based.
- Return valid JSON only.
`;

    const prompt = `
Analyze the following VELORA market intelligence.

MARKET INTELLIGENCE:
${JSON.stringify(market, null, 2)}

Return JSON with exactly these fields:

{
  "outlook": "BULLISH | BEARISH | NEUTRAL | HIGH_RISK",
  "summary": "short analytical summary",
  "marketRegime": "market regime",
  "momentum": "momentum assessment",
  "volatility": "volatility assessment",
  "risk": "risk assessment",
  "supportingFactors": ["factor"],
  "conflictingFactors": ["factor"],
  "keyRisks": ["risk"],
  "watchItems": ["item to monitor"],
  "recommendedFocus": "what the user should focus on"
}

Use only evidence contained in the supplied
MARKET INTELLIGENCE.
`;

    const raw = await this.claude.generateText(
      system,
      prompt,
      1200,
    );

    return this.parseResponse(raw, market);
  }

  private parseResponse(
    raw: string,
    market: MarketIntelligence,
  ): AIMarketAnalysis {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Partial<AIMarketAnalysis>;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        "Claude returned invalid JSON for AI Market Analyst.",
      );
    }

    const validOutlooks: MarketOutlook[] = [
      "BULLISH",
      "BEARISH",
      "NEUTRAL",
      "HIGH_RISK",
    ];

    const outlook = validOutlooks.includes(
      parsed.outlook as MarketOutlook,
    )
      ? (parsed.outlook as MarketOutlook)
      : this.getFallbackOutlook(market);

    return {
      outlook,
      summary:
        parsed.summary?.trim() ||
        market.opinion,

      marketRegime:
        parsed.marketRegime?.trim() ||
        market.regime,

      momentum:
        parsed.momentum?.trim() ||
        market.momentum,

      volatility:
        parsed.volatility?.trim() ||
        market.volatilityState,

      risk:
        parsed.risk?.trim() ||
        market.risk,

      supportingFactors:
        this.normalizeArray(
          parsed.supportingFactors,
          market.reasons,
        ),

      conflictingFactors:
        this.normalizeArray(
          parsed.conflictingFactors,
          [],
        ),

      keyRisks:
        this.normalizeArray(
          parsed.keyRisks,
          [market.risk],
        ),

      watchItems:
        this.normalizeArray(
          parsed.watchItems,
          [market.recommendedAction],
        ),

      recommendedFocus:
        parsed.recommendedFocus?.trim() ||
        market.recommendedAction,
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

  private getFallbackOutlook(
    market: MarketIntelligence,
  ): MarketOutlook {
    if (
      market.regime === "HIGH_VOLATILITY" ||
      market.risk === "EXTREME"
    ) {
      return "HIGH_RISK";
    }

    if (market.regime === "BULLISH") {
      return "BULLISH";
    }

    if (market.regime === "BEARISH") {
      return "BEARISH";
    }

    return "NEUTRAL";
  }
}
