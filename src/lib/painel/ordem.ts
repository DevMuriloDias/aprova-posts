/** Mesma ordem que o cliente vê: data prevista (sem data por último), depois criação. */
export function ordemDePublicacao(
  a: { scheduled_for: string | null; created_at: string },
  b: { scheduled_for: string | null; created_at: string },
): number {
  if (a.scheduled_for && b.scheduled_for && a.scheduled_for !== b.scheduled_for) {
    return a.scheduled_for.localeCompare(b.scheduled_for);
  }
  if (a.scheduled_for && !b.scheduled_for) return -1;
  if (!a.scheduled_for && b.scheduled_for) return 1;
  return a.created_at.localeCompare(b.created_at);
}
