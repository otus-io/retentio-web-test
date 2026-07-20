import { SubmitFactContributionModal } from "./SubmitFactContributionModal";
import type { DeckItem, FactItem } from "@/lib/api";

/** @deprecated Prefer SubmitFactContributionModal with kind="report". */
export function SubmitFactReportModal(props: {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  fact: FactItem;
  token: string;
  onSubmitted: () => void | Promise<void>;
}) {
  return (
    <SubmitFactContributionModal
      open={props.open}
      onClose={props.onClose}
      deck={props.deck}
      fact={props.fact}
      kind="report"
      token={props.token}
      onSubmitted={() => props.onSubmitted()}
    />
  );
}
