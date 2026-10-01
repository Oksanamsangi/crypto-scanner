import express from "express";
import {
  AIIntelligenceOrchestratorService,
  type AIIntelligenceInput,
} from "../services/ai-intelligence-orchestrator.service.js";

const router = express.Router();

const orchestrator = new AIIntelligenceOrchestratorService();

router.post("/orchestrate", async (req, res) => {
  try {
    const input = req.body as AIIntelligenceInput;

    if (
      !input ||
      !input.market ||
      !input.setup ||
      !input.signal ||
      !input.decision ||
      !input.strategy
    ) {
      return res.status(400).json({
        error: "AI intelligence requires market, setup, signal, decision, and strategy analyses.",
      });
    }

    const result = await orchestrator.analyze(input);

    return res.json(result);
  } catch (error) {
    console.error("AI intelligence orchestration failed:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "AI intelligence orchestration failed.",
    });
  }
});

export default router;
