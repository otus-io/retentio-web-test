import { request } from "./api";

/** User-owned tag (deck/fact label). */
export interface TagItem {
  id: string;
  name: string;
  description: string;
}

export interface CreateTagReq {
  name: string;
  description?: string;
}

export interface UpdateTagReq {
  name?: string;
  description?: string;
}

export interface CreateTagRes {
  data: { tag: TagItem };
  meta: { msg: string };
}

export interface ListTagsRes {
  data: { tags: TagItem[] };
  meta: { msg: string };
}

export interface GetTagRes {
  data: { tag: TagItem };
  meta: { msg: string };
}

export interface UpdateTagRes {
  data: { tag: TagItem };
  meta: { msg: string };
}

export interface DeleteTagRes {
  data: { decks_untagged: number };
  meta: { msg: string };
}

export interface TagFactRef {
  deck_id: string;
  fact_id: string;
}

export interface GetTagFactsRes {
  data: { facts: TagFactRef[] };
  meta: { msg: string };
}

export interface TagsListRes {
  data: { tags: TagItem[] };
  meta: { msg: string };
}

function enc(id: string): string {
  return encodeURIComponent(id);
}

function normalizeTagsList(tags: TagItem[] | null | undefined): TagItem[] {
  return Array.isArray(tags) ? tags : [];
}

/** POST /api/tags */
export function createTag(body: CreateTagReq, token: string): Promise<CreateTagRes> {
  return request<CreateTagRes>("/api/tags", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export type TagUsedOn = "deck" | "fact";

export interface ListTagsOptions {
  usedOn?: TagUsedOn;
  /** Required when usedOn is "fact"; optional scope when usedOn is "deck". */
  deckId?: string;
}

/** GET /api/tags — optional used_on/deck_id narrow lists for deck or fact pickers. */
export async function listTags(token: string, options?: ListTagsOptions): Promise<ListTagsRes> {
  if (options?.usedOn === "fact" && !options.deckId) {
    throw new Error("deckId is required when usedOn is fact");
  }
  const params = new URLSearchParams();
  if (options?.usedOn) params.set("used_on", options.usedOn);
  if (options?.deckId) params.set("deck_id", options.deckId);
  const query = params.toString();
  const path = `/api/tags${query ? `?${query}` : ""}`;
  const res = await request<ListTagsRes>(path, { token });
  return { ...res, data: { ...res.data, tags: normalizeTagsList(res.data?.tags) } };
}

/** GET /api/tags/{tagId} */
export function getTag(tagId: string, token: string): Promise<GetTagRes> {
  return request<GetTagRes>(`/api/tags/${enc(tagId)}`, { token });
}

/** PATCH /api/tags/{tagId} */
export function updateTag(tagId: string, body: UpdateTagReq, token: string): Promise<UpdateTagRes> {
  return request<UpdateTagRes>(`/api/tags/${enc(tagId)}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

/** DELETE /api/tags/{tagId} */
export function deleteTag(tagId: string, token: string): Promise<DeleteTagRes> {
  return request<DeleteTagRes>(`/api/tags/${enc(tagId)}`, { method: "DELETE", token });
}

/** GET /api/tags/{tagId}/facts */
export function getTagFacts(tagId: string, token: string): Promise<GetTagFactsRes> {
  return request<GetTagFactsRes>(`/api/tags/${enc(tagId)}/facts`, { token });
}

/** GET /api/decks/{deckId}/tags */
export async function getDeckTags(deckId: string, token: string): Promise<TagsListRes> {
  const res = await request<TagsListRes>(`/api/decks/${enc(deckId)}/tags`, { token });
  return { ...res, data: { ...res.data, tags: normalizeTagsList(res.data?.tags) } };
}

/** PUT /api/decks/{deckId}/tags/{tagId} */
export function addTagToDeck(deckId: string, tagId: string, token: string): Promise<TagsListRes> {
  return request<TagsListRes>(`/api/decks/${enc(deckId)}/tags/${enc(tagId)}`, {
    method: "PUT",
    token,
  });
}

/** DELETE /api/decks/{deckId}/tags/{tagId} */
export function removeTagFromDeck(deckId: string, tagId: string, token: string): Promise<TagsListRes> {
  return request<TagsListRes>(`/api/decks/${enc(deckId)}/tags/${enc(tagId)}`, {
    method: "DELETE",
    token,
  });
}

/** GET /api/decks/{deckId}/facts/{factId}/tags */
export function getFactTags(deckId: string, factId: string, token: string): Promise<TagsListRes> {
  return request<TagsListRes>(`/api/decks/${enc(deckId)}/facts/${enc(factId)}/tags`, { token });
}

/** PUT /api/decks/{deckId}/facts/{factId}/tags/{tagId} */
export function addTagToFact(
  deckId: string,
  factId: string,
  tagId: string,
  token: string
): Promise<TagsListRes> {
  return request<TagsListRes>(
    `/api/decks/${enc(deckId)}/facts/${enc(factId)}/tags/${enc(tagId)}`,
    { method: "PUT", token }
  );
}

/** DELETE /api/decks/{deckId}/facts/{factId}/tags/{tagId} */
export function removeTagFromFact(
  deckId: string,
  factId: string,
  tagId: string,
  token: string
): Promise<TagsListRes> {
  return request<TagsListRes>(
    `/api/decks/${enc(deckId)}/facts/${enc(factId)}/tags/${enc(tagId)}`,
    { method: "DELETE", token }
  );
}

/** Optional tag_id filter for study endpoints (GET next card / card stats). */
export function deckCardQueryWithTag(tagId?: string | null): string {
  const id = tagId?.trim();
  if (!id) return "";
  return `?tag_id=${enc(id)}`;
}

/** GET /api/decks/{deckId}/card — optional tag_id filters to facts with that tag. */
export function getNextCard<T>(deckId: string, token: string, tagId?: string | null): Promise<T> {
  return request<T>(`/api/decks/${enc(deckId)}/card${deckCardQueryWithTag(tagId)}`, { token });
}

/** GET /api/decks/{deckId}/cards — optional tag_id filters card list/stats. */
export function getDeckCards<T>(deckId: string, token: string, tagId?: string | null): Promise<T> {
  return request<T>(`/api/decks/${enc(deckId)}/cards${deckCardQueryWithTag(tagId)}`, { token });
}
