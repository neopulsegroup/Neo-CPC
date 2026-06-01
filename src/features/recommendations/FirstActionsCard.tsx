import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Scale,
  HeartHandshake,
  LifeBuoy,
  FileText,
  Briefcase,
  Languages,
  Sparkles,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FirstAction, ActionPriority } from './firstActions';
import type { ServiceAreaId } from '@/features/serviceAreas/serviceAreas';

const ICONS: Record<string, LucideIcon> = {
  ClipboardList,
  Scale,
  HeartHandshake,
  LifeBuoy,
  FileText,
  Briefcase,
  Languages,
};

function priorityBadgeClass(priority: ActionPriority): string {
  if (priority === 'urgent') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (priority === 'recommended') return 'bg-sky-100 text-sky-700 border-sky-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export function FirstActionsCard({
  actions,
  onBook,
}: {
  actions: FirstAction[];
  onBook?: (area?: ServiceAreaId | null) => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (actions.length === 0) return null;

  function handleClick(action: FirstAction) {
    if (action.opensBooking) {
      onBook?.(action.area ?? null);
      return;
    }
    if (action.route) navigate(action.route);
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {t.get('firstActions.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {actions.map((action) => {
            const Icon = ICONS[action.icon] ?? Sparkles;
            return (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => handleClick(action)}
                  className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{t.get(action.titleKey)}</span>
                      <Badge variant="outline" className={priorityBadgeClass(action.priority)}>
                        {t.get(`firstActions.priority.${action.priority}`)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.get(action.descriptionKey)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export default FirstActionsCard;
