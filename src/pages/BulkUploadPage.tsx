import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { request, type AddFactOperation, type DeckItem, type GetDeckRes } from "@/lib/api";
import { parseExportBundleFromZip, type ParsedExportBundle } from "@/lib/exportBundleZip";
import { importExportBundleIntoDeck } from "@/lib/importExportBundle";

export default function BulkUploadPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [deck, setDeck] = useState<DeckItem | null>(null);
  const [loadError, setLoadError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedExportBundle | null>(null);
  const [parseError, setParseError] = useState("");
  const [addOp, setAddOp] = useState<AddFactOperation>("append");

  const [phase, setPhase] = useState<"idle" | "uploading-media" | "posting-facts" | "done">("idle");
  const [mediaDone, setMediaDone] = useState(0);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [factBatchLabel, setFactBatchLabel] = useState("");
  const [runError, setRunError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchDeck = useCallback(async () => {
    if (!token || !id) return;
    setLoadError("");
    try {
      const res = await request<GetDeckRes>(`/api/decks/${id}`, { token });
      setDeck(res.data);
    } catch (e) {
      setDeck(null);
      setLoadError(e instanceof Error ? e.message : "Failed to load deck");
    }
  }, [token, id]);

  useEffect(() => {
    void fetchDeck();
  }, [fetchDeck]);

  async function handlePickZip(f: File | null) {
    setFile(f);
    setParsed(null);
    setParseError("");
    setRunError("");
    setSuccess("");
    setPhase("idle");
    setMediaDone(0);
    setMediaTotal(0);
    setFactBatchLabel("");
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const p = await parseExportBundleFromZip(zip);
      setParsed(p);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleImport() {
    if (!token || !id || !file || !parsed) return;
    setRunError("");
    setSuccess("");
    setPhase("uploading-media");
    setMediaDone(0);
    setMediaTotal(0);
    setFactBatchLabel("");

    try {
      const buf = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);

      const { factCount, mediaCount } = await importExportBundleIntoDeck(token, id, parsed, zip, addOp, {
        onMediaProgress: (done, total) => {
          setMediaTotal(total);
          setMediaDone(done);
        },
        onFactBatch: (label) => {
          setPhase("posting-facts");
          setFactBatchLabel(label);
        },
      });

      setPhase("done");
      setSuccess(`Imported ${factCount} fact(s) and ${mediaCount} media file(s). You can return to the deck to study.`);
    } catch (e) {
      setPhase("idle");
      setRunError(e instanceof Error ? e.message : String(e));
    }
  }

  const busy = phase === "uploading-media" || phase === "posting-facts";
  const meta = parsed?.exportMeta as { model?: string; facts_written?: number; media_files?: number } | undefined;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Upload{deck?.name ? ` — ${deck.name}` : ""}</h1>
          {id && (
            <Button variant="outline" asChild>
              <Link to={`/decks/${id}`}>Back to deck</Link>
            </Button>
          )}
        </div>

        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export bundle (ZIP)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground leading-relaxed">
              Use the same layout as <code className="text-xs bg-muted px-1 rounded">anki_export_retentio_facts.py</code>:
              <code className="text-xs bg-muted px-1 rounded">export_meta.json</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">media_manifest.json</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">facts.jsonl</code> (or <code className="text-xs bg-muted px-1 rounded">facts.json</code>
              ), and a <code className="text-xs bg-muted px-1 rounded">media/</code> folder. You may zip the contents of{" "}
              <code className="text-xs bg-muted px-1 rounded">export/</code> or the folder itself.
            </p>

            <div className="space-y-2">
              <Label htmlFor="bundle-zip">ZIP file</Label>
              <Input
                id="bundle-zip"
                type="file"
                accept=".zip,application/zip"
                disabled={busy}
                onChange={(e) => void handlePickZip(e.target.files?.[0] ?? null)}
              />
            </div>

            {parseError && <p className="text-sm text-destructive">{parseError}</p>}

            {parsed && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-xs font-mono">
                <p>Facts: {parsed.facts.length}</p>
                <p>Media entries: {Object.keys(parsed.manifest).length}</p>
                {meta?.model != null && <p>export_meta.model: {String(meta.model)}</p>}
                {meta?.facts_written != null && <p>export_meta.facts_written: {meta.facts_written}</p>}
                {meta?.media_files != null && <p>export_meta.media_files: {meta.media_files}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="add-op">Where to add facts</Label>
              <select
                id="add-op"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={addOp}
                disabled={busy}
                onChange={(e) => setAddOp(e.target.value as AddFactOperation)}
              >
                <option value="append">append</option>
                <option value="prepend">prepend</option>
                <option value="shuffle">shuffle</option>
                <option value="spread">spread</option>
              </select>
            </div>

            {phase === "uploading-media" && mediaTotal > 0 && (
              <p className="text-sm text-muted-foreground">
                Uploading media {mediaDone} / {mediaTotal}…
              </p>
            )}
            {phase === "posting-facts" && factBatchLabel && (
              <p className="text-sm text-muted-foreground">Posting facts — {factBatchLabel}</p>
            )}

            {runError && <p className="text-sm text-destructive">{runError}</p>}
            {success && <p className="text-sm text-green-600 dark:text-green-500">{success}</p>}

            <Button
              type="button"
              disabled={!parsed || !token || busy || !id}
              onClick={() => void handleImport()}
            >
              {busy ? "Importing…" : "Import into deck"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
