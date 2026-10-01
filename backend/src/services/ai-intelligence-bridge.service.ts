import type {
  AIIntelligenceAnalysis,
} from "./ai-intelligence-orchestrator.service.js";
import type { AIIntelligencePipelineResult } from "./ai-intelligence-pipeline.service.js";
import type { MarketIntelligence } from "./market-intelligence.service.js";
import { buildVeloraNativeSynthesis } from "./velora-native-synthesis.service.js";
import { buildVeloraAIAnalyst } from "./velora-ai-analyst.service.js";

export interface AIIntelligenceBridgeInput {
  pipeline: AIIntelligencePipelineResult;
  market: MarketIntelligence;
}

export class AIIntelligenceBridgeService {
  async analyze(
    input: AIIntelligenceBridgeInput,
  ): Promise<AIIntelligenceAnalysis> {
    const base = buildVeloraNativeSynthesis(input);

    console.log("[VELORA SYNTHESIS DEBUG]", JSON.stringify({
      symbol: input.pipeline.historical.currentSetup.symbol,
      state: base.state,
      setup: base.setup,
      signal: base.signal,
      decision: base.decision,
      strategy: base.strategy,
      aiAnalyst: base.aiAnalyst,
    }, null, 2));

    return buildVeloraAIAnalyst(input, base);
  }
}
