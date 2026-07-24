/**
 * Review interval window for the study slider.
 * Matches Flutter `ReviewIntervalRange.fromTimestamps`
 * (`retentio-frontend/.../review_interval_range.dart`).
 */
export interface ReviewIntervalRange {
  minInterval: number;
  maxInterval: number;
  /** Default selected interval (def factor 2.0, clamped into [min, max]). */
  midInterval: number;
  urgency: number;
  currentIntervalSec: number;
}

const MIN_INTERVAL_SEC = 300;
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 4.0;
const DEF_FACTOR = 2.0;

const ZERO_RANGE: ReviewIntervalRange = {
  minInterval: 0,
  maxInterval: 0,
  midInterval: 0,
  urgency: 0,
  currentIntervalSec: 0,
};

/** All timestamps are Unix seconds (UTC). */
export function reviewIntervalRangeFromTimestamps(args: {
  nowSec: number;
  lastReview: number;
  dueDate: number;
}): ReviewIntervalRange {
  const { nowSec, lastReview, dueDate } = args;
  const currentIntervalSec = dueDate - lastReview;
  if (currentIntervalSec <= 0) {
    return ZERO_RANGE;
  }

  const intervalSec = Math.max(MIN_INTERVAL_SEC, currentIntervalSec);
  const urgency = (nowSec - lastReview) / intervalSec;
  const minRaw =
    urgency >= 1
      ? intervalSec * MIN_FACTOR
      : intervalSec * ((MIN_FACTOR - 1) * urgency + 1);
  const maxRaw =
    urgency >= 1
      ? intervalSec * MAX_FACTOR
      : intervalSec * ((MAX_FACTOR - 1) * urgency + 1);
  const defRaw =
    urgency >= 1
      ? intervalSec * DEF_FACTOR
      : intervalSec * ((DEF_FACTOR - 1) * urgency + 1);

  const minSec = Math.round(minRaw);
  let maxSec = Math.max(Math.round(maxRaw), minSec);
  if (maxSec <= minSec) {
    maxSec = minSec * 4;
  }
  const midSec = Math.min(maxSec, Math.max(minSec, Math.round(defRaw)));

  return {
    minInterval: minSec,
    maxInterval: maxSec,
    midInterval: midSec,
    urgency,
    currentIntervalSec,
  };
}
