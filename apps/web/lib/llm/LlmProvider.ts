export type LlmRole = 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

/** JSON Schema object describing one tool parameter set. */
export interface LlmToolSchema {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. Must be an object schema. */
  parameters: Record<string, unknown>;
}

export interface LlmToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
}

export interface GenerateOptions {
  system: string;
  messages: LlmMessage[];
  tools?: LlmToolSchema[];
  maxTokens?: number;
}

/**
 * Minimal provider interface — the Strategy pattern that keeps orchestration
 * code independent of the underlying LLM vendor.
 *
 * Current implementation: BedrockClaudeProvider (Claude via AWS Bedrock Sydney).
 * Swap by passing a different implementation into the orchestrator.
 */
export interface LlmProvider {
  /** Single-shot generation — used for extraction and explanation turns. */
  generate(opts: GenerateOptions): Promise<LlmResponse>;
  /** Streaming generation — used for the user-facing chat turn. */
  streamText(opts: GenerateOptions): ReadableStream<string>;
}
