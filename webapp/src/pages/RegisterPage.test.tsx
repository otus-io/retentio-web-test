import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RegisterPage from "./RegisterPage";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(body: unknown, ok = true) {
  return {
    ok,
    statusText: ok ? "OK" : "Bad Request",
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RegisterPage", () => {
  beforeEach(() => mockFetch.mockReset());

  it("renders the register form", () => {
    renderRegister();
    expect(screen.getByRole("heading", { name: /register/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("has a link to the login page", () => {
    renderRegister();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("disables the button and shows loading text while submitting", async () => {
    const user = userEvent.setup();
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();
  });

  it("shows success message after successful registration", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { username: "alice", email: "alice@example.com" }, meta: { created_at: "" } })
    );
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
  });

  it("sends username, email, and password to /auth/register", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { username: "bob", email: "bob@test.com" }, meta: { created_at: "" } })
    );
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), "bob");
    await user.type(screen.getByLabelText(/email/i), "bob@test.com");
    await user.type(screen.getByLabelText(/password/i), "mypassword");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/register$/);
    expect(JSON.parse(init.body as string)).toEqual({
      username: "bob",
      email: "bob@test.com",
      password: "mypassword",
    });
  });

  it("shows an error message when registration fails", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(makeResponse({ msg: "Username already taken" }, false));
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("Username already taken")).toBeInTheDocument();
  });
});
