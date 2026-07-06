import Anthropic from "@anthropic-ai/sdk";

/**
 * LLM provider abstraction. The rest of the platform only speaks to this
 * interface, so swapping/adding providers (or routing cheap tasks to cheaper
 * models) never touches agent or orchestrator code.
 */

export interface CompletionRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface LlmProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

const DEFAULT_MODEL = "claude-sonnet-5";

class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const response = await this.client.messages.create({
      model: req.model ?? DEFAULT_MODEL,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.4,
      system: req.system,
      messages: req.messages,
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
    };
  }
}

/**
 * Returns the configured provider, or null when no API key is present.
 * Callers must handle null by surfacing an "AI provider not configured"
 * state — the platform never fabricates AI output.
 */
export function getLlmProvider(): LlmProvider | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new AnthropicProvider(apiKey);
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
