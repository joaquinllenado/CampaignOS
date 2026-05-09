/** Fields collected in the user-facing intake form (required + common campaign inputs). */
export type CampaignIntakeFields = {
  name: string;
  brand: string;
  product: string;
  audience: string;
  budget: string;
  brief: string;
};

export type CampaignObjective = "awareness" | "engagement" | "sales";

export type WeightedKpiMetric = {
  name: string;
  weight: number;
  reason: string;
};

export type MetricDefinition = {
  name: string;
  displayName: string;
  definition: string;
  whyItMatters: string;
  sourceMetricKeys: string[];
};

export type KpiFramework = {
  objective: CampaignObjective;
  summary: string;
  metrics: WeightedKpiMetric[];
  evaluationLogic: string[];
  confidence: "low" | "medium" | "high";
};

export type DataProvenance = {
  contextSource: "nia" | "brief_only";
  metricsSource: "reacher" | "manual" | "demo";
  niaSourcesUsed: string[];
  reacherObjectsUsed: string[];
  missingInputs: string[];
};

export type CampaignMetricSummary = {
  campaignType?: string;
  campaignWindow?: string;
  status?: string;
  postingCreators?: number;
  videosPosted?: number;
  totalViews?: number;
  avgDailyViews?: number;
  peakVisibilityViews?: number;
  totalLikes?: number;
  totalComments?: number;
  avgEngagementRate?: number;
  totalOrders?: number;
  newCreatorsPosting?: number;
  creatorsReached?: number;
  creatorsMessaged?: number;
  tcInvitesSent?: number;
  keyTakeaways?: string[];
  strongestFormats?: string[];
  strongestCreatorTraits?: string[];
  strengths?: string[];
  weaknesses?: string[];
  strategicRecommendations?: string[];
  highestLeverageOpportunity?: string;
  fetchedAt?: string;
};

export type Recommendation = {
  id?: string;
  priority: "high" | "medium" | "low";
  category: "creator_mix" | "creative_direction" | "cta" | "budget" | "audience" | "measurement";
  action: string;
  rationale: string;
  expectedImpact: string;
  followUpDataNeeded?: string[];
};

export type CreatorEvaluation = {
  creatorName: string;
  score: number;
  rank: number;
  performanceTier: "low" | "average" | "high";
  tierRationale: string;
  strengths: string[];
  weaknesses: string[];
  primaryDriver: string;
  primaryDrag: string;
  recommendedAction: string;
  confidence: "low" | "medium" | "high";
};

export type ObjectiveBlend = {
  weights: Record<CampaignObjective, number>;
  rationale: string;
  confidence: "low" | "medium" | "high";
};

export type FrameworkCreatorEvaluation = {
  creatorName: string;
  score: number;
  performanceTier: "low" | "average" | "high";
  tierRationale: string;
  strongestMetrics: string[];
  weakestMetrics: string[];
  missingMetrics: string[];
  confidence: "low" | "medium" | "high";
};

export type FrameworkEvaluation = {
  objective: CampaignObjective;
  framework: KpiFramework;
  metricDefinitions: MetricDefinition[];
  campaignScore: number;
  creatorEvaluations: FrameworkCreatorEvaluation[];
  takeaways: string[];
  confidence: "low" | "medium" | "high";
};

export type AttributionInsight = {
  claim: string;
  evidence: string[];
  businessImplication: string;
  confidence: "low" | "medium" | "high";
};

export type ActionHealth = {
  status: "green" | "yellow" | "red";
  message: string;
  reasons?: string[];
};

export type AgentActivityItem = {
  id: string;
  kind: "analysis_completed" | "kpi_framework_generated" | "recommendations_ready" | "drafts_generated" | "context_refreshed";
  title: string;
  description: string;
  occurredAt: string;
  relatedCreatorHandle?: string;
};

export type CreatorMessageDraft = {
  id: string;
  creatorName?: string;
  creatorHandle?: string;
  subject?: string;
  body: string;
  rationale: string;
  suggestionType: "messaging_alignment" | "creative_tweak" | "cta" | "timeline" | "measurement_ask" | "other";
  linkedRecommendationId?: string;
};

export type CampaignIntelligenceReport = {
  executiveSummary: string;
  performanceSnapshot: string;
  objective: CampaignObjective;
  dataProvenance: DataProvenance;
  campaignSummary?: CampaignMetricSummary;
  kpiFramework: KpiFramework;
  objectiveBlend: ObjectiveBlend;
  frameworkEvaluations: FrameworkEvaluation[];
  creatorEvaluations: CreatorEvaluation[];
  attributionInsights: AttributionInsight[];
  recommendations: Recommendation[];
  actionHealth: ActionHealth;
  agentActivity: AgentActivityItem[];
  creatorMessageDrafts: CreatorMessageDraft[];
  confidence: "low" | "medium" | "high";
  generatedAt: string;
  model: string;
};

export type AgentRunSuccess =
  | {
      mode: "legacy_prompt";
      answer: string;
      createdAt: string;
      model: string;
    }
  | CampaignIntelligenceReport;

export type AgentRunErrorResponse = {
  error: string;
};
