export const QUALIFIED_SCORE_THRESHOLD = 70;

export function isQualifiedLead(score: number): boolean {
  return score >= QUALIFIED_SCORE_THRESHOLD;
}
