import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DeckEditForm } from "@/components/deck";
import { useAuth } from "@/contexts/AuthContext";
import {
  request,
  type GetDeckRes,
  type UpdateDeckReq,
  type UpdateDeckRes,
} from "@/lib/api";

export default function DeckEditPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [sibling, setSibling] = useState(false);
  const [rate, setRate] = useState(20);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDeck = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError("");
    try {
      const res = await request<GetDeckRes>(`/api/decks/${id}`, { token });
      setName(res.data.name);
      setFieldNames([...res.data.field]);
      setSibling(res.data.templates.length === 2);
      setRate(res.data.rate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deck");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id) return;
    const fields = fieldNames.map((s) => s.trim()).filter(Boolean);
    const templates: number[][] = sibling ? [[0, 1], [1, 0]] : [[0, 1]];
    if (fields.length < 2) {
      setError("At least two fields required");
      return;
    }
    if (rate < 1 || rate > 1000) {
      setError("Rate must be between 1 and 1000");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const body: UpdateDeckReq = { name: name.trim() || undefined, fields, templates, rate };
      await request<UpdateDeckRes>(`/api/decks/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      navigate("/profile", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-lg mx-auto">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-4">
        <p className="text-sm">
          <Link to="/profile" className="text-primary hover:underline">← Profile</Link>
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DeckEditForm
          name={name}
          setName={setName}
          fieldNames={fieldNames}
          setFieldNames={setFieldNames}
          sibling={sibling}
          setSibling={setSibling}
          rate={rate}
          setRate={setRate}
          saving={saving}
          onSubmit={handleUpdate}
          onCancel={() => navigate("/profile")}
        />
      </div>
    </div>
  );
}
