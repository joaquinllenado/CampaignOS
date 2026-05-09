/**
 * Static demo PDFs served from `apps/web/public/demo_documents/` (repo: `demo_documents/`).
 */
export const DEMO_BRAND_CONTEXT_PDF_FILENAMES = [
  "campaign_brief_full.pdf",
  "brand_voice_notes_full.pdf",
  "creator_notes_and_messages_full.pdf"
] as const;

function publicAssetUrl(pathSegments: string[]): string {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  const path = pathSegments.join("/");
  return `${prefix}/${path}`;
}

export function demoBrandContextPdfAssets(): ReadonlyArray<{ href: string; name: string }> {
  return DEMO_BRAND_CONTEXT_PDF_FILENAMES.map((filename) => ({
    href: publicAssetUrl(["demo_documents", filename]),
    name: filename
  }));
}

export async function fetchDemoBrandContextFiles(): Promise<File[]> {
  const out: File[] = [];
  for (const { href, name } of demoBrandContextPdfAssets()) {
    const res = await fetch(href);
    if (!res.ok) {
      throw new Error(`Could not load demo document “${name}” (${res.status}).`);
    }
    const buf = await res.arrayBuffer();
    out.push(new File([buf], name, { type: "application/pdf" }));
  }
  return out;
}
