# Requirements: AI-Native Campaign Intelligence Agent

## 1. Product Summary

Build an AI-native campaign strategist that helps brands evaluate influencer campaigns against real business objectives, not only vanity metrics. The system should use Nia by Nozomio Labs as the indexing and retrieval layer for campaign context, briefs, PDFs, docs, and historical knowledge, then use Reacher as the source of creator and campaign metrics. The agent should combine those sources to generate an objective-specific measurement framework, evaluate creators and content across the funnel, explain what drove outcomes, and recommend next best actions.

The MVP should focus on a complete end-to-end analysis loop:

1. Capture campaign context.
2. Retrieve indexed context from Nia.
3. Fetch or normalize creator metrics from Reacher.
4. Generate a weighted KPI framework.
5. Evaluate creator and content performance.
6. Diagnose why results happened.
7. Recommend optimization actions.
8. Return a structured strategy report that can be rendered in the web app.

## 2. Success Criteria

The MVP is successful when a user can enter or upload campaign context and sample performance metrics, run the agent, and receive a structured campaign intelligence report with:

- A detected or confirmed campaign objective.
- A weighted KPI model tailored to awareness, engagement, or sales goals.
- Creator-level scoring and rationale.
- Funnel analysis that explains bottlenecks and tradeoffs.
- Attribution reasoning that connects creator/content behavior to outcomes.
- Prioritized recommendations for creative direction, creator mix, CTA strategy, and budget allocation.
- Clear enough output for a hackathon demo without requiring external dashboards.

## 3. User Personas

### Brand Marketer

Needs to know whether an influencer campaign worked, which creators mattered, and what to change next.

### Growth Strategist

Needs to connect social signals to funnel outcomes such as CTR, GMV, conversion rate, CPA, ROAS, and repeat purchase indicators.

### Campaign Manager

Needs creator-specific guidance, outreach direction, budget allocation suggestions, and campaign monitoring insights.

## 4. Core User Flow

1. User opens the web app and enters campaign details.
2. User selects indexed Nia sources or enters source identifiers for briefs, PDFs, docs, datasets, or historical campaign notes.
3. User provides Reacher campaign, creator, or metric identifiers, with editable sample metrics as the demo fallback.
4. API validates the payload and starts the LangGraph agent.
5. Agent normalizes the brief, Nia context, and Reacher metrics into a typed campaign state.
6. Agent generates a dynamic KPI framework based on campaign objective.
7. Agent evaluates creators against the weighted framework.
8. Agent diagnoses attribution and funnel issues.
9. Agent creates optimization recommendations.
10. API returns a structured report to the web app.
11. Web app renders an executive summary, KPI framework, creator ranking, attribution insights, and recommendations.

## 5. MVP Scope

### In Scope

- Campaign intake form.
- Nia-backed indexing and retrieval for campaign context.
- Reacher-backed metrics ingestion through an API adapter.
- Objective support for `awareness`, `engagement`, and `sales`.
- OpenAI-backed LangGraph agent in the API app.
- Structured agent output validated before returning to the client.
- Mock/sample campaign performance data for demo reliability.
- Creator-level scoring and explanation.
- Objective-specific KPI weighting.
- Attribution and optimization reasoning.
- Single-turn agent execution through `POST /api/agent/run`.

### Out of Scope for MVP

- Direct TikTok Shop API integrations outside the data exposed by Reacher.
- Persistent database storage.
- User authentication.
- Scheduled campaign monitoring jobs.
- Automated outreach sending.
- Fully automated creator discovery beyond available Reacher data.
- Multi-tenant organization management.

## 6. Functional Requirements

### 6.1 Campaign Intake

The system must collect the following required campaign fields:

- Campaign name.
- Brand name.
- Objective: awareness, engagement, sales, or auto-detect.
- Product or category.
- Target audience.
- Budget.
- KPI priorities.
- Campaign brief.

The system should collect the following optional fields:

- Brand voice.
- Competitors.
- Campaign dates.
- Known creator preferences.
- Existing creative direction.
- Constraints or compliance notes.

Validation requirements:

- Campaign brief must not be empty.
- Budget must be a positive number when provided.
- KPI priorities must map to supported metric names or be stored as free-text context.
- Objective can be auto-detected if the user does not choose one.

### 6.2 Campaign Metrics Input

The MVP should support manually supplied creator performance rows.

Each creator row should support:

- Creator name.
- Creator handle.
- Creator archetype.
- Content format.
- Audience segment.
- Reach.
- Impressions.
- Video completion rate.
- Likes.
- Comments.
- Shares.
- Saves.
- CTR.
- Add-to-cart count.
- Conversion rate.
- GMV.
- CPA.
- ROAS.
- Sentiment score.
- Representative comments.

Metrics can be partial. The agent must explain when confidence is lower because important metrics are missing.

### 6.3 Dynamic KPI Framework Generator

The agent must create a weighted scoring model based on the objective.

For awareness campaigns, the default weighting should prioritize:

- Reach.
- Impressions.
- Completion rate.
- Share velocity.
- Audience penetration.
- Brand sentiment.

For engagement campaigns, the default weighting should prioritize:

- Comment depth.
- Saves.
- Shares.
- Engagement quality.
- Sentiment.
- Conversation themes.
- CTA intent.

For sales campaigns, the default weighting should prioritize:

- GMV.
- Conversion rate.
- CTR.
- Add-to-cart rate.
- CPA efficiency.
- ROAS.
- Funnel drop-off.

The generated framework must include:

- Objective summary.
- KPI hierarchy.
- Metric weights that sum to 100.
- Evaluation logic.
- Reasoning for why the framework fits the campaign.
- Confidence level.

### 6.4 Campaign Data Evaluator

The system must score creator performance against the generated KPI framework.

For each creator, output:

- Overall score from 0 to 100.
- Funnel stage strengths.
- Funnel stage weaknesses.
- Primary performance driver.
- Primary performance drag.
- Recommended action.
- Confidence level.

The evaluator should identify mismatches such as:

- High reach but low engagement quality.
- High engagement but weak purchase intent.
- Strong CTR but weak conversion.
- High GMV but poor CPA efficiency.
- Positive sentiment with low CTA response.

### 6.5 Attribution Reasoning Engine

The agent must explain why campaign outcomes happened.

Attribution insights should connect:

- Creator archetype.
- Content format.
- Audience segment.
- Engagement quality.
- Funnel metric movement.
- Revenue or conversion outcomes when available.

Each attribution insight must include:

- Claim.
- Supporting evidence from supplied metrics.
- Business implication.
- Confidence level.

Example:

> Tutorial creators converted 3.2x better than entertainment creators because their content drove stronger product comprehension, higher CTR, and higher add-to-cart rate despite lower total reach.

### 6.6 Optimization Recommendations

The agent must produce prioritized recommendations.

Each recommendation should include:

- Priority: high, medium, or low.
- Category: creator mix, creative direction, CTA, budget, audience, measurement.
- Action.
- Rationale.
- Expected impact.
- Required follow-up data, if any.

Recommendation examples:

- Shift 20% of budget from high-reach entertainment creators to education-driven tutorial creators.
- Test product-first hooks in the first 3 seconds for creators with strong engagement but low CTR.
- Add TikTok Shop CTA earlier in videos where completion rate is high but conversion is low.

### 6.7 Nia Context Retrieval

The system must use Nia as the source-of-truth layer for indexed campaign context.

Nia should support:

- Indexing campaign briefs, PDFs, docs, datasets, local folders, or historical campaign notes.
- Searching indexed sources for relevant audience, product, market, and brand context.
- Reading source excerpts when the agent needs exact supporting detail.
- Returning citation metadata so the report can distinguish source-backed facts from model reasoning.

The MVP should integrate Nia through the TypeScript SDK or direct REST API. Nia's docs describe `nia-ai-ts` as the TypeScript SDK and `https://apigcp.trynia.ai/v2` as the REST base URL. Nia also exposes a LangChain integration, but that package is Python-first, so the Bun/TypeScript API should prefer the SDK or direct REST client unless a TypeScript LangChain tool wrapper is added later.

Required Nia operations:

- List or resolve configured sources.
- Search across selected sources for the active campaign.
- Read specific source excerpts when search results need supporting context.
- Optionally save report summaries back to Nia context sharing after the demo flow works.

### 6.8 Reacher Metrics Ingestion

The system must use Reacher as the metrics provider for creator, content, and campaign performance data.

The Reacher integration should be isolated behind an adapter so endpoint details can change without affecting LangGraph node logic.

The adapter should support:

- Fetching creators for a campaign or shortlist.
- Fetching creator-level campaign metrics.
- Fetching content/video-level metrics when available.
- Fetching commerce metrics such as GMV, conversion rate, CPA, and ROAS when available.
- Returning normalized metric rows that match `CreatorMetricInput`.

The Reacher docs route is a client-rendered app, so the MVP should avoid coupling the agent directly to raw endpoint shapes until we verify authenticated request and response contracts. The adapter should start with the endpoint families visible from the Reacher portal bundle and normalize the responses behind stable local functions.

Likely Reacher endpoint families for the MVP:

- Social Intelligence v1: `/api/social-intelligence/industry-pulse/{shopId}`, `/api/social-intelligence/competitors/{shopId}`, `/api/social-intelligence/videos/{shopId}`, `/api/social-intelligence/creators/{shopId}`, `/api/social-intelligence/products/{shopId}`, `/api/social-intelligence/refresh/{shopId}`.
- Social Intelligence v2: `/api/social-intelligence-v2/products`, `/api/social-intelligence-v2/products/{productId}`, `/api/social-intelligence-v2/products/{productId}/creators`, `/api/social-intelligence-v2/products/{productId}/videos`, `/api/social-intelligence-v2/sellers/{sellerId}/creators`, `/api/social-intelligence-v2/sellers/{sellerId}/products`, `/api/social-intelligence-v2/sellers/{sellerId}/videos`, `/api/social-intelligence-v2/videos/trending`.
- Creator search: `/api/creator_search`, `/api/creator_search_v1`, `/api/ai-search/creators`, `/api/ai-search/filters`, `/api/agent-poc/semantic-creator-search?desc={description}`.
- Campaign and marketplace: `/api/creator/campaigns`, `/api/marketplace/campaigns/`, `/api/marketplace/get-campaign-detail-shop`, `/api/marketplace/manage_creators/`.
- Commerce and GMV Max: `/api/gmv-max/campaigns?shop_id={shopId}&status=ENABLE`, `/api/gmv-max/dashboard?shop_id={shopId}&days={days}`, `/api/gmv-max/spark-codes?shop_id={shopId}`.
- Creative/content analysis: `/api/creative-agent/videos`, `/api/creative-agent/video/{videoId}`, `/api/creative-agent/products/search`, `/api/creative-agent/filters?shop_id={shopId}`.
- Demo/sample data: `/api/sampleRequestsData/sampleRequestsData`, `/api/sampleRequestsData/summary`, `/api/sampleRequestsData/export`.

The MVP should include editable sample metrics as a fallback. Once exact Reacher endpoint contracts are confirmed from authenticated docs or API responses, the adapter should map raw Reacher responses into the normalized metric schema before the agent evaluates performance.

## 7. Agent Architecture

Use LangGraph in `apps/api` with OpenAI chat models.

Recommended dependencies:

- `@langchain/langgraph`
- `@langchain/openai`
- `@langchain/core`
- `nia-ai-ts`
- `zod`

Recommended environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`, default `gpt-4.1-mini` or the current low-latency OpenAI model available to the account.
- `NIA_API_KEY`
- `NIA_BASE_URL`, default `https://apigcp.trynia.ai/v2`
- `REACHER_API_KEY`
- `REACHER_BASE_URL`, default `https://portal.reacherapp.com`
- `API_PORT`
- `WEB_ORIGIN`

### 7.1 Agent State

The graph should maintain a typed state object:

```ts
type CampaignAgentState = {
  input: CampaignAgentInput;
  normalizedBrief?: NormalizedCampaignBrief;
  niaContext?: NiaContextResult[];
  reacherMetrics?: CreatorMetricInput[];
  kpiFramework?: KpiFramework;
  creatorEvaluations?: CreatorEvaluation[];
  attributionInsights?: AttributionInsight[];
  recommendations?: Recommendation[];
  report?: CampaignIntelligenceReport;
  errors: string[];
};
```

### 7.2 Graph Nodes

#### `normalizeInput`

Purpose:

- Validate and normalize user campaign input.
- Auto-detect objective when needed.
- Identify missing data and confidence limitations.

Output:

- `normalizedBrief`
- `errors`

#### `retrieveNiaContext`

Purpose:

- Search selected Nia sources for campaign, product, audience, category, and historical performance context.
- Read supporting excerpts when needed.
- Attach source metadata for traceability.

Output:

- `niaContext`

#### `fetchReacherMetrics`

Purpose:

- Fetch campaign, creator, content, and commerce metrics from Reacher through a local adapter.
- Normalize Reacher responses into the internal `CreatorMetricInput` schema.
- Fall back to supplied demo metrics when Reacher IDs or credentials are missing.

Output:

- `reacherMetrics`

#### `generateKpiFramework`

Purpose:

- Build objective-specific KPI hierarchy and metric weights.
- Adapt defaults to the provided brief, KPI priorities, Nia context, and available Reacher metrics.

Output:

- `kpiFramework`

#### `evaluateCreators`

Purpose:

- Score every creator against the weighted KPI model.
- Identify creator-level strengths, weaknesses, and best next action.

Output:

- `creatorEvaluations`

#### `reasonAboutAttribution`

Purpose:

- Explain why results happened.
- Connect creator/content patterns, Nia context, and Reacher funnel metrics to business outcomes.

Output:

- `attributionInsights`

#### `recommendOptimizations`

Purpose:

- Produce prioritized strategic recommendations.
- Include budget, creator, creative, CTA, and measurement guidance.

Output:

- `recommendations`

#### `composeReport`

Purpose:

- Convert graph state into the final response contract.
- Ensure the response is structured, complete, and UI-friendly.

Output:

- `report`

### 7.3 Graph Flow

```text
START
  -> normalizeInput
  -> retrieveNiaContext
  -> fetchReacherMetrics
  -> generateKpiFramework
  -> evaluateCreators
  -> reasonAboutAttribution
  -> recommendOptimizations
  -> composeReport
END
```

Conditional routing can be added after the MVP:

- If creator metrics are missing, skip creator scoring and produce a planning-only report.
- If sales metrics exist, include revenue attribution.
- If only brief data exists, generate strategy and measurement framework without performance diagnosis.
- If Nia sources are missing, use the provided brief only and mark context confidence as lower.
- If Reacher credentials or IDs are missing, use supplied sample metrics and mark data provenance as demo data.

### 7.4 Agent Pseudocode

```ts
async function runAgent(input: CampaignAgentInput) {
  const normalizedInput = validateInput(input);

  const initialState = {
    input: normalizedInput,
    errors: []
  };

  const graph = new StateGraph(CampaignAgentAnnotation)
    .addNode("normalizeInput", normalizeInput)
    .addNode("retrieveNiaContext", retrieveNiaContext)
    .addNode("fetchReacherMetrics", fetchReacherMetrics)
    .addNode("generateKpiFramework", generateKpiFramework)
    .addNode("evaluateCreators", evaluateCreators)
    .addNode("reasonAboutAttribution", reasonAboutAttribution)
    .addNode("recommendOptimizations", recommendOptimizations)
    .addNode("composeReport", composeReport)
    .addEdge(START, "normalizeInput")
    .addEdge("normalizeInput", "retrieveNiaContext")
    .addEdge("retrieveNiaContext", "fetchReacherMetrics")
    .addEdge("fetchReacherMetrics", "generateKpiFramework")
    .addEdge("generateKpiFramework", "evaluateCreators")
    .addEdge("evaluateCreators", "reasonAboutAttribution")
    .addEdge("reasonAboutAttribution", "recommendOptimizations")
    .addEdge("recommendOptimizations", "composeReport")
    .addEdge("composeReport", END)
    .compile();

  const finalState = await graph.invoke(initialState);

  return finalState.report;
}
```

## 8. LLM Requirements

### Model Usage

Use an OpenAI chat model through LangChain.

Recommended model setup:

- Use a faster, lower-cost model for MVP demo responsiveness.
- Use temperature `0.2` for analysis consistency.
- Use structured output schemas wherever possible.

### Prompting Requirements

Each node prompt should:

- State the campaign objective, Nia context excerpts, and available Reacher metrics.
- Require evidence-backed reasoning.
- Require confidence levels when metrics are incomplete.
- Avoid claiming access to data that was not provided.
- Return JSON that matches a Zod schema.

### Safety and Accuracy Requirements

The agent must:

- Not fabricate exact numbers that are not in the input.
- Distinguish observed metrics from inferred strategy.
- Distinguish Nia-sourced context from Reacher-sourced metrics and LLM-generated interpretation.
- Mark low-confidence conclusions when key metrics are absent.
- Keep recommendations advisory, not guaranteed outcomes.
- Avoid storing secrets or user data in logs.

## 9. API Requirements

### `POST /api/agent/run`

Current endpoint exists and should evolve from a prompt-only body to structured campaign input.

Request:

```ts
type CampaignAgentInput = {
  campaign: {
    name: string;
    brand: string;
    objective: "awareness" | "engagement" | "sales" | "auto";
    product: string;
    audience: string;
    budget?: number;
    kpiPriorities?: string[];
    brief: string;
  };
  nia?: {
    sourceIds?: string[];
    sourceNames?: string[];
    queryHints?: string[];
  };
  reacher?: {
    shopId?: string;
    productId?: string;
    sellerId?: string;
    campaignId?: string;
    creatorIds?: string[];
    contentIds?: string[];
  };
  creators?: CreatorMetricInput[];
};
```

Response:

```ts
type CampaignIntelligenceReport = {
  executiveSummary: string;
  objective: "awareness" | "engagement" | "sales";
  dataProvenance: DataProvenance;
  kpiFramework: KpiFramework;
  creatorEvaluations: CreatorEvaluation[];
  attributionInsights: AttributionInsight[];
  recommendations: Recommendation[];
  confidence: "low" | "medium" | "high";
  generatedAt: string;
  model: string;
};
```

Compatibility option for the current scaffold:

- Keep accepting `{ prompt: string }` while developing.
- Add structured input support in parallel.
- Remove prompt-only mode before final demo if the UI no longer uses it.

## 10. Web App Requirements

The current web app can start as a single-page MVP.

### Intake UI

The UI should include:

- Campaign objective selector.
- Campaign brief textarea.
- Nia source selector or source ID input.
- Reacher campaign ID and creator ID inputs.
- Product/category input.
- Audience input.
- Budget input.
- KPI priorities input.
- Creator metrics editor or sample data selector.

### Report UI

The UI should render:

- Executive summary card.
- KPI framework with weights.
- Creator ranking table/cards.
- Attribution insights.
- Recommended actions grouped by priority.
- Data provenance showing Nia context, Reacher metrics, and demo fallback usage.
- Confidence and missing data notes.

### Demo Data

Include at least three sample scenarios:

- Awareness campaign with strong reach but weak sentiment.
- Engagement campaign with strong comments and saves.
- Sales campaign where tutorial creators outperform entertainment creators on GMV and conversion.

## 11. Data Model Draft

```ts
type CampaignObjective = "awareness" | "engagement" | "sales" | "auto";

type NiaContextResult = {
  sourceId: string;
  sourceName?: string;
  title?: string;
  excerpt: string;
  url?: string;
  relevanceScore?: number;
};

type ReacherMetricSource = {
  shopId?: string;
  productId?: string;
  sellerId?: string;
  campaignId?: string;
  creatorId?: string;
  contentId?: string;
  fetchedAt?: string;
  rawMetricKeys?: string[];
};

type CreatorMetricInput = {
  name: string;
  handle?: string;
  archetype?: string;
  contentFormat?: string;
  audienceSegment?: string;
  reach?: number;
  impressions?: number;
  completionRate?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  ctr?: number;
  addToCart?: number;
  conversionRate?: number;
  gmv?: number;
  cpa?: number;
  roas?: number;
  sentimentScore?: number;
  representativeComments?: string[];
  source?: ReacherMetricSource | "manual" | "demo";
};

type DataProvenance = {
  contextSource: "nia" | "brief_only";
  metricsSource: "reacher" | "manual" | "demo";
  niaSourcesUsed: string[];
  reacherObjectsUsed: string[];
  missingInputs: string[];
};

type WeightedMetric = {
  name: string;
  weight: number;
  reason: string;
};

type KpiFramework = {
  objective: Exclude<CampaignObjective, "auto">;
  summary: string;
  metrics: WeightedMetric[];
  evaluationLogic: string[];
  confidence: "low" | "medium" | "high";
};

type CreatorEvaluation = {
  creatorName: string;
  score: number;
  rank: number;
  strengths: string[];
  weaknesses: string[];
  primaryDriver: string;
  primaryDrag: string;
  recommendedAction: string;
  confidence: "low" | "medium" | "high";
};

type AttributionInsight = {
  claim: string;
  evidence: string[];
  businessImplication: string;
  confidence: "low" | "medium" | "high";
};

type Recommendation = {
  priority: "high" | "medium" | "low";
  category: "creator_mix" | "creative_direction" | "cta" | "budget" | "audience" | "measurement";
  action: string;
  rationale: string;
  expectedImpact: string;
  followUpDataNeeded?: string[];
};
```

## 12. Implementation Plan

### Phase 1: Agent Foundation

- Add LangGraph, LangChain OpenAI, Nia TypeScript SDK, and Zod dependencies.
- Add `OPENAI_API_KEY`, `OPENAI_MODEL`, `NIA_API_KEY`, `NIA_BASE_URL`, `REACHER_API_KEY`, and `REACHER_BASE_URL` to `.env.example`.
- Replace placeholder `runAgent` with a LangGraph workflow.
- Define shared TypeScript schemas for input and output.
- Return a structured report from the API.

### Phase 2: Nia and Reacher Adapters

- Build a Nia client for source search and excerpt retrieval.
- Build a Reacher client that fetches raw creator/campaign metrics.
- Normalize Reacher responses into `CreatorMetricInput`.
- Add demo fallback metrics when credentials or IDs are missing.
- Track data provenance in agent state.

### Phase 3: Deterministic Scoring Helpers

- Implement metric normalization helpers.
- Compute creator score from the generated KPI weights.
- Use deterministic scoring for numeric evaluation.
- Use the LLM for framework generation, interpretation, attribution, and recommendations.

### Phase 4: Web MVP

- Replace generic prompt UI with campaign intake UI.
- Add Nia source and Reacher campaign fields.
- Add editable sample campaign data.
- Render structured report sections.
- Include loading, error, and empty states.

### Phase 5: Demo Polish

- Add three polished sample campaigns.
- Preconfigure one demo Nia source set and one demo Reacher metric set.
- Tune prompts for concise, judge-friendly output.
- Add missing data warnings.
- Run typecheck and production build.

### Phase 6: Post-MVP Extensions

- Add persistence with Supabase.
- Add campaign history and report comparison.
- Add file upload and RAG over campaign briefs or historical PDFs through Nia.
- Add creator discovery from additional Reacher Social Intelligence data.
- Add scheduled monitoring with anomaly detection.
- Add human approval checkpoints before outreach or budget changes.

## 13. Open Questions

- Which Reacher Social Intelligence data endpoints and auth headers are available during the hackathon?
- Does Reacher expose campaign-level, creator-level, and content-level metrics separately?
- Should Nia sources be created inside the app, or should users provide pre-indexed source IDs for the MVP?
- Do we need to support uploaded CSV files in the MVP, or is editable sample data enough?
- Should the demo prioritize sales/TikTok Shop outcomes over awareness and engagement?
- Should recommendations include exact budget percentages or qualitative budget direction only?
- Will the final app remain Vite + React, or should it migrate to Next.js later?

## 14. Recommended Immediate Next Step

Implement Phase 1 first:

1. Install LangGraph, OpenAI, Nia, and Zod dependencies.
2. Add typed schemas under `apps/api/src/agent/schema.ts`.
3. Build `apps/api/src/integrations/nia.ts`.
4. Build `apps/api/src/integrations/reacher.ts` with a placeholder adapter if final endpoints are still being verified.
5. Build `apps/api/src/agent/graph.ts`.
6. Update `apps/api/src/agent/runAgent.ts` to invoke the compiled graph.
7. Keep the frontend mostly unchanged until the structured API response is stable.

## 15. External References

- Nia welcome docs: https://docs.trynia.ai/welcome
- Nia API guide: https://docs.trynia.ai/api-guide.md
- Nia TypeScript SDK quickstart: https://docs.trynia.ai/sdk/quickstart.md
- Nia LangChain integration: https://docs.trynia.ai/integrations/langchain.md
- Reacher API docs: https://portal.reacherapp.com/docs/api?hackathon=1#description/introduction
