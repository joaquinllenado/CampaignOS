import { ApiError, NiaSDK, V2ApiSourcesService } from "nia-ai-ts";
import type { Source } from "nia-ai-ts";

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "html",
  "htm",
  "xml",
  "log",
  "yaml",
  "yml",
  "rst",
  "rtf",
  "adoc",
  "asc"
]);

/** MIME types accepted by `POST /sources/upload-url` per Nia API */
const BINARY_UPLOAD_BY_EXT: Record<
  string,
  { contentType: string; isPdf?: boolean; isSpreadsheet?: boolean }
> = {
  pdf: { contentType: "application/pdf", isPdf: true },
  xlsx: {
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    isSpreadsheet: true
  },
  xls: { contentType: "application/vnd.ms-excel", isSpreadsheet: true },
  csv: { contentType: "text/csv", isSpreadsheet: true },
  tsv: { contentType: "text/tab-separated-values", isSpreadsheet: true }
};

const MAX_TEXT_BYTES = 12 * 1024 * 1024;

const DEFAULT_NIA_INGEST_TIMEOUT_MS = 180_000;

function niaIngestTimeoutMs(): number {
  const configured = Number(Bun.env.NIA_INGEST_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_NIA_INGEST_TIMEOUT_MS;
}

/**
 * Nia's SDK uses fetch without AbortSignal; POST /sources can block until indexing finishes
 * or stall indefinitely. Bound wall time so the API returns an error instead of hanging.
 */
async function withNiaIngestTimeout<T>(label: string, work: Promise<T>): Promise<T> {
  const ms = niaIngestTimeoutMs();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${Math.round(ms / 1000)}s (Nia API or upload stalled). Try a smaller file, check Nia status, or raise NIA_INGEST_TIMEOUT_MS.`
        )
      );
    }, ms);
  });
  try {
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export type BrandFileIngestItem = {
  filename: string;
  sourceId: string;
  displayName: string | null;
  status: string | null;
  method: "text_local_folder" | "signed_upload";
};

export type BrandFileIngestResult = {
  indexed: BrandFileIngestItem[];
  errors: { filename: string; message: string }[];
};

function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

function safeRelativePath(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "document";
  return base.replace(/[^a-zA-Z0-9._\- ]+/g, "_").slice(0, 180) || "document.txt";
}

function displayNameFor(label: string | undefined, filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const cleaned = label?.trim();
  if (!cleaned) return base;
  return `${cleaned} — ${base}`;
}

function uniqueFolderName(filename: string): string {
  const stem = safeRelativePath(filename).replace(/\.[^.]+$/, "");
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `brand-${stem.slice(0, 24)}-${id}`.replace(/_{2,}/g, "_");
}

function ensureNiaConfigured(): NiaSDK {
  const apiKey = Bun.env.NIA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NIA_API_KEY is not set. Add it to your environment to index files.");
  }
  const baseUrl = Bun.env.NIA_BASE_URL?.trim() || "https://apigcp.trynia.ai/v2";
  return new NiaSDK({ apiKey, baseUrl });
}

async function ingestTextFile(
  sdk: NiaSDK,
  file: File,
  displayName: string
): Promise<Source> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_TEXT_BYTES) {
    throw new Error(`File exceeds ${MAX_TEXT_BYTES / (1024 * 1024)} MiB text limit.`);
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);

  return sdk.sources.create({
    type: "local_folder",
    folder_name: uniqueFolderName(file.name),
    display_name: displayName,
    files: [{ path: safeRelativePath(file.name), content: text }],
    add_as_global_source: false
  });
}

async function ingestBinaryViaSignedUrl(
  sdk: NiaSDK,
  file: File,
  displayName: string,
  spec: { contentType: string; isPdf?: boolean; isSpreadsheet?: boolean }
): Promise<Source> {
  const uploadMeta = await V2ApiSourcesService.createSourceUploadUrlV2SourcesUploadUrlPost({
    filename: safeRelativePath(file.name),
    content_type: spec.contentType
  });

  const body = await file.arrayBuffer();
  const putRes = await fetch(uploadMeta.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": spec.contentType
    },
    body,
    signal: AbortSignal.timeout(niaIngestTimeoutMs())
  });

  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (${putRes.status})`);
  }

  return sdk.sources.create({
    type: "documentation",
    gcs_path: uploadMeta.gcs_path,
    display_name: displayName,
    is_pdf: spec.isPdf ?? false,
    is_spreadsheet: spec.isSpreadsheet ?? false,
    add_as_global_source: false
  });
}

export async function ingestBrandContextFiles(
  files: File[],
  options?: { campaignLabel?: string }
): Promise<BrandFileIngestResult> {
  if (!files.length) {
    throw new Error("At least one file is required.");
  }

  const sdk = ensureNiaConfigured();
  const indexed: BrandFileIngestItem[] = [];
  const errors: { filename: string; message: string }[] = [];

  for (const file of files) {
    const displayName = displayNameFor(options?.campaignLabel, file.name);
    const ext = extensionOf(file.name);

    try {
      const binarySpec = BINARY_UPLOAD_BY_EXT[ext];
      let source: Source;

      if (binarySpec) {
        source = await withNiaIngestTimeout(
          `Nia ingest (${file.name})`,
          ingestBinaryViaSignedUrl(sdk, file, displayName, binarySpec)
        );
      } else if (TEXT_EXTENSIONS.has(ext) || ext === "") {
        source = await withNiaIngestTimeout(
          `Nia ingest (${file.name})`,
          ingestTextFile(sdk, file, displayName)
        );
      } else {
        throw new Error(
          `Unsupported type (.${ext || "unknown"}). Use PDF, Excel/CSV, or plain text/Markdown/JSON.`
        );
      }

      indexed.push({
        filename: file.name,
        sourceId: source.id,
        displayName: source.display_name ?? displayName,
        status: source.status ?? null,
        method: binarySpec ? "signed_upload" : "text_local_folder"
      });
    } catch (caught) {
      let message: string;
      if (caught instanceof ApiError) {
        const detail =
          caught.body === undefined
            ? ""
            : typeof caught.body === "string"
              ? caught.body
              : JSON.stringify(caught.body);
        message = detail ? `${caught.message} ${detail}` : caught.message;
      } else if (caught instanceof Error) {
        message = caught.message;
      } else {
        message = String(caught);
      }
      errors.push({ filename: file.name, message });
    }
  }

  return { indexed, errors };
}
