export type DashboardNotificationDoc = {
  id: string;
  recipient_id?: string | null;
  title?: string | null;
  body?: string | null;
  href?: string | null;
  type?: string | null;
  created_at?: unknown;
};

export type DashboardNotificationView = {
  id: string;
  title: string;
  body: string;
  date: string;
  type?: string;
  href?: string;
};

export function parseNotificationCreatedAtMs(created: unknown): number {
  if (!created) return 0;
  if (typeof created === 'string') {
    const parsed = Date.parse(created);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof created === 'object') {
    const value = created as { toDate?: () => Date; seconds?: number };
    if (typeof value.toDate === 'function') {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000;
  }
  return 0;
}

export function mapNotificationDoc(d: DashboardNotificationDoc): DashboardNotificationView {
  const dateMs = parseNotificationCreatedAtMs(d.created_at);
  const date = dateMs > 0 ? new Date(dateMs).toISOString() : new Date().toISOString();
  return {
    id: d.id,
    title: (d.title || 'Notificação').trim(),
    body: (d.body || '').trim(),
    date,
    type: d.type || undefined,
    href: d.href || undefined,
  };
}

export function sortDashboardNotificationsNewestFirst(
  docs: DashboardNotificationDoc[],
  limit = 20
): DashboardNotificationView[] {
  return docs
    .slice()
    .sort((a, b) => parseNotificationCreatedAtMs(b.created_at) - parseNotificationCreatedAtMs(a.created_at))
    .slice(0, limit)
    .map(mapNotificationDoc);
}
