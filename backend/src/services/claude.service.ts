import Anthropic from "@anthropic-ai/sdk";

export class ClaudeService {
  private readonly client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured.",
      );
    }

    this.client = new Anthropic({
      apiKey,
    });
  }

  async generateText(
    system: string,
    prompt: string,
    maxTokens = 1200,
  ): Promise<string> {
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
