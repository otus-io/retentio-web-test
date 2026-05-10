import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { request, type AddFactOperation, type CreateDeckReq, type CreateDeckRes } from "@/lib/api";
import { parseExportBundleFromZip, type ParsedExportBundle } from "@/lib/exportBundleZip";
import { importExportBundleIntoDeck } from "@/lib/importExportBundle";
import { parseExportMetaDeck } from "@/lib/parseExportMetaDeck";

type Phase = "idle" | "creating-deck" | "uploading-media" | "posting-facts";

export default function UploadDeckPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedExportBundle | null>(null);
  const [deckFromMeta, setDeckFromMeta] = useState<ReturnType<typeof parseExportMetaDeck> | null>(null);
  const [parseError, setParseError] = useState("");
  const [addOp, setAddOp] = useState<AddFactOperation>("append");

  const [phase, setPhase] = useState<Phase>("idle");
  const [mediaDone, setMediaDone] = useState(0);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [factBatchLabel, setFactBatchLabel] = useState("");
  const [runError, setRunError] = useState("");

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handlePickZip(f: File | null) {
    setFile(f);
    setParsed(null);
    setDeckFromMeta(null);
    setParseError("");
    setRunError("");
    setPhase("idle");
    setMediaDone(0);
    setMediaTotal(0);
    setFactBatchLabel("");
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const p = await parseExportBundleFromZip(zip);
      const deck = parseExportMetaDeck(p.exportMeta);
      setParsed(p);
      setDeckFromMeta(deck);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setParseError(msg);
    }
  }

  async function handleImportAll() {
    if (!token || !file || !parsed || !deckFromMeta) return;
    setRunError("");
    setPhase("creating-deck");
    setMediaDone(0);
    setMediaTotal(0);
    setFactBatchLabel("");

    try {
      const body: CreateDeckReq = {
        name: deckFromMeta.name,
        fields: deckFromMeta.fields,
        rate: deckFromMeta.rate,
      };
      const createRes = await request<CreateDeckRes>("/api/decks", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      const deckId = createRes.data.deck_id;

      const buf = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);

      setPhase("uploading-media");
      await importExportBundleIntoDeck(token, deckId, parsed, zip, addOp, {
        onMediaProgress: (done, total) => {
          setMediaTotal(total);
          setMediaDone(done);
        },
        onFactBatch: (label) => {
          setPhase("posting-facts");
          setFactBatchLabel(label);
        },
      });

      navigate(`/decks/${deckId}`, { replace: true });
    } catch (e) {
      setPhase("idle");
      setRunError(e instanceof Error ? e.message : String(e));
    }
  }

  const busy = phase === "creating-deck" || phase === "uploading-media" || phase === "posting-facts";
  const meta = parsed?.exportMeta as { model?: string; facts_written?: number; media_files?: number } | undefined;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Upload deck</h1>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              to="/decks"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Deck
            </Link>
            <Link
              to="/profile"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Profile
            </Link>
            <Button variant="outline" onClick={() => void handleLogout()}>
              Logout
            </Button>
          </nav>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Anki export bundle (ZIP)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Zip the folder produced by{" "}
              <code className="text-xs bg-muted px-1 rounded">anki_export_retentio_facts.py</code> (same layout as bulk
              upload): <code className="text-xs bg-muted px-1 rounded">export_meta.json</code> must include a{" "}
              <code className="text-xs bg-muted px-1 rounded">deck</code> object with{" "}
              <code className="text-xs bg-muted px-1 rounded">name</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">fields</code>, and{" "}
              <code className="text-xs bg-muted px-1 rounded">rate</code> — the app creates the deck from that, then
              imports <code className="text-xs bg-muted px-1 rounded">facts.jsonl</code> (or{" "}
              <code className="text-xs bg-muted px-1 rounded">facts.json</code>),{" "}
              <code className="text-xs bg-muted px-1 rounded">media_manifest.json</code>, and{" "}
              <code className="text-xs bg-muted px-1 rounded">media/</code> from the archive.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ZIP file</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <Label htmlFor="new-deck-zip">Bundle</Label>
              <Input
                id="new-deck-zip"
                type="file"
                accept=".zip,application/zip"
                disabled={busy}
                onChange={(e) => void handlePickZip(e.target.files?.[0] ?? null)}
              />
            </div>

            {parseError && <p className="text-sm text-destructive">{parseError}</p>}

            {parsed && deckFromMeta && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-xs font-mono">
                <p>Facts: {parsed.facts.length}</p>
                <p>Media entries: {Object.keys(parsed.manifest).length}</p>
                {meta?.model != null && <p>export_meta.model: {String(meta.model)}</p>}
                {meta?.facts_written != null && <p>export_meta.facts_written: {meta.facts_written}</p>}
                {meta?.media_files != null && <p>export_meta.media_files: {meta.media_files}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="add-op-new">Where to add facts</Label>
              <select
                id="add-op-new"
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

            {phase === "creating-deck" && <p className="text-sm text-muted-foreground">Creating deck…</p>}
            {phase === "uploading-media" && mediaTotal > 0 && (
              <p className="text-sm text-muted-foreground">
                Uploading media {mediaDone} / {mediaTotal}…
              </p>
            )}
            {phase === "posting-facts" && factBatchLabel && (
              <p className="text-sm text-muted-foreground">Posting facts — {factBatchLabel}</p>
            )}

            {runError && <p className="text-sm text-destructive">{runError}</p>}

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!parsed || !deckFromMeta || !token || busy} onClick={() => void handleImportAll()}>
                {busy ? "Working…" : "Create deck and import"}
              </Button>
              <Button type="button" variant="ghost" asChild disabled={busy}>
                <Link to="/decks">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
