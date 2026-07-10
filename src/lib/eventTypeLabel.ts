const EVENT_TYPE_MAP: Record<string, string> = {
  Aniver: 'Aniversário',
  Casam: 'Casamento',
};

export function eventTypeLabel(val?: string): string {
  if (!val) return '—';
  return EVENT_TYPE_MAP[val] || val;
}
