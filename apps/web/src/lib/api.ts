type RunAgentResponse =
  | {
      answer: string;
      createdAt: string;
      model: string;
    }
  | {
      error: string;
    };

export async function runAgent(prompt: string) {
  const response = await fetch("/api/agent/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt })
  });

  const payload = (await response.json()) as RunAgentResponse;

  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "Agent request failed.");
  }

  return payload;
}
