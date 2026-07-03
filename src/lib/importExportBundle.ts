import type JSZip from "jszip";
import {
  request,
  uploadMultipart,
  validateAddFactBody,
  type AddFactOperation,
  type AddFactReq,
  type AddFactRes,
  type UploadMediaRes,
} from "@/lib/api";
import {
  mediaJobsFromBundle,
  mimeHintFromManifestKind,
  type ParsedExportBundle,
} from "@/lib/exportBundleZip";

export const DEFAULT_FACT_BATCH = 80;
export const MEDIA_CONCURRENCY = 4;

async function mapInChunks<T>(
  items: T[],
  chunkSize: number,
  fn: (item: T, globalIndex: number) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map((item, j) => fn(item, i + j)));
  }
}

export interface ImportBundleCallbacks {
  onMediaProgress?: (done: number, total: number) => void;
  onFactBatch?: (label: string) => void;
}

/**
 * Uploads manifest media then POSTs facts in batches for an existing deck.
 * Caller is responsible for creating the deck and ensuring `parsed` matches the ZIP.
 *
 * Media IDs: each manifest key is sent as multipart `client_id`. The API uses that as the
 * stored media id, so fact entries (`audio` / `image` / …) must use the same ids — no remapping.
 */
export async function importExportBundleIntoDeck(
  token: string,
  deckId: string,
  parsed: ParsedExportBundle,
  zip: JSZip,
  addOp: AddFactOperation,
  callbacks?: ImportBundleCallbacks
): Promise<{ factCount: number; mediaCount: number }> {
  const jobs = mediaJobsFromBundle(parsed.manifest, parsed.pathPrefix);
  callbacks?.onMediaProgress?.(0, jobs.length);

  let uploaded = 0;
  await mapInChunks(jobs, MEDIA_CONCURRENCY, async (job) => {
    const entry = zip.file(job.zipPath);
    if (!entry) throw new Error(`ZIP entry missing: ${job.zipPath}`);
    const blob = await entry.async("blob");
    const fromZip = blob.type && blob.type !== "application/octet-stream" ? blob.type : "";
    const hinted = mimeHintFromManifestKind(job.kind, job.filename);
    const fobj = new File([blob], job.filename, { type: fromZip || hinted || undefined });
    const form = new FormData();
    form.set("file", fobj);
    form.set("deck_id", deckId);
    const res = (await uploadMultipart("/api/media", form, token, job.clientId)) as UploadMediaRes;
    if (!res?.data?.id) throw new Error(`Upload failed for media ${job.clientId}`);
    uploaded += 1;
    callbacks?.onMediaProgress?.(uploaded, jobs.length);
  });

  const batchSize = DEFAULT_FACT_BATCH;
  const nBatches = Math.ceil(parsed.facts.length / batchSize);
  const err = validateAddFactBody({ hasFacts: true });
  if (err) throw new Error(err);

  for (let b = 0; b < nBatches; b++) {
    const offset = b * batchSize;
    const chunk = parsed.facts.slice(offset, offset + batchSize);
    callbacks?.onFactBatch?.(`batch ${b + 1} / ${nBatches} (facts ${offset + 1}–${offset + chunk.length})`);
    const body: AddFactReq = { facts: chunk };
    await request<AddFactRes>(`/api/decks/${deckId}/facts/${addOp}`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  return { factCount: parsed.facts.length, mediaCount: jobs.length };
}
