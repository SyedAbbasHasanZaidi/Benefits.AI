import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, streamText as aiStreamText, type CoreMessage } from 'ai';
import type { GenerateOptions, LlmProvider, LlmResponse } from './LlmProvider';

// Claude via AWS Bedrock Sydney (ap-southeast-2) — keeps all PII in AU region.
const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? 'ap-southeast-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
});

const DEFAULT_MODEL =
  process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-5-20250514-v1:0';

function toCoreMessages(messages: GenerateOptions['messages']): CoreMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export class BedrockClaudeProvider implements LlmProvider {
  private model;

  constructor(modelId = DEFAULT_MODEL) {
    this.model = bedrock(modelId);
  }

  async generate(opts: GenerateOptions): Promise<LlmResponse> {
    // Tools are wired in Milestone 4 via lib/llm/tools.ts once the OpenFisca
    // variable registry enum is generated. Only text generation is active here.
    const { text } = await generateText({
      model: this.model,
      system: opts.system,
      messages: toCoreMessages(opts.messages),
      maxTokens: opts.maxTokens ?? 2048,
    });

    return { text, toolCalls: [] };
  }

  streamText(opts: GenerateOptions): ReadableStream<string> {
    const result = aiStreamText({
      model: this.model,
      system: opts.system,
      messages: toCoreMessages(opts.messages),
      maxTokens: opts.maxTokens ?? 2048,
    });

    return result.textStream;
  }
}
