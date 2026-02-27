import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(body: unknown, ok = true) {
  return {
    ok,
    statusText: ok ? "OK" : "Unauthorized",
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

function TestConsumer() {
  const { token, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="token">{token ?? "null"}</p>
      <button onClick={() => login("user", "pass")}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within AuthProvider");
    spy.mockRestore();
  });

  it("starts with null token when localStorage is empty", () => {
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    expect(screen.getByTestId("token")).toHaveTextContent("null");
  });

  it("reads token from localStorage on mount", () => {
    localStorage.setItem("wordupx_token", "stored-token");
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    expect(screen.getByTestId("token")).toHaveTextContent("stored-token");
  });

  it("sets token after login and writes to localStorage", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { token: "jwt-token" }, meta: { expires: "2099" } })
    );
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await user.click(screen.getByRole("button", { name: /login/i }));
    expect(screen.getByTestId("token")).toHaveTextContent("jwt-token");
    expect(localStorage.getItem("wordupx_token")).toBe("jwt-token");
  });

  it("clears token after logout and removes from localStorage", async () => {
    const user = userEvent.setup();
    localStorage.setItem("wordupx_token", "jwt-token");
    // logout also calls /auth/logout
    mockFetch.mockResolvedValueOnce(makeResponse({ data: { msg: "ok" } }));
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    expect(screen.getByTestId("token")).toHaveTextContent("jwt-token");
    await user.click(screen.getByRole("button", { name: /logout/i }));
    expect(screen.getByTestId("token")).toHaveTextContent("null");
    expect(localStorage.getItem("wordupx_token")).toBeNull();
  });

  it("clears token locally even if logout API call fails", async () => {
    const user = userEvent.setup();
    localStorage.setItem("wordupx_token", "jwt-token");
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await user.click(screen.getByRole("button", { name: /logout/i }));
    expect(screen.getByTestId("token")).toHaveTextContent("null");
    expect(localStorage.getItem("wordupx_token")).toBeNull();
  });

  it("propagates login error", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(makeResponse({ msg: "Invalid credentials" }, false));

    let caughtError: string | null = null;
    function ErrConsumer() {
      const { login } = useAuth();
      return (
        <button
          onClick={async () => {
            try {
              await login("bad", "creds");
            } catch (e) {
              caughtError = e instanceof Error ? e.message : String(e);
            }
          }}
        >
          Login
        </button>
      );
    }
    render(<AuthProvider><ErrConsumer /></AuthProvider>);
    await user.click(screen.getByRole("button", { name: /login/i }));
    expect(caughtError).toBe("Invalid credentials");
  });
});
