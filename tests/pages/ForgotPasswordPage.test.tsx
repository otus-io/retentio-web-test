import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";

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

function renderForgot() {
  return render(
    <MemoryRouter
      initialEntries={["/forgot-password"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/reset-password" element={<p>Reset page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => mockFetch.mockReset());

  it("renders the forgot password form", () => {
    renderForgot();
    expect(screen.getByText("Forgot password")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it("posts email to /auth/forgot-password", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { msg: "If the email exists, a reset link has been sent" }, meta: null })
    );
    renderForgot();
    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalled();
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/auth/forgot-password");
    expect(JSON.parse(init.body)).toEqual({ email: "user@example.com" });
  });
});
