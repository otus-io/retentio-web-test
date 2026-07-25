import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      const token = res.data.reset_token?.trim();
      setDevToken(token || null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/80 bg-card/95 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="text-xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
        >
          Retentio
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </nav>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Forgot password</CardTitle>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  If an account exists for that email, a reset link has been sent.
                </p>
                {devToken && (
                  <p className="text-sm">
                    Dev token available.{" "}
                    <Link
                      to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                      className="text-primary underline"
                    >
                      Continue to reset password
                    </Link>
                  </p>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  <Link to="/login" className="text-primary underline">
                    Back to sign in
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="text-sm text-destructive">{error}</p>}
                <p className="text-sm text-muted-foreground">
                  Enter your account email and we will send a reset link.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  <Link to="/login" className="text-primary underline">
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
