import type { Dispatch, DragEvent, SetStateAction } from "react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { ingestNiaBrandFiles } from "../lib/api";

type Props = {
  campaignLabel?: string;
  indexedSourceIds: string[];
  onIndexedSourceIdsChange: Dispatch<SetStateAction<string[]>>;
  /** Override default “Supporting documents” heading */
  title?: string;
  /** Override default explanatory paragraph under the heading */
  description?: string;
  /** Accessible label for the hidden file input */
  fileInputLabel?: string;
};

const dropOuterClass =
  "relative flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center transition dark:border-zinc-700 dark:bg-zinc-800/50";

export function BrandContextDropzone(props: Props) {
  const {
    campaignLabel,
    indexedSourceIds,
    onIndexedSourceIdsChange,
    title = "Supporting documents",
    description = "Drop PDFs, spreadsheets, or text files describing past campaigns, outcomes, or internal metrics. We index them into Nia so the agent can search this context alongside your brief.",
    fileInputLabel = "Upload brand context files"
  } = props;
  const inputId = useId();
  const [queue, setQueue] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelHint = useMemo(
    () => campaignLabel?.trim() || undefined,
    [campaignLabel]
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((list: FileList | File[]) => {
    const next = Array.from(list);
    if (!next.length) return;
    setQueue((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const merged = [...prev];
      for (const file of next) {
        const key = `${file.name}-${file.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      }
      return merged;
    });
    setError(null);
  }, []);

  function onDragOver(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setDragOver(true);
  }

  function onDragLeave(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setDragOver(false);
  }

  function onDrop(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setDragOver(false);
    if (ev.dataTransfer?.files?.length) {
      addFiles(ev.dataTransfer.files);
    }
  }

  async function handleUpload() {
    if (!queue.length || busy) return;
    setBusy(true);
    setError(null);

    try {
      const result = await ingestNiaBrandFiles(queue, labelHint);
      const newIds = result.indexed.map((item) => item.sourceId).filter(Boolean);
      if (newIds.length) {
        onIndexedSourceIdsChange((prev) => [...prev, ...newIds]);
      }

      const indexedNames = new Set(result.indexed.map((i) => i.filename));
      setQueue((prev) => prev.filter((f) => !indexedNames.has(f.name)));

      if (result.errors.length && !newIds.length) {
        const first = result.errors[0];
        setError(`${first.filename}: ${first.message}`);
      } else if (result.errors.length) {
        const msg = result.errors.map((e) => `${e.filename}: ${e.message}`).join(" · ");
        setError(`Some files failed: ${msg}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function removeQueued(name: string, size: number) {
    setQueue((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  }

  function removeIndexed(id: string) {
    onIndexedSourceIdsChange((prev) => prev.filter((x) => x !== id));
  }

  return (
    <div className="space-y-3.5">
      <div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>

      <label htmlFor={inputId} className="sr-only">
        {fileInputLabel}
      </label>
      <input
        ref={inputRef}
        multiple
        id={inputId}
        type="file"
        accept=".pdf,.csv,.tsv,.xlsx,.xls,.txt,.md,.json,.html,.yaml,.yml,text/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        role="presentation"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`${dropOuterClass} ${dragOver ? "border-zinc-400 bg-stone-50 dark:border-zinc-500 dark:bg-zinc-800" : ""}`}
      >
        <span className="text-xl">📎</span>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Drag files here or{" "}
          <button
            type="button"
            className="text-zinc-900 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-200 dark:hover:text-zinc-400"
            onClick={() => inputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="max-w-sm text-xs text-zinc-400 dark:text-zinc-500">
          PDF, CSV/TSV, Excel, Markdown, TXT, JSON — max 25 MB per file, 20 files per batch.
        </p>
      </div>

      {queue.length > 0 ? (
        <ul className="space-y-2 rounded-lg border border-stone-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {queue.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex flex-wrap items-center justify-between gap-2 text-zinc-800 dark:text-zinc-200"
            >
              <span className="truncate text-sm">{file.name}</span>
              <button
                type="button"
                className="shrink-0 text-xs text-zinc-400 hover:text-red-600 transition dark:text-zinc-500 dark:hover:text-red-400"
                onClick={() => removeQueued(file.name, file.size)}
              >
                Remove
              </button>
            </li>
          ))}
          <li className="pt-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleUpload()}
              className="inline-flex rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {busy ? "Indexing…" : "Index files"}
            </button>
          </li>
        </ul>
      ) : null}

      {indexedSourceIds.length > 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide dark:text-emerald-400">
            Indexed & linked ({indexedSourceIds.length})
          </p>
          <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-300/70">
            These sources will be sent with the campaign for AI retrieval.
          </p>
          <ul className="mt-2.5 space-y-2 font-mono text-[11px] text-emerald-900 dark:text-emerald-200/80">
            {indexedSourceIds.map((id) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="max-w-[min(100%,20rem)] truncate" title={id}>
                  {id}
                </span>
                <button
                  type="button"
                  className="shrink-0 font-sans text-xs text-emerald-700 hover:text-red-600 transition dark:text-emerald-400 dark:hover:text-red-400"
                  onClick={() => removeIndexed(id)}
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
