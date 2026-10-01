import express from "express";
import {
  AIIntelligencePipelineService,
  type AIIntelligencePipelineInput,
} from "../services/ai-intelligence-pipeline.service.js";

const router = express.Router();

const pipeline = new AIIntelligencePipelineService();

router.post("/analyze", async (req, res) => {
  try {
    const input =
      req.body as AIIntelligencePipelineInput;

    if (
      !input ||
      typeof input.symbol !== "string" ||
      typeof input.interval !== "string" ||
      !["BUY", "SELL", "NEUTRAL"].includes(input.signal)
    ) {
      return res.status(400).json({
        error:
          "AI pipeline requires symbol, interval, and a valid signal.",
      });
    }

    const result =
      await pipeline.build(input);

    return res.json(result);
  } catch (error) {
    console.error(
      "AI intelligence pipeline failed:",
      error,
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "AI intelligence pipeline failed.",
    });
  }
});

export default router;
