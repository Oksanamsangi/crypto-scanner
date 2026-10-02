import Anthropic from "@anthropic-ai/sdk";

export class ClaudeService {
  private readonly client: Anthropic | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async generateText(
    system: string,
    prompt: string,
    maxTokens = 1200,
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        "AI provider is not configured.",
      );
    }

    const response =
      await this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

    const textBlocks =
      response.content.filter(
        (block) => block.type === "text",
      );

    return textBlocks
      .map((block) => block.text)
      .join("\n")
      .trim();
  }
}
