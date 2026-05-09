import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { createCampaignAgentNdjsonStream, runAgent } from "./agent/runAgent";
import {
  ingestBrandContextFiles,
  type BrandFileIngestResult
} from "./integrations/nia/ingestBrandFiles";
import { sendBatchOutreach } from "./integrations/reacherOutreach";

/** Default avoids clashing with other local apps that commonly bind :3001. */
const port = Number(Bun.env.API_PORT ?? 3041);

const niaIngestBodySchema = t.Object({
  campaignLabel: t.Optional(t.String()),
  files: t.Files({
    maxSize: "25m",
    maxItems: 20
  })
});

async function niaIngestFromBody(body: {
  campaignLabel?: string | undefined;
  files: File[];
}): Promise<BrandFileIngestResult> {
  return ingestBrandContextFiles(body.files, {
    campaignLabel: body.campaignLabel?.trim() || undefined
  });
}

const app = new Elysia()
  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error:
          "API route not found. Start the API (e.g. bun run dev:api) and ensure the web dev server proxies /api to it."
      };
    }
    if (code === "VALIDATION") {
      set.status = 422;
      return { error: error.message };
    }
    if (code === "PARSE") {
      set.status = 400;
      return { error: "Could not parse the request body." };
    }
  })
  .use(
    cors({
      origin: Bun.env.WEB_ORIGIN ?? true
    })
  )
  .get("/health", () => ({
    ok: true,
    service: "campaign-os-api"
  }))
  .post(
    "/api/nia/ingest",
    async ({ body, set }) => {
      if (!Bun.env.NIA_API_KEY?.trim()) {
        set.status = 503;
        return { error: "Nia is not configured. Set NIA_API_KEY in the API environment." };
      }
      try {
        return await niaIngestFromBody(body);
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : "Unable to index files."
        };
      }
    },
    {
      body: niaIngestBodySchema
    }
  )
  .post(
    "/api/nia/upload",
    async ({ body, set }) => {
      if (!Bun.env.NIA_API_KEY?.trim()) {
        set.status = 503;
        return { error: "Nia is not configured. Set NIA_API_KEY in the API environment." };
      }
      try {
        return await niaIngestFromBody(body);
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : "Unable to index files."
        };
      }
    },
    {
      body: niaIngestBodySchema
    }
  )
  .post(
    "/api/agent/run",
    async ({ body, set }) => {
      try {
        return await runAgent(body);
      } catch (error) {
        set.status = 400;

        return {
          error: error instanceof Error ? error.message : "Unable to run agent."
        };
      }
    },
    {
      body: t.Record(t.String(), t.Unknown())
    }
  )
  .post(
    "/api/agent/run/stream",
    ({ body, set }) => {
      const made = createCampaignAgentNdjsonStream(body);
      if (!made.ok) {
        set.status = 400;
        return { error: made.error };
      }
      return new Response(made.stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
        }
      });
    },
    {
      body: t.Record(t.String(), t.Unknown())
    }
  )
  .post(
    "/api/outreach/batch",
    async ({ body, set }) => {
      try {
        const result = await sendBatchOutreach({
          tier: body.tier,
          campaignName: body.campaignName,
          subject: body.subject,
          drafts: body.drafts,
          recipientEmails: body.recipientEmails
        });
        if (!result.ok) set.status = 400;
        return result;
      } catch (error) {
        set.status = 500;
        return {
          ok: false,
          dryRun: false,
          message: error instanceof Error ? error.message : "Outreach request failed."
        };
      }
    },
    {
      body: t.Object({
        tier: t.Union([t.Literal("high"), t.Literal("average"), t.Literal("low")]),
        campaignName: t.String({ minLength: 1, maxLength: 200 }),
        subject: t.Optional(t.String({ maxLength: 255 })),
        drafts: t.Array(
          t.Object({
            creatorName: t.Optional(t.String()),
            creatorHandle: t.Optional(t.String()),
            body: t.String({ minLength: 1 })
          }),
          { minItems: 1, maxItems: 100 }
        ),
        recipientEmails: t.Optional(t.Array(t.String(), { maxItems: 1000 }))
      })
    }
  )
  .listen(port);

console.log(`API running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
