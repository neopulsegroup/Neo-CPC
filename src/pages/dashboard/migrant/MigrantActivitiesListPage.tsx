import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatActivityDurationShort, formatActivityStatusListLabel } from '@/features/activities/model';
import { loadParticipantActivitiesForUser, MAX_PARTICIPANT_ACTIVITIES_QUERY_LIMIT } from '@/features/activities/participantActivityList';
import { APP_TIME_ZONE } from '@/lib/appCalendar';

type Row = {
  id: string;
  title: string;
  date: string;
  status?: string | null;
  durationMinutes?: number | null;
  startTime?: string;
  endTime?: string;
};

export default function MigrantActivitiesListPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user?.uid) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const sorted = await loadParticipantActivitiesForUser(user.uid, {
          firestoreLimit: MAX_PARTICIPANT_ACTIVITIES_QUERY_LIMIT,
          participantEmail: user.email ?? null,
        });
        if (cancelled) return;
        setRows(
          sorted.map((r) => ({
            id: r.id,
            title: r.title || 'Atividade',
            date: r.date || '',
            status: r.status ?? null,
            durationMinutes: r.durationMinutes ?? null,
            startTime: r.startTime,
            endTime: r.endTime,
          }))
        );
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.email]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t.dashboard.activities}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.get('dashboard.activities_desc')}</p>
      </div>

      <div className="cpc-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t.dashboard.activities}</h2>
          </div>
          <Link to="/dashboard/migrante" className="text-sm text-primary hover:underline">
            {t.get('dashboard.activities_back_home')}
          </Link>
        </div>

        <div className="mt-5 rounded-xl border bg-muted/30 p-6 min-h-[160px]">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rows.length ? (
            <div className="space-y-3 max-h-[min(70vh,640px)] overflow-y-auto pr-1">
              {rows.map((a) => (
                <Link
                  key={a.id}
                  to={`/dashboard/migrante/atividades/${a.id}`}
                  className="flex items-center justify-between rounded-lg bg-background/70 border px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(() => {
                        const datePart =
                          a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)
                            ? new Intl.DateTimeFormat('pt-PT', {
                                timeZone: APP_TIME_ZONE,
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              }).format(new Date(`${a.date}T12:00:00Z`))
                            : null;
                        const dur = formatActivityDurationShort(a);
                        if (datePart && dur) return `${datePart} • ${dur}`;
                        if (datePart) return datePart;
                        if (dur) return dur;
                        return '—';
                      })()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {formatActivityStatusListLabel(a.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center flex flex-col items-center justify-center min-h-[120px]">
              <div className="mx-auto h-12 w-12 rounded-full bg-background border flex items-center justify-center text-muted-foreground">
                <ClipboardList className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{t.get('dashboard.activities_empty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
