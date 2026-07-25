import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import LoginPage from "@/pages/LoginPage";

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

function renderLogin(initialPath = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialPath]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/decks" element={<p>Decks page</p>} />
          <Route path="/register" element={<p>Register page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("renders the sign in form", () => {
    renderLogin();
    expect(screen.getByText("Sign in", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("has a link to the register page", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute("href", "/register");
  });

  it("has a link to the forgot password page", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
  });

  it("disables the button and shows loading text while submitting", async () => {
    const user = userEvent.setup();
    // Never resolve so we stay in loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });

  it("redirects to /decks after successful login", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce(
        makeResponse({ data: { token: "tok" }, meta: { expires: "2099" } })
      )
      .mockResolvedValueOnce(
        makeResponse({ data: { username: "alice", email: "alice@example.com" } })
      );
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Decks page")).toBeInTheDocument();
  });

  it("shows an error message when login fails", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(makeResponse({ msg: "Invalid credentials" }, false));
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("redirects immediately if already logged in", async () => {
    localStorage.setItem("wordupx_token", "existing-token");
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { username: "u", email: "u@example.com" } })
    );
    renderLogin();
    expect(await screen.findByText("Decks page")).toBeInTheDocument();
  });

  it("redirects to the original 'from' location after login", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce(
        makeResponse({ data: { token: "tok" }, meta: { expires: "2099" } })
      )
      .mockResolvedValueOnce(
        makeResponse({ data: { username: "alice", email: "alice@example.com" } })
      );
    render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: { pathname: "/decks/abc" } } }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/decks/abc" element={<p>Deck page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Deck page")).toBeInTheDocument();
  });
});
