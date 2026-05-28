import { Scale, Home, Briefcase, Languages, HeartHandshake, LifeBuoy, ClipboardCheck, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { NeedsProfile, NeedCategory, NeedPriority } from './inferNeedsProfile';

const CATEGORY_ICON: Record<NeedCategory, LucideIcon> = {
  legal: Scale,
  housing: Home,
  employment: Briefcase,
  language: Languages,
  psychological: HeartHandshake,
  social: LifeBuoy,
};

function priorityBadgeClass(priority: NeedPriority): string {
  if (priority === 'high') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (priority === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export function NeedsProfileCard({ profile }: { profile: NeedsProfile }) {
  const { t } = useLanguage();

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          {t.get('needs.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {profile.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.get('needs.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {profile.items.map((item) => {
              const Icon = CATEGORY_ICON[item.category];
              return (
                <li key={item.category} className="flex items-start gap-3 rounded-2xl border bg-card p-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{t.get(`needs.category.${item.category}`)}</span>
                      <Badge variant="outline" className={priorityBadgeClass(item.priority)}>
                        {t.get(`needs.priority.${item.priority}`)}
                      </Badge>
                    </div>
                    {item.reasons.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {item.reasons.map((reason) => (
                          <li key={reason} className="text-xs text-muted-foreground">
                            {t.get(reason)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default NeedsProfileCard;
