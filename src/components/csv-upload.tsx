"use client";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/utils/csv/parseCsv";
import { profileDataset } from "@/utils/csv/profileDataset";
import { useDataset } from "@/context/DatasetContext";

type UploadState =
  | { phase: "idle" }
  | { phase: "selected"; file: File }
  | { phase: "parsing" }
  | { phase: "error"; message: string };

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type UploadHandle = { openFilePicker: () => void };

export const CsvUpload = forwardRef<UploadHandle>(function CsvUpload(_, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const router = useRouter();
  const { setDataset, dataset, operations } = useDataset();

  useImperativeHandle(ref, () => ({
    openFilePicker: () => inputRef.current?.click(),
  }));

  function selectFile(candidate: File | undefined) {
    if (!candidate) return;
    if (!/\.(csv|xls|xlsx)$/i.test(candidate.name)) {
      setState({ phase: "error", message: "Choose a CSV, XLS, or XLSX file." });
      return;
    }
    // If a dataset is already loaded, require confirmation before replacing
    if (dataset !== null) {
      setPendingFile(candidate);
      return;
    }
    setState({ phase: "selected", file: candidate });
  }

  async function parseAndLoad(file: File) {
    setState({ phase: "parsing" });

    const result = await parseCsv(file);

    if (!result.ok) {
      setState({ phase: "error", message: result.error });
      return;
    }

    const profile = profileDataset(result.dataset);
    setDataset(result.dataset, profile);
    router.push("/datasets/preview");
  }

  async function handleContinue() {
    if (state.phase !== "selected") return;
    await parseAndLoad(state.file);
  }

  function reset() {
    setState({ phase: "idle" });
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function cancelPending() {
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function confirmPending() {
    if (!pendingFile) return;
    const file = pendingFile;
    setPendingFile(null);
    await parseAndLoad(file);
  }

  const selectedFile =
    state.phase === "selected" ? state.file : null;

  return (
    <section
      className="border border-border bg-surface p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-4"
      aria-labelledby="upload-heading"
    >
      <div className="flex items-center justify-between border-b border-border px-2 pb-3">
        <div>
          <p id="upload-heading" className="text-sm font-medium">
            New dataset
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Data workspace</p>
        </div>
        <span className="font-mono text-xs text-muted-foreground">CSV · XLS · XLSX</span>
      </div>

      {/* Inline confirmation banner when a file is pending and a dataset is loaded */}
      {pendingFile && dataset && (
        <div className="mt-3 rounded-sm border border-warning/40 bg-warning/5 px-3 py-3">
          <p className="text-sm font-medium text-foreground">
            Replace your current workspace with{" "}
            <span className="font-semibold">{pendingFile.name}</span>?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your current dataset ({dataset.name}) and{" "}
            {operations.length} cleaning operation{operations.length !== 1 ? "s" : ""} will be replaced.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={cancelPending} className="button-secondary text-xs min-h-0 px-3 py-1.5">
              Cancel
            </button>
            <button onClick={confirmPending} className="button-primary text-xs min-h-0 px-3 py-1.5">
              Continue
            </button>
          </div>
        </div>
      )}

      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          selectFile(e.dataTransfer.files[0]);
        }}
        className={`mt-3 grid min-h-80 place-items-center border border-dashed p-6 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border bg-surface-elevated/50"
        }`}
      >
        {state.phase === "parsing" ? (
          <div className="flex flex-col items-center gap-4">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">Preparing your dataset…</p>
          </div>
        ) : selectedFile ? (
          <div className="w-full max-w-xs">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-xl text-success">
              ✓
            </div>
            <p className="mt-5 truncate text-base font-medium">{selectedFile.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedFile.name.split(".").pop()?.toUpperCase() ?? "FILE"}{" "}
              <span aria-hidden>•</span> {formatSize(selectedFile.size)}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button onClick={reset} className="button-secondary">
                Remove
              </button>
              <button onClick={handleContinue} className="button-primary">
                Continue <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex max-w-xs flex-col items-center gap-5">
            <div className="grid h-14 w-14 place-items-center border border-dashed border-border text-2xl text-muted-foreground">
              ↑
            </div>
            <div>
              <p className="text-sm font-medium">Drop a data file here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                or{" "}
                <button
                  className="text-primary underline underline-offset-2 hover:no-underline"
                  onClick={() => inputRef.current?.click()}
                >
                  browse your files
                </button>
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => selectFile(e.target.files?.[0])}
              aria-label="Select a CSV or Excel file"
            />
          </div>
        )}
      </div>

      {state.phase === "error" && (
        <p
          role="alert"
          className="mt-3 px-2 text-xs text-danger"
        >
          {state.message}
        </p>
      )}
    </section>
  );
});
