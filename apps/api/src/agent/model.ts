import { ChatOpenAI } from "@langchain/openai";

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

export function getModelName(): string {
  return Bun.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function createModel(): ChatOpenAI | null {
  if (!Bun.env.OPENAI_API_KEY?.trim()) return null;

  return new ChatOpenAI({
    apiKey: Bun.env.OPENAI_API_KEY,
    model: getModelName(),
    temperature: 0.2
  });
}
