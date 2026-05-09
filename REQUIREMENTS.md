# CampaignOS — Requirements: AI-Native Campaign Intelligence Agent

## 1. Product Summary

CampaignOS is an AI-native campaign strategist that helps brands evaluate influencer campaigns against real business objectives, not only vanity metrics. The system should use Nia by Nozomio Labs as the indexing and retrieval layer for campaign context, briefs, PDFs, docs, and historical knowledge, then use Reacher as the source of creator and campaign metrics. The agent should combine those sources to generate an objective-specific measurement framework, evaluate creators and content across the funnel, explain what drove outcomes, and recommend next best actions.

After initial onboarding (campaign context, sources, and metrics setup), the user lands on a **performance dashboard** summarizing how the campaign is tracking, what to do next, whether any actions are critical, what the agent has already done for them, and optional **draft outreach** the user can send to creators. For the hackathon demo, dashboard metrics, activity, and drafts may be **dummy or seeded data** as long as the UX and data shapes match the production intent.

The MVP should focus on a complete end-to-end analysis loop:

1. Capture campaign context.
2. Retrieve indexed context from Nia.
3. Fetch or normalize creator metrics from Reacher.
4. Generate a weighted KPI framework.
5. Evaluate creator and content performance.
6. Diagnose why results happened.
7. Recommend optimization actions.
8. Draft optional **creator outreach messages** aligned to recommendations.
9. Return a structured strategy report and **dashboard fields** (`actionHealth`, `performanceSnapshot`, `agentActivity`, `creatorMessageDrafts`) for the web app.

## 2. Success Criteria

The MVP is successful when a user can **complete onboarding** with campaign context and sample performance metrics, run the agent, land on a **dashboard** that surfaces health, actions, activity, and drafts, and receive a structured campaign intelligence report with:

- A detected or confirmed campaign objective.
- A weighted KPI model tailored to awareness, engagement, or sales goals.
- Creator-level scoring and rationale.
- Funnel analysis that explains bottlenecks and tradeoffs.
- Attribution reasoning that connects creator/content behavior to outcomes.
- Prioritized recommendations for creative direction, creator mix, CTA strategy, and budget allocation.
- Clear enough output for a hackathon demo without requiring external dashboards.
- A post-onboarding **dashboard** showing performance at a glance, **recommended actions** (empty state when none), a **green / yellow / red** indicator for whether critical follow-ups exist, a chronological **agent activity** list, and **draft messages to creators** the user can copy or edit before sending (no automated sending in MVP).

## 3. User Personas

### Brand Marketer

Needs to know whether an influencer campaign worked, which creators mattered, and what to change next.

### Growth Strategist

Needs to connect social signals to funnel outcomes such as CTR, GMV, conversion rate, CPA, ROAS, and repeat purchase indicators.

### Campaign Manager

Needs creator-specific guidance, outreach direction, budget allocation suggestions, and campaign monitoring insights.

## 4. Core User Flow

1. User opens the web app and completes **onboarding**: campaign details; **supported documents** uploaded in-app are **indexed to Nia automatically** as soon as upload completes (no separate “index” click); optional existing Nia source IDs; Reacher or manual/demo metrics; and any required validation.
2. Onboarding completion navigates the user to the **performance dashboard** (demo may use dummy data until a live agent run completes).
3. Dashboard shows performance summary, recommended actions, action-health indicator (**green** / **yellow** / **red**), agent activity, and creator message drafts when available.
4. User may open a **full report** view from the dashboard or trigger a new agent run with updated inputs.
5. User may review agent-generated **drafts to creators** (e.g. messaging aligned to campaign goals), copy text, or edit locally; sending happens outside the product in MVP.
6. API validates payloads and runs the LangGraph agent when the user requests analysis.
7. Agent normalizes the brief, Nia context, and Reacher metrics into a typed campaign state.
8. Agent generates a dynamic KPI framework based on campaign objective.
9. Agent evaluates creators against the weighted framework.
10. Agent diagnoses attribution and funnel issues.
11. Agent creates optimization recommendations and **may produce per-creator or per-suggestion message drafts** for the user to send.
12. API returns a structured report (and dashboard-shaped fields as applicable) to the web app.
13. Web app renders the dashboard, executive summary, KPI framework, creator ranking, attribution insights, recommendations, and draft outreach UI.

## 5. MVP Scope

### In Scope

- Campaign intake form.
- **Supported document upload** with **immediate, automatic** indexing/registering in Nia when a file is accepted (background job or API call; user sees status only—**not** a separate manual “Index to Nia” step as the default path).
- Nia-backed retrieval for campaign context (including uploaded and pre-linked sources).
- Reacher-backed metrics ingestion through an API adapter.
- Objective support for `awareness`, `engagement`, and `sales`.
- OpenAI-backed LangGraph agent in the API app.
- Structured agent output validated before returning to the client.
- Mock/sample campaign performance data for demo reliability.
- Creator-level scoring and explanation.
- Objective-specific KPI weighting.
- Attribution and optimization reasoning.
- Single-turn agent execution through `POST /api/agent/run`.
- **Post-onboarding performance dashboard** with: performance snapshot, recommended actions list, **action-health** indicator (green / yellow / red), **agent activity** timeline, and integration points for the full report.
- **Creator outreach drafts** generated by the agent (goal alignment, creative tweaks, CTA guidance); user-triggered copy/edit only.
- Dummy or seeded dashboard and activity data acceptable for demo reliability.

### Out of Scope for MVP

- Direct TikTok Shop API integrations outside the data exposed by Reacher.
- Persistent database storage.
- User authentication.
- Scheduled campaign monitoring jobs.
- **Automated** or **unsupervised** sending of messages to creators (drafts and user-initiated copy-out are in scope; bot-style DM/email send is not).
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
- **Supported context documents** (optional): user-uploaded files (e.g. PDFs, briefs, historical analyses—exact MIME/types as enforced by the app and Nia). On successful upload, the **system must start Nia indexing without requiring an extra user action** (see §6.9).

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

### 6.7 Post-Onboarding Performance Dashboard

After onboarding, the primary home experience is a **dashboard** that answers: *How are we doing? What should I do? Is anything urgent? What has the agent done for me?*

The dashboard must include:

- **Performance snapshot**: short summary tied to the campaign objective and KPI framework (e.g. vs targets or vs prior period when data exists; demo may show static copy).
- **Recommended actions**: ordered list derived from agent recommendations (or empty state with copy like “No actions right now”). Each item should remain consistent with `Recommendation` priority and category where applicable.
- **Action-health indicator** (traffic light):
  - **Green**: no high-priority open actions, or critical items are cleared (copy should state the assumption in demo mode).
  - **Yellow**: medium-priority items, missing data, or time-sensitive but non-critical follow-ups.
  - **Red**: at least one **high**-priority recommendation is unresolved or the system detects a critical blocker (e.g. campaign goal at risk, compliance gap called out in brief).
- **Agent activity log**: reverse-chronological list of **autonomous or user-invoked agent outcomes**, such as: analysis runs completed, KPI framework regenerated, drafts created or updated, brief/context refreshes. Each entry should include a title, one-line description, timestamp, and optional link to the related report section or creator.

For hackathon demos, **dummy or seeded** performance numbers, actions, health state, and activity rows are acceptable if labeled in data provenance or UI as demo data when appropriate.

### 6.8 Creator Communication Drafts (Agent-Crafted Messages)

The agent must be able to produce **draft messages** the brand user can send to creators when recommendations imply coordination (e.g. shift hook to align with sales goal, clarify CTA timing, tighten brand voice).

Each draft should include:

- Target creator (name and/or handle) or “broadcast” variant if the same guidance applies to a segment.
- **Message body** (and optional subject line if the channel implies it).
- **Rationale**: why this message supports the campaign objective (one or two sentences).
- **Suggestion type** (e.g. `messaging_alignment`, `creative_tweak`, `cta`, `timeline`, `measurement_ask`).
- Linkage to the originating recommendation or evaluation when possible.

Requirements:

- Drafts are **suggestions only**; the user must explicitly copy, export, or edit before any real outreach.
- The agent must not fabricate private creator contact details not supplied by the user or integrations.
- Tone should match brand voice when provided in the brief.

### 6.9 Nia Context Retrieval

The system must use Nia as the source-of-truth layer for indexed campaign context.

#### Automatic indexing on upload

When the user uploads a **supported** document during onboarding (or campaign setup):

- The web app must **send the file to the API** (or a signed upload flow dictated by Nia) **as soon as the upload completes**—not after a separate “Index” or “Add to Nia” confirmation, except where a **retry** is needed after a hard failure.
- The API must **register or index the content in Nia** per Nia’s SDK/REST contract and persist the resulting **source identifier(s)** in session/agent input so `retrieveNiaContext` can include them.
- The UI must show **indexing progress** and outcome (success, partial, failed) and surface errors without blocking the rest of onboarding unless the user relies solely on that file for context.
- Users may still **paste or select pre-indexed Nia source IDs** for cases already in their workspace; that path does not require re-upload.

Nia should support:

- Indexing campaign briefs, PDFs, docs, datasets, local folders, or historical campaign notes.
- Searching indexed sources for relevant audience, product, market, and brand context.
- Reading source excerpts when the agent needs exact supporting detail.
- Returning citation metadata so the report can distinguish source-backed facts from model reasoning.

The MVP should integrate Nia through the TypeScript SDK or direct REST API. Nia's docs describe `nia-ai-ts` as the TypeScript SDK and `https://apigcp.trynia.ai/v2` as the REST base URL. Nia also exposes a LangChain integration, but that package is Python-first, so the Bun/TypeScript API should prefer the SDK or direct REST client unless a TypeScript LangChain tool wrapper is added later.

Required Nia operations:

- **Create or index a source from an uploaded file** (or equivalent API) and return stable source reference(s).
- List or resolve configured sources.
- Search across selected sources for the active campaign.
- Read specific source excerpts when search results need supporting context.
- Optionally save report summaries back to Nia context sharing after the demo flow works.

### 6.10 Reacher Metrics Ingestion

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
  creatorMessageDrafts?: CreatorMessageDraft[];
  report?: CampaignIntelligenceReport;
  errors: string[];
};
```

`composeReport` should derive dashboard-oriented fields for the web app (`actionHealth`, `performanceSnapshot`, `agentActivity` for this run, and surface `creatorMessageDrafts`) so a single `POST /api/agent/run` response can populate the post-onboarding dashboard without a second round trip when persistence is absent.

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

#### `draftCreatorMessages`

Purpose:

- Turn high-value recommendations and creator evaluations into **draft outbound messages** (goal alignment, creative tweaks, CTAs, timing) the user can copy or edit.
- Respect brand voice from the brief and avoid inventing private contact details.

Output:

- `creatorMessageDrafts`

#### `composeReport`

Purpose:

- Convert graph state into the final response contract.
- Ensure the response is structured, complete, and UI-friendly.
- Compute **`actionHealth`** (green / yellow / red) from recommendation priorities and confidence, build a short **`performanceSnapshot`** for the dashboard hero, and append **`agentActivity`** entries describing this run (e.g. analysis completed, draft count).

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
  -> draftCreatorMessages
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
    .addNode("draftCreatorMessages", draftCreatorMessages)
    .addNode("composeReport", composeReport)
    .addEdge(START, "normalizeInput")
    .addEdge("normalizeInput", "retrieveNiaContext")
    .addEdge("retrieveNiaContext", "fetchReacherMetrics")
    .addEdge("fetchReacherMetrics", "generateKpiFramework")
    .addEdge("generateKpiFramework", "evaluateCreators")
    .addEdge("evaluateCreators", "reasonAboutAttribution")
    .addEdge("reasonAboutAttribution", "recommendOptimizations")
    .addEdge("recommendOptimizations", "draftCreatorMessages")
    .addEdge("draftCreatorMessages", "composeReport")
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

The **`draftCreatorMessages`** prompt must additionally:

- Produce copy-paste-ready message bodies appropriate for async creator collaboration (no automated send).
- Tie each draft to a concrete recommendation or evaluation when possible.

### Safety and Accuracy Requirements

The agent must:

- Not fabricate exact numbers that are not in the input.
- Distinguish observed metrics from inferred strategy.
- Distinguish Nia-sourced context from Reacher-sourced metrics and LLM-generated interpretation.
- Mark low-confidence conclusions when key metrics are absent.
- Keep recommendations advisory, not guaranteed outcomes.
- Avoid storing secrets or user data in logs.
- Treat **creator message drafts** as user-reviewed outbound copy: no claims that messages were delivered.

## 9. API Requirements

### `GET /api/dashboard` (optional for demo)

If the app has no persistence, the client can **derive the dashboard from the latest `CampaignIntelligenceReport`** held in memory or session storage. Alternatively, expose a thin endpoint that returns **seeded dummy** `CampaignDashboardPayload` for hackathon demos.

When implemented, `CampaignDashboardPayload` should align with section 11 (performance snapshot, `actionHealth`, recommended actions, `agentActivity`, `creatorMessageDrafts`, `dataProvenance`).

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
  /** Short hero text for the post-onboarding dashboard (may mirror or compress the executive summary). */
  performanceSnapshot: string;
  objective: "awareness" | "engagement" | "sales";
  dataProvenance: DataProvenance;
  kpiFramework: KpiFramework;
  creatorEvaluations: CreatorEvaluation[];
  attributionInsights: AttributionInsight[];
  recommendations: Recommendation[];
  /** Traffic-light status: whether critical follow-ups exist (see §6.7). */
  actionHealth: ActionHealth;
  /** Chronological log of what this agent run produced (dashboard “activity” strip). */
  agentActivity: AgentActivityItem[];
  creatorMessageDrafts: CreatorMessageDraft[];
  confidence: "low" | "medium" | "high";
  generatedAt: string;
  model: string;
};
```

Compatibility option for the current scaffold:

- Keep accepting `{ prompt: string }` while developing.
- Add structured input support in parallel.
- Remove prompt-only mode before final demo if the UI no longer uses it.

### Nia document upload (indexing)

Document uploads should use a dedicated route (e.g. **`POST /api/nia/upload`** or multipart on an existing campaign endpoint) that **triggers indexing as soon as the server receives the file**—synchronously or via queue until completion—and returns `{ sourceId(s), status }` for the client to merge into `nia.sourceIds` before `POST /api/agent/run`. The client must **not** depend on a separate user click to start indexing after a successful upload. Exact path and Nia upload semantics follow the `nia-ai-ts` / REST contract.

## 10. Web App Requirements

The current web app can start as a single-page MVP. **Onboarding** collects campaign context and metrics; completing onboarding routes to the **dashboard** as the primary home.

### Intake UI

The UI should include:

- Campaign objective selector.
- Campaign brief textarea.
- **Document upload** (supported types only): on file drop/select, **start Nia indexing immediately**; show per-file progress and final Nia source id(s). Do not rely on a separate “Index” button as the primary flow.
- Nia source selector or source ID input (for **pre-indexed** sources the user already has).
- Reacher campaign ID and creator ID inputs.
- Product/category input.
- Audience input.
- Budget input.
- KPI priorities input.
- Creator metrics editor or sample data selector.
- Clear **completion** control that transitions to the dashboard (demo may skip validation beyond existing rules).

### Post-Onboarding Dashboard UI

After onboarding, the default view is a **dashboard** (not the full report). It should include:

- **Performance snapshot** — prominent summary tied to objective and KPIs; show demo/dummy badge when using seeded data.
- **Action-health indicator** — green / yellow / red with a one-sentence explanation and link or scroll target to recommended actions.
- **Recommended actions** — list from `recommendations`, ordered by priority; empty state when the list is empty.
- **Agent activity** — feed from `agentActivity` (timestamps, short descriptions); for multi-run demos, append or merge client-side.
- **Creator message drafts** — cards with body, rationale, suggestion type, copy-to-clipboard; optional local edit before copy; **no** “send” button that triggers real delivery in MVP.

Navigation from the dashboard to the **full report** (existing report sections) should remain one click away.

### Report UI

The UI should render:

- Executive summary card.
- KPI framework with weights.
- Creator ranking table/cards.
- Attribution insights.
- Recommended actions grouped by priority.
- Creator message drafts (same content as dashboard, optional duplicate section).
- Data provenance showing Nia context, Reacher metrics, and demo fallback usage.
- Confidence and missing data notes.

### Demo Data

Include at least three sample scenarios:

- Awareness campaign with strong reach but weak sentiment.
- Engagement campaign with strong comments and saves.
- Sales campaign where tutorial creators outperform entertainment creators on GMV and conversion.

Each sample should optionally include **pre-baked** `actionHealth`, `agentActivity`, and `creatorMessageDrafts` so the dashboard is populated before the first live agent call.

## 11. Data Model Draft

```ts
type CampaignObjective = "awareness" | "engagement" | "sales" | "auto";

type ActionHealth = {
  status: "green" | "yellow" | "red";
  /** User-facing explanation, e.g. why red vs yellow. */
  message: string;
  /** Optional machine-readable reasons for UI tests. */
  reasons?: string[];
};

type AgentActivityItem = {
  id: string;
  kind:
    | "analysis_completed"
    | "kpi_framework_generated"
    | "recommendations_ready"
    | "drafts_generated"
    | "context_refreshed";
  title: string;
  description: string;
  occurredAt: string;
  relatedCreatorHandle?: string;
};

type CreatorMessageDraft = {
  id: string;
  creatorName?: string;
  creatorHandle?: string;
  subject?: string;
  body: string;
  rationale: string;
  suggestionType:
    | "messaging_alignment"
    | "creative_tweak"
    | "cta"
    | "timeline"
    | "measurement_ask"
    | "other";
  linkedRecommendationId?: string;
};

type CampaignDashboardPayload = {
  performanceSnapshot: string;
  actionHealth: ActionHealth;
  recommendations: Recommendation[];
  agentActivity: AgentActivityItem[];
  creatorMessageDrafts: CreatorMessageDraft[];
  dataProvenance: DataProvenance;
  generatedAt: string;
};

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
  id?: string;
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
- Replace placeholder `runAgent` with a LangGraph workflow including **`draftCreatorMessages`** and extended **`composeReport`** output (`performanceSnapshot`, `actionHealth`, `agentActivity`, `creatorMessageDrafts`).
- Define shared TypeScript schemas for input and output.
- Return a structured report from the API.

### Phase 2: Nia and Reacher Adapters

- Build a Nia client for **file ingest → index/create source**, source search, and excerpt retrieval.
- Build a Reacher client that fetches raw creator/campaign metrics.
- Normalize Reacher responses into `CreatorMetricInput`.
- Add demo fallback metrics when credentials or IDs are missing.
- Track data provenance in agent state.

### Phase 3: Deterministic Scoring Helpers

- Implement metric normalization helpers.
- Compute creator score from the generated KPI weights.
- Use deterministic scoring for numeric evaluation.
- Use the LLM for framework generation, interpretation, attribution, recommendations, and **creator message drafts**.

### Phase 4: Web MVP

- Replace generic prompt UI with campaign **onboarding** intake UI.
- Route completed onboarding to the **post-onboarding dashboard** (populate from latest agent response and/or seeded demo payload).
- Add **upload-to-Nia** flow (auto-index on upload) plus Nia source IDs and Reacher campaign fields.
- Add editable sample campaign data.
- Render dashboard sections: snapshot, action-health, recommended actions, agent activity, creator drafts with copy-to-clipboard.
- Render structured full report sections (link from dashboard).
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
- Expand upload coverage (additional formats, bulk upload, versioned replaces) beyond the MVP auto-index path.
- Add creator discovery from additional Reacher Social Intelligence data.
- Add scheduled monitoring with anomaly detection.
- Add human approval checkpoints before **automated outbound** messages or budget actions (draft-and-copy in MVP already requires human send).

## 13. Open Questions

- Which Reacher Social Intelligence data endpoints and auth headers are available during the hackathon?
- Does Reacher expose campaign-level, creator-level, and content-level metrics separately?
- For MVP, **supported uploads create Nia sources inside the app via auto-indexing**; are there remaining cases where only pre-indexed source IDs (no upload) must be supported for the demo?
- Do we need to support uploaded CSV files in the MVP, or is editable sample data enough?
- Should the demo prioritize sales/TikTok Shop outcomes over awareness and engagement?
- Should recommendations include exact budget percentages or qualitative budget direction only?
- Will the final app remain Vite + React, or should it migrate to Next.js later?
- For creator drafts, is email-style copy sufficient for the demo, or should we mimic in-platform (e.g. TikTok) message formatting?

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
