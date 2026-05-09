import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { retrieveNiaContext, type NiaRetrievalResult } from "../integrations/nia/retrieveContext";
import {
  intakeBodySchema,
  niaContextResultSchema,
  type CampaignAgentBody
} from "./schema";

const niaContextToolOutputSchema = z
  .object({
    context: z.array(niaContextResultSchema),
    sourcesUsed: z.array(z.string()),
    errors: z.array(z.string())
  })
  .strict();

export const niaContextTool = tool(
  async (input: CampaignAgentBody) => {
    const result = await retrieveNiaContext(input);
    return JSON.stringify(result);
  },
  {
    name: "retrieve_nia_campaign_context",
    description:
      "Retrieves source-backed campaign context from Nia before campaign analysis. Use this for brand, product, audience, brief, historical campaign, and KPI context.",
    schema: intakeBodySchema
  }
);

export async function retrieveNiaContextWithTool(
  input: CampaignAgentBody
): Promise<NiaRetrievalResult> {
  const rawResult = await niaContextTool.invoke(input);
  const content = typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult);

  return niaContextToolOutputSchema.parse(JSON.parse(content));
}
