import { conversionResponseSchema, type ConversionDiagnostic } from "@arcane-table/protocol";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest, type ApiFailure } from "../../infrastructure/http.js";
import { ErrorState } from "../../presentation/states.js";

const maxBytes = 1_000_000;
const sample = {
  character: {
    attribs: [
      { current: "16", name: "strength" },
      { current: "14", name: "dexterity" },
    ],
    attributes: { name: "Sample Ranger" },
  },
};

const download = (filename: string, value: unknown): void => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const isApiFailure = (error: unknown): error is ApiFailure =>
  typeof error === "object" &&
  error !== null &&
  "ok" in error &&
  error.ok === false &&
  "status" in error &&
  "message" in error;

const grouped = (
  diagnostics: readonly ConversionDiagnostic[],
): Readonly<Record<string, readonly ConversionDiagnostic[]>> => {
  const groups: Record<string, ConversionDiagnostic[]> = {};
  for (const diagnostic of diagnostics) {
    const current = groups[diagnostic.severity] ?? [];
    current.push(diagnostic);
    groups[diagnostic.severity] = current;
  }
  return groups;
};

export const ConverterPage = (): ReactNode => {
  const [source, setSource] = useState("");
  const [strict, setStrict] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const convert = useMutation({
    mutationFn: async (body: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const result = await apiRequest(
        `/v1/conversions/roll20-foundry${strict ? "?strict=true" : ""}`,
        conversionResponseSchema,
        {
          body,
          method: "POST",
          signal: controller.signal,
        },
      );
      if (!result.ok) throw result;
      return result.data;
    },
  });
  const failure = isApiFailure(convert.error) ? convert.error : null;
  const readFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    if (file.size > maxBytes) {
      setLocalError("File exceeds the 1 MB client limit.");
      return;
    }
    if (file.type !== "" && file.type !== "application/json" && !file.name.endsWith(".json")) {
      setLocalError("Choose a JSON file.");
      return;
    }
    setLocalError(null);
    setSource(await file.text());
  };
  const parsedPreview = (() => {
    try {
      return JSON.parse(source) as unknown;
    } catch {
      return null;
    }
  })();
  const actor = convert.data?.actor;
  const items =
    actor !== undefined && "items" in actor && Array.isArray(actor.items) ? actor.items.length : 0;
  return (
    <article className="panel">
      <p className="eyebrow">Roll20 to Foundry</p>
      <h1>Character converter</h1>
      <p>
        Imports stay in this request. Biography and GM notes are not written to browser storage.
      </p>
      <div className="converter-grid">
        <section>
          <label className="dropzone">
            Drop a JSON export or choose a file
            <input
              accept="application/json,.json"
              onChange={(event) => void readFile(event.target.files?.[0])}
              type="file"
            />
          </label>
          <textarea
            aria-label="Roll20 JSON"
            onChange={(event) => setSource(event.target.value)}
            value={source}
          />
          <div className="actions">
            <button
              className="button ghost"
              onClick={() => setSource(JSON.stringify(sample, null, 2))}
              type="button"
            >
              Load sample
            </button>
            <button
              className="button ghost"
              onClick={() => {
                setSource("");
                convert.reset();
              }}
              type="button"
            >
              Clear
            </button>
            <label className="field inline">
              <input
                checked={strict}
                onChange={(event) => setStrict(event.target.checked)}
                type="checkbox"
              />{" "}
              Strict
            </label>
            <button
              className="button"
              disabled={source.trim() === "" || convert.isPending}
              onClick={() => {
                try {
                  JSON.parse(source);
                  setLocalError(null);
                  convert.mutate(source);
                } catch (error: unknown) {
                  setLocalError(error instanceof Error ? error.message : "Invalid JSON.");
                }
              }}
              type="button"
            >
              Convert
            </button>
            {convert.isPending ? (
              <button
                className="button ghost"
                onClick={() => abortRef.current?.abort()}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {localError === null ? null : <ErrorState message={localError} />}
          {failure === null ? null : (
            <section>
              <ErrorState message={failure.message} />
              {Object.entries(grouped(failure.diagnostics ?? [])).map(([severity, diagnostics]) => (
                <div key={severity}>
                  <h2>{severity}</h2>
                  <ul>
                    {diagnostics.map((diagnostic) => (
                      <li key={`${diagnostic.path ?? "root"}-${diagnostic.code}`}>
                        {diagnostic.path ?? "root"}: {diagnostic.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </section>
        <section>
          <h2>Preview</h2>
          <pre>
            {parsedPreview === null
              ? "JSON is not valid yet."
              : JSON.stringify(parsedPreview, null, 2).slice(0, 2000)}
          </pre>
          {actor === undefined ? null : (
            <>
              <p>
                Actor: {typeof actor.name === "string" ? actor.name : "Unnamed"} · items {items}
              </p>
              <div className="actions">
                <button
                  className="button"
                  onClick={() => download("actor.json", actor)}
                  type="button"
                >
                  Download actor.json
                </button>
                <button
                  className="button ghost"
                  onClick={() => download("report.json", convert.data?.report)}
                  type="button"
                >
                  Download report.json
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </article>
  );
};
