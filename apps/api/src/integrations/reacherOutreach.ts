export type OutreachDraftInput = {
  creatorName?: string;
  creatorHandle?: string;
  body: string;
};

export type OutreachBatchInput = {
  tier: "high" | "average" | "low";
  campaignName: string;
  subject?: string;
  drafts: OutreachDraftInput[];
  recipientEmails?: string[];
};

export type OutreachBatchResult = {
  ok: boolean;
  dryRun: boolean;
  automationId?: number;
  message: string;
};

const DEFAULT_REACHER_BASE_URL = "https://api.reacherapp.com/public/v1";

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function reacherBaseUrl(): string {
  const configured = Bun.env.REACHER_BASE_URL?.trim() || DEFAULT_REACHER_BASE_URL;
  const url = new URL(configured);
  if (url.hostname === "portal.reacherapp.com") url.hostname = "api.reacherapp.com";
  if (url.hostname === "api.reacherapp.com" && !url.pathname.includes("/public/v1")) {
    url.pathname = `${trimSlashes(url.pathname) ? `/${trimSlashes(url.pathname)}` : ""}/public/v1`;
  }
  return url.toString();
}

function tierLabel(tier: OutreachBatchInput["tier"]): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function defaultSubject(input: OutreachBatchInput): string {
  return `${tierLabel(input.tier)} performer follow-up — ${input.campaignName}`.slice(0, 255);
}

function composeBody(input: OutreachBatchInput): string {
  const intro = `Performance outreach batch for ${tierLabel(input.tier).toLowerCase()} performers on "${input.campaignName}".`;
  const sections = input.drafts.map((draft, index) => {
    const heading = draft.creatorName
      ? `${draft.creatorName}${draft.creatorHandle ? ` (${draft.creatorHandle})` : ""}`
      : `Recipient ${index + 1}`;
    return `--- ${heading} ---\n${draft.body.trim()}`;
  });
  return [intro, "", ...sections].join("\n\n").slice(0, 50000);
}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function sendBatchOutreach(input: OutreachBatchInput): Promise<OutreachBatchResult> {
  if (!input.drafts.length) {
    return { ok: false, dryRun: false, message: "No drafts selected for this batch." };
  }

  const apiKey = Bun.env.REACHER_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: true,
      dryRun: true,
      message: `Mock send: REACHER_API_KEY not set. Would have sent ${input.drafts.length} ${input.tier} draft(s).`
    };
  }

  const emailAccountId = Number(Bun.env.REACHER_EMAIL_ACCOUNT_ID?.trim() ?? "");
  if (!Number.isInteger(emailAccountId) || emailAccountId <= 0) {
    return {
      ok: true,
      dryRun: true,
      message: `Mock send: REACHER_EMAIL_ACCOUNT_ID not set. Would have sent ${input.drafts.length} ${input.tier} draft(s).`
    };
  }

  const liveSend = Bun.env.REACHER_OUTREACH_LIVE?.trim().toLowerCase() === "true";
  const dryRun = !liveSend;
  const recipients = (input.recipientEmails ?? []).filter((email) => email.includes("@"));

  const requestBody = {
    automation_name: `${input.campaignName} · ${tierLabel(input.tier)} batch`.slice(0, 120),
    email_account_id: emailAccountId,
    subject: input.subject?.trim() || defaultSubject(input),
    body: composeBody(input),
    selection_mode: "mailing_list" as const,
    mailing_list: {
      list_upload_emails: recipients,
      lists_selected: []
    }
  };

  const url = `${trimSlashes(reacherBaseUrl())}/automations/email`;
  const shopId = Bun.env.REACHER_SHOP_ID?.trim();

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "Idempotency-Key": uuid(),
        ...(dryRun ? { "X-Dry-Run": "true" } : {}),
        ...(shopId ? { "x-shop-id": shopId } : {})
      },
      body: JSON.stringify(requestBody)
    });

    const text = await response.text();
    let data: unknown = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      // ignore
    }

    if (!response.ok) {
      const errMessage =
        (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : undefined) ?? `Reacher returned ${response.status}.`;
      return { ok: false, dryRun, message: errMessage };
    }

    const automationId =
      data && typeof data === "object" && "automation_id" in data && typeof (data as { automation_id: unknown }).automation_id === "number"
        ? (data as { automation_id: number }).automation_id
        : undefined;

    return {
      ok: true,
      dryRun,
      automationId,
      message: dryRun
        ? `Validated ${input.drafts.length} ${input.tier} draft(s) via dry-run.`
        : `Created Reacher email automation${automationId ? ` #${automationId}` : ""} for ${input.drafts.length} ${input.tier} draft(s).`
    };
  } catch (error) {
    return {
      ok: false,
      dryRun,
      message: error instanceof Error ? error.message : "Reacher request failed."
    };
  }
}
