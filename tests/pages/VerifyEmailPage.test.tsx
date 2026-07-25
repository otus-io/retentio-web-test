import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VerifyEmailPage from "@/pages/VerifyEmailPage";

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

function renderVerify(path: string) {
  return render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(() => mockFetch.mockReset());

  it("shows an error when token is missing", () => {
    renderVerify("/verify-email");
    expect(screen.getByText(/missing or invalid/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts token to /auth/verify-email and shows success", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ data: { msg: "Email verified successfully" }, meta: null })
    );
    renderVerify("/verify-email?token=abc");
    expect(await screen.findByText(/email verified successfully/i)).toBeInTheDocument();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/verify-email$/);
    expect(JSON.parse(init.body as string)).toEqual({ token: "abc" });
  });

  it("allows retry after failure", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce(makeResponse({ msg: "Invalid or expired verification token" }, false))
      .mockResolvedValueOnce(
        makeResponse({ data: { msg: "Email verified successfully" }, meta: null })
      );
    renderVerify("/verify-email?token=abc");
    expect(await screen.findByText(/invalid or expired/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(screen.getByText(/email verified successfully/i)).toBeInTheDocument()
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
