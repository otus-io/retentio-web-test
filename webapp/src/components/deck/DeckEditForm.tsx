import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface DeckEditFormProps {
  name: string;
  setName: (v: string) => void;
  fieldsStr: string;
  setFieldsStr: (v: string) => void;
  sibling: boolean;
  setSibling: (v: boolean) => void;
  rate: number;
  setRate: (v: number) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function DeckEditForm({
  name,
  setName,
  fieldsStr,
  setFieldsStr,
  sibling,
  setSibling,
  rate,
  setRate,
  saving,
  onSubmit,
  onCancel,
}: DeckEditFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit deck</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fields">Fields (comma-separated, at least 2)</Label>
            <Input
              id="fields"
              value={fieldsStr}
              onChange={(e) => setFieldsStr(e.target.value)}
              placeholder="English, Chinese"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="edit-sibling"
              type="checkbox"
              checked={sibling}
              onChange={(e) => setSibling(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="edit-sibling" className="font-normal cursor-pointer">
              Sibling
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate">Rate (1–1000)</Label>
            <Input
              id="rate"
              type="number"
              min={1}
              max={1000}
              value={rate}
              onChange={(e) => setRate(parseInt(e.target.value, 10) || 20)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
