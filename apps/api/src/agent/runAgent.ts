export type AgentRequest = {
  prompt: string;
};

export type AgentResponse = {
  answer: string;
  createdAt: string;
  model: string;
};

export function runAgent({ prompt }: AgentRequest): AgentResponse {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  return {
    answer: `You asked: "${normalizedPrompt}". The agent service is wired and ready for real tools, memory, or model calls.`,
    createdAt: new Date().toISOString(),
    model: "local-scaffold"
  };
}
