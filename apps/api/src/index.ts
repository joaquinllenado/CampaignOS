import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { runAgent } from "./agent/runAgent";
import {
  ingestBrandContextFiles,
  type BrandFileIngestResult
} from "./integrations/nia/ingestBrandFiles";

const port = Number(Bun.env.API_PORT ?? 3001);

const app = new Elysia()
  .use(
    cors({
      origin: Bun.env.WEB_ORIGIN ?? true
    })
  )
  .get("/health", () => ({
    ok: true,
    service: "nozo-hack-api"
  }))
  .post(
    "/api/nia/ingest",
    async ({ body, set }): Promise<BrandFileIngestResult | { error: string }> => {
      if (!Bun.env.NIA_API_KEY?.trim()) {
        set.status = 503;

        return { error: "Nia is not configured. Set NIA_API_KEY in the API environment." };
      }

      const files = body.files;
      const fileList = Array.isArray(files) ? files : files ? [files] : [];

      try {
        return await ingestBrandContextFiles(fileList, {
          campaignLabel: body.campaignLabel?.trim() || undefined
        });
      } catch (error) {
        set.status = 400;

        return {
          error: error instanceof Error ? error.message : "Unable to index files."
        };
      }
    },
    {
      body: t.Object({
        campaignLabel: t.Optional(t.String()),
        files: t.Files({
          maxSize: "25m",
          maxItems: 20
        })
      })
    }
  )
  .post(
    "/api/agent/run",
    ({ body, set }) => {
      try {
        return runAgent(body);
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
  .listen(port);

console.log(`API running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
