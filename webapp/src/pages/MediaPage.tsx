import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  request,
  uploadMultipart,
  type ListMediaRes,
  type MediaItem,
  type UploadMediaRes,
} from "@/lib/api";

const getBaseUrl = () =>
  (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, "") ?? "http://localhost:8080";

export default function MediaPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await request<ListMediaRes>("/api/media?limit=50&offset=0", { token });
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    e.target.value = "";
    setUploadError("");
    setUploadSuccess("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadMultipart("/api/media", formData, token) as UploadMediaRes;
      setUploadSuccess("Uploaded successfully.");
      await fetchList();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadSuccess("");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(m: MediaItem) {
    if (!token) return;
    const res = await fetch(`${getBaseUrl()}/api/media/${m.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = m.filename || m.id;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeleteError("");
    setDeleteSuccess("");
    try {
      await request(`/api/media/${id}`, { method: "DELETE", token });
      setDeleteConfirm(null);
      setDeleteSuccess("File deleted.");
      await fetchList();
    } catch (e) {
      setDeleteConfirm(null);
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleString();
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Media</h1>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/profile">Profile</Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
            {uploadSuccess && <p className="text-sm text-green-600">{uploadSuccess}</p>}
            <input
              type="file"
              accept="image/*,audio/*"
              onChange={handleUpload}
              disabled={uploading}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            {uploading && <p className="text-sm text-muted-foreground">Uploading…</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your media</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            {deleteSuccess && <p className="text-sm text-green-600">{deleteSuccess}</p>}
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground">No files yet. Upload an image or audio file above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Filename</th>
                      <th className="text-left py-2 font-medium">Type</th>
                      <th className="text-left py-2 font-medium">Size</th>
                      <th className="text-left py-2 font-medium">Created</th>
                      <th className="text-right py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2">{m.filename}</td>
                        <td className="py-2 text-muted-foreground">{m.mime}</td>
                        <td className="py-2 text-muted-foreground">{formatSize(m.size)}</td>
                        <td className="py-2 text-muted-foreground">{formatDate(m.created_at)}</td>
                        <td className="py-2 text-right space-x-2">
                          <Button
                            variant="link"
                            className="h-auto p-0 text-primary"
                            onClick={() => handleDownload(m)}
                          >
                            Download
                          </Button>
                          {deleteConfirm === m.id ? (
                            <>
                              <Button variant="destructive" onClick={() => handleDelete(m.id)}>
                                Confirm
                              </Button>
                              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setDeleteConfirm(m.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
