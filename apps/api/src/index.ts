import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { runAgent } from "./agent/runAgent";

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
      body: t.Object({
        prompt: t.String({
          minLength: 1
        })
      })
    }
  )
  .listen(port);

console.log(`API running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
