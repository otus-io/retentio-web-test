import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmitFactContributionModal } from "@/components/deck/SubmitFactContributionModal";
import type { DeckItem, FactItem } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    submitFactReport: vi.fn(),
    submitFactEditContribution: vi.fn(),
    submitFactAddContribution: vi.fn(),
  };
});

import {
  submitFactAddContribution,
  submitFactEditContribution,
  submitFactReport,
} from "@/lib/api";

const mockSubmitFactReport = vi.mocked(submitFactReport);
const mockSubmitFactEdit = vi.mocked(submitFactEditContribution);
const mockSubmitFactAdd = vi.mocked(submitFactAddContribution);

const deck: DeckItem = {
  id: "imp1",
  name: "Import",
  owner: "bob",
  fields: ["Front", "Back"],
  rate: 10,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  source_deck_id: "src1",
};

const fact: FactItem = {
  id: "fact1",
  entries: [{ text: "Apple" }, { text: "蘋果" }],
};

describe("SubmitFactContributionModal", () => {
  beforeEach(() => {
    mockSubmitFactReport.mockReset();
    mockSubmitFactEdit.mockReset();
    mockSubmitFactAdd.mockReset();
  });

  it("passes report message and contribution id to onSubmitted before onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmitted = vi.fn().mockResolvedValue(undefined);
    mockSubmitFactReport.mockResolvedValue({
      data: {
        contribution_id: "c-report-9",
        source_deck_id: "src1",
        fact_id: "fact1",
        type: "report",
        status: "open",
      },
      meta: { msg: "ok" },
    });

    render(
      <SubmitFactContributionModal
        open
        onClose={onClose}
        deck={deck}
        fact={fact}
        kind="report"
        token="t"
        onSubmitted={onSubmitted}
      />
    );

    await user.type(screen.getByLabelText(/^Message/), "typo on the back");
    await user.click(screen.getByRole("button", { name: "Send report" }));

    await waitFor(() => {
      expect(onSubmitted).toHaveBeenCalledWith("report", {
        contributionId: "c-report-9",
        message: "typo on the back",
      });
    });
    expect(onClose).toHaveBeenCalled();
    expect(onSubmitted.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0]!
    );
  });
});
