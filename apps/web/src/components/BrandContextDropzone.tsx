import type { Dispatch, DragEvent, SetStateAction } from "react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { ingestNiaBrandFiles } from "../lib/api";

type Props = {
  campaignLabel?: string;
  indexedSourceIds: string[];
  onIndexedSourceIdsChange: Dispatch<SetStateAction<string[]>>;
};

const dropOuterClass =
  "relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-10 text-center transition dark:border-slate-600 dark:bg-slate-900/40";

export function BrandContextDropzone(props: Props) {
  const { campaignLabel, indexedSourceIds, onIndexedSourceIdsChange } = props;
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
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Supporting documents
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Drop PDFs, spreadsheets (Excel/CSV), or text files describing past campaigns, outcomes,
          or internal metrics. We index them into Nia so the agent can search this context alongside
          your brief.
        </p>
      </div>

      <label htmlFor={inputId} className="sr-only">
        Upload brand context files
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
        className={`${dropOuterClass} ${dragOver ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30" : ""}`}
      >
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          Drag files here or{" "}
          <button
            type="button"
            className="text-blue-600 underline decoration-blue-600/40 underline-offset-2 hover:text-blue-500 dark:text-blue-400"
            onClick={() => inputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
          PDF, CSV/TSV, Excel, Markdown, TXT, JSON (max 25&nbsp;MB per file, up to 20 files per
          batch). Word `.docx` is not accepted yet—export to PDF first.
        </p>
      </div>

      {queue.length > 0 ? (
        <ul className="space-y-2 rounded-2xl border border-slate-100 bg-white/60 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/30">
          {queue.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex flex-wrap items-center justify-between gap-2 text-slate-800 dark:text-slate-100"
            >
              <span className="truncate font-medium">{file.name}</span>
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                onClick={() => removeQueued(file.name, file.size)}
              >
                Remove
              </button>
            </li>
          ))}
          <li className="pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleUpload()}
              className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {busy ? "Indexing…" : "Index files"}
            </button>
          </li>
        </ul>
      ) : null}

      {indexedSourceIds.length > 0 ? (
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Linked to intake ({indexedSourceIds.length})
          </p>
          <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-100/85">
            These Nia sources will be sent with campaign intake for retrieval.
          </p>
          <ul className="mt-3 space-y-2 font-mono text-[11px] text-emerald-950 dark:text-emerald-50">
            {indexedSourceIds.map((id) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="max-w-[min(100%,20rem)] truncate" title={id}>
                  {id}
                </span>
                <button
                  type="button"
                  className="shrink-0 font-sans text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
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
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-50">
          {error}
        </div>
      ) : null}
    </div>
  );
}
