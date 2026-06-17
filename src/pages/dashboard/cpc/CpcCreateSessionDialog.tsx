import { useEffect, useId, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { addDocument, getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CATEGORY_SERVICE_ID,
  CATEGORY_SESSION_TYPE,
  loadCpcTeamSpecialists,
  type AgendaCategory,
  type CpcSpecialistOption,
} from '@/lib/cpcSpecialists';
import { notifyMigrantSessionScheduled } from '@/lib/migrantSessionNotifications';
import { Loader2 } from 'lucide-react';

type MigrantOption = { id: string; name: string };

type CreatedSessionPayload = {
  id: string;
  migrantId: string;
  personName: string;
  category: AgendaCategory;
  serviceLabel: string;
  specialistId: string | null;
  specialistName: string | null;
  dateIso: string;
  timeLabel: string;
};

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let minutes = 8 * 60; minutes < 19 * 60; minutes += 30) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
})();

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDateIso: string;
  onCreated: (session: CreatedSessionPayload) => void;
};

export default function CpcCreateSessionDialog({ open, onOpenChange, defaultDateIso, onCreated }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const migrantListboxId = useId();
  const [migrants, setMigrants] = useState<MigrantOption[]>([]);
  const [loadingMigrants, setLoadingMigrants] = useState(false);
  const [migrantSearch, setMigrantSearch] = useState('');
  const [migrantOpen, setMigrantOpen] = useState(false);
  const [category, setCategory] = useState<AgendaCategory>('legal');
  const [migrantId, setMigrantId] = useState('');
  const [specialistId, setSpecialistId] = useState('');
  const [specialists, setSpecialists] = useState<CpcSpecialistOption[]>([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);
  const [dateIso, setDateIso] = useState(defaultDateIso);
  const [timeLabel, setTimeLabel] = useState('09:00');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDateIso(defaultDateIso);
  }, [open, defaultDateIso]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingMigrants(true);
      try {
        const users = await queryDocuments<{ id: string; name?: string | null }>('users', [
          { field: 'role', operator: 'in', value: ['migrant', 'Migrant', 'MIGRANT'] },
        ]);
        const ids = (users ?? []).map((u) => u.id);
        const profiles = await Promise.all(
          ids.map((id) => getDocument<{ name?: string | null }>('profiles', id).catch(() => null))
        );
        const options = ids
          .map((id, index) => ({
            id,
            name: (profiles[index]?.name?.trim() || users[index]?.name?.trim() || '').toString(),
          }))
          .filter((m) => m.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
        if (!cancelled) setMigrants(options);
      } catch (error) {
        console.error('Erro ao carregar migrantes', error);
        if (!cancelled) setMigrants([]);
      } finally {
        if (!cancelled) setLoadingMigrants(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || category === 'collective') {
      setSpecialists([]);
      setSpecialistId('');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSpecialists(true);
      try {
        const rows = await loadCpcTeamSpecialists(category);
        if (!cancelled) {
          setSpecialists(rows);
          setSpecialistId((prev) => (rows.some((row) => row.id === prev) ? prev : rows[0]?.id ?? ''));
        }
      } catch (error) {
        console.error('Erro ao carregar especialistas CPC', error);
        if (!cancelled) {
          setSpecialists([]);
          setSpecialistId('');
        }
      } finally {
        if (!cancelled) setLoadingSpecialists(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, category]);

  const filteredMigrants = useMemo(() => {
    const q = migrantSearch.trim().toLowerCase();
    const matches = q ? migrants.filter((m) => m.name.toLowerCase().includes(q)) : migrants;
    return matches.slice(0, 12);
  }, [migrants, migrantSearch]);

  const selectedMigrant = useMemo(() => migrants.find((m) => m.id === migrantId) ?? null, [migrants, migrantId]);

  const showMigrantSuggestions = migrantOpen && !loadingMigrants && filteredMigrants.length > 0;
  const showMigrantEmpty = migrantOpen && !loadingMigrants && migrantSearch.trim().length > 0 && filteredMigrants.length === 0;

  function selectMigrant(migrant: MigrantOption) {
    setMigrantId(migrant.id);
    setMigrantSearch(migrant.name);
    setMigrantOpen(false);
  }

  function resetForm() {
    setMigrantSearch('');
    setMigrantOpen(false);
    setCategory('legal');
    setMigrantId('');
    setSpecialistId('');
    setDateIso(defaultDateIso);
    setTimeLabel('09:00');
  }

  async function handleSubmit() {
    if (!migrantId || !dateIso || !timeLabel) {
      toast({ title: t.get('cpc.agenda.create.validation'), variant: 'destructive' });
      return;
    }
    if (category !== 'collective' && !specialistId) {
      toast({ title: t.get('cpc.agenda.create.validation'), variant: 'destructive' });
      return;
    }

    const migrant = migrants.find((m) => m.id === migrantId);
    const specialist = specialists.find((s) => s.id === specialistId) ?? null;
    const serviceLabel = t.get(`cpc.agenda.sessionTypes.${category}`);

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        migrant_id: migrantId,
        session_type: CATEGORY_SESSION_TYPE[category],
        scheduled_date: dateIso,
        scheduled_time: timeLabel,
        status: 'Agendada',
        service_label: serviceLabel,
        requested_by: 'cpc',
        created_by: user?.uid ?? null,
      };
      if (category !== 'collective') {
        payload.service_id = CATEGORY_SERVICE_ID[category];
        payload.specialist_id = specialist?.id ?? null;
        payload.specialist_name = specialist?.name ?? null;
        payload.consultant_uid = specialist?.id ?? null;
        payload.professional_id = specialist?.id ?? null;
      }
      const id = await addDocument('sessions', payload);
      try {
        await notifyMigrantSessionScheduled({
          migrantId,
          sessionId: id,
          serviceLabel,
          scheduledDateIso: dateIso,
          scheduledTime: timeLabel,
          specialistName: specialist?.name ?? null,
          createdBy: user?.uid ?? 'cpc',
        });
      } catch (notificationError) {
        console.error('Erro ao notificar migrante sobre nova sessão', notificationError);
      }
      onCreated({
        id,
        migrantId,
        personName: migrant?.name ?? '',
        category,
        serviceLabel,
        specialistId: specialist?.id ?? null,
        specialistName: specialist?.name ?? null,
        dateIso,
        timeLabel,
      });
      toast({ title: t.get('cpc.agenda.create.success') });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao criar sessão', error);
      toast({ title: t.get('cpc.agenda.create.error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.get('cpc.agenda.create.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cpc-session-category">{t.get('cpc.agenda.create.category')}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as AgendaCategory)}>
              <SelectTrigger id="cpc-session-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10050]" position="popper">
                <SelectItem value="legal">{t.get('cpc.agenda.sessionTypes.legal')}</SelectItem>
                <SelectItem value="psychology">{t.get('cpc.agenda.sessionTypes.psychology')}</SelectItem>
                <SelectItem value="mediation">{t.get('cpc.agenda.sessionTypes.mediation')}</SelectItem>
                <SelectItem value="collective">{t.get('cpc.agenda.sessionTypes.collective')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpc-session-migrant-search">{t.get('cpc.agenda.create.migrant')}</Label>
            <div className="relative">
              <Input
                id="cpc-session-migrant-search"
                autoComplete="off"
                value={migrantSearch}
                placeholder={
                  loadingMigrants ? t.get('cpc.agenda.create.loadingMigrants') : t.get('cpc.agenda.create.migrantSearch')
                }
                disabled={loadingMigrants}
                role="combobox"
                aria-expanded={migrantOpen}
                aria-autocomplete="list"
                aria-controls={migrantListboxId}
                onChange={(e) => {
                  const value = e.target.value;
                  setMigrantSearch(value);
                  setMigrantOpen(true);
                  if (selectedMigrant && value !== selectedMigrant.name) {
                    setMigrantId('');
                  }
                }}
                onFocus={() => setMigrantOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setMigrantOpen(false), 180);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setMigrantOpen(false);
                    return;
                  }
                  if (e.key === 'Enter' && filteredMigrants[0]) {
                    e.preventDefault();
                    selectMigrant(filteredMigrants[0]);
                  }
                }}
              />
              {showMigrantSuggestions ? (
                <ul
                  id={migrantListboxId}
                  role="listbox"
                  className={cn(
                    'absolute z-[10050] mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover py-1 text-sm text-popover-foreground shadow-md'
                  )}
                >
                  {filteredMigrants.map((migrant) => (
                    <li key={migrant.id} role="option" aria-selected={migrant.id === migrantId}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full cursor-default select-none px-3 py-2 text-left outline-none hover:bg-accent hover:text-accent-foreground',
                          migrant.id === migrantId && 'bg-accent text-accent-foreground'
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectMigrant(migrant)}
                      >
                        {migrant.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {showMigrantEmpty ? (
                <div className="absolute z-[10050] mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
                  {t.get('cpc.agenda.create.noMigrants')}
                </div>
              ) : null}
            </div>
          </div>

          {category !== 'collective' ? (
            <div className="space-y-2">
              <Label htmlFor="cpc-session-specialist">{t.get('cpc.agenda.create.specialist')}</Label>
              <Select value={specialistId} onValueChange={setSpecialistId} disabled={loadingSpecialists}>
                <SelectTrigger id="cpc-session-specialist">
                  <SelectValue
                    placeholder={
                      loadingSpecialists
                        ? t.get('cpc.agenda.create.loadingSpecialists')
                        : specialists.length === 0
                          ? t.get('cpc.agenda.create.noSpecialists')
                          : t.get('cpc.agenda.create.specialistPlaceholder')
                    }
                  />
                </SelectTrigger>
                <SelectContent className="z-[10050]" position="popper">
                  {specialists.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      {t.get('cpc.agenda.create.noSpecialists')}
                    </SelectItem>
                  ) : (
                    specialists.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cpc-session-date">{t.get('cpc.agenda.create.date')}</Label>
              <Input id="cpc-session-date" type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpc-session-time">{t.get('cpc.agenda.create.time')}</Label>
              <Select value={timeLabel} onValueChange={setTimeLabel}>
                <SelectTrigger id="cpc-session-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10050] max-h-56" position="popper">
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t.get('cpc.agenda.create.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting || loadingMigrants || loadingSpecialists}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t.get('cpc.agenda.create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
