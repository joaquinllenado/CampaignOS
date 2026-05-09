/** Fields collected in the user-facing intake form (required + common campaign inputs). */
export type CampaignIntakeFields = {
  name: string;
  brand: string;
  product: string;
  audience: string;
  budget: string;
  brief: string;
};

export type AgentRunSuccess =
  | {
      mode: "legacy_prompt";
      answer: string;
      createdAt: string;
      model: string;
    }
  | {
      mode: "intake";
      receivedAt: string;
      intake: unknown;
      warnings: string[];
      kpiPriorityNotes: string[];
    };

export type AgentRunErrorResponse = {
  error: string;
};
