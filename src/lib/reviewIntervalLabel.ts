/**
 * Human-readable review interval label.
 * Matches Flutter `formatReviewIntervalLabel`
 * (`retentio-frontend/.../review_interval_label.dart`).
 */
export function formatReviewIntervalLabel(intervalSec: number): string {
  const secPerMinute = 60;
  const secPerHour = 60 * secPerMinute;
  const secPerDay = 24 * secPerHour;
  const secPerMonth = 30 * secPerDay;
  const secPerYear = 12 * secPerMonth;

  if (intervalSec < secPerMinute) {
    return `${Math.ceil(intervalSec)}s`;
  }
  if (intervalSec < secPerHour) {
    return `${Math.ceil(intervalSec / secPerMinute)}m`;
  }
  if (intervalSec < secPerDay) {
    return `${(intervalSec / secPerHour).toFixed(1)}h`;
  }
  if (intervalSec < secPerMonth) {
    return `${(intervalSec / secPerDay).toFixed(1)}d`;
  }
  if (intervalSec < secPerYear) {
    return `${(intervalSec / secPerMonth).toFixed(1)}mo`;
  }
  return `${(intervalSec / secPerYear).toFixed(1)}y`;
}
