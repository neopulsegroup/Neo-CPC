import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Calendar, Loader2, Plus, X } from 'lucide-react';
import type { ActivityDoc, ActivityFormat, ActivityStatus, ActivityType, ActivityUpsertInput } from '@/features/activities/model';
import { ACTIVITY_FORMATS, ACTIVITY_STATUSES, ACTIVITY_TYPES, computeDurationMinutes, formatDuration, normalizeText, toActivityFormatLabel, toActivityStatusLabel, toActivityTypeLabel } from '@/features/activities/model';
import { loadActivityForEdit, loadActivityOptions, saveActivity } from '@/features/activities/controller';
import { todayIsoAppCalendar } from '@/lib/appCalendar';

type FormValues = ActivityUpsertInput;

const formSchema = z
  .object({
    title: z.string().min(3).max(120),
    activityType: z.enum(ACTIVITY_TYPES).or(z.literal('')),
    format: z.enum(ACTIVITY_FORMATS).or(z.literal('')),
    status: z.enum(ACTIVITY_STATUSES).or(z.literal('')),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    location: z.string().min(3).max(160),
    topics: z.array(z.string().min(2)).min(1),
    consultantIds: z.array(z.string().min(1)).min(1),
    consultantNames: z.array(z.string().min(1)).min(1),
    participantMigrantIds: z.array(z.string()),
    participantCompanyIds: z.array(z.string()),
    participantConsultantIds: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    const duration = computeDurationMinutes(data.startTime, data.endTime);
    if (!duration) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A hora de fim deve ser posterior à hora de início.', path: ['endTime'] });
    }
    const totalParticipants = data.participantMigrantIds.length + data.participantCompanyIds.length + data.participantConsultantIds.length;
    if (totalParticipants === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione pelo menos um participante.', path: ['participantMigrantIds'] });
    }
  });

function toDefaults(activity?: ActivityDoc | null): FormValues {
  return {
    title: activity?.title ?? '',
    activityType: (activity?.activityType ?? '') as ActivityType | '',
    format: (activity?.format ?? '') as ActivityFormat | '',
    status: (activity?.status ?? 'rascunho') as ActivityStatus | '',
    date: activity?.date ?? todayIsoAppCalendar(),
    startTime: activity?.startTime ?? '09:00',
    endTime: activity?.endTime ?? '10:00',
    location: activity?.location ?? '',
    topics: activity?.topics ?? [],
    consultantIds: activity?.consultantIds ?? [],
    consultantNames: activity?.consultantNames ?? [],
    participantMigrantIds: activity?.participantMigrantIds ?? [],
    participantCompanyIds: activity?.participantCompanyIds ?? [],
    participantConsultantIds: activity?.participantConsultantIds ?? [],
  };
}

function uniqueStrings(values: string[]): string[] {
  const set = new Set(values.map((v) => v.trim()).filter(Boolean));
  return Array.from(set);
}

const ACTIVITY_STATUS_I18N: Record<ActivityStatus, string> = {
  rascunho: 'cpc.activities.status.draft',
  agendada: 'cpc.activities.status.scheduled',
  concluida: 'cpc.activities.status.completed',
  cancelada: 'cpc.activities.status.cancelled',
};

export default function ActivityEditorPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const activityId = params.activityId || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consultants, setConsultants] = useState<Array<{ id: string; name: string }>>([]);
  const [migrants, setMigrants] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [consultantsDialogOpen, setConsultantsDialogOpen] = useState(false);
  const [topicsInput, setTopicsInput] = useState('');
  const [migrantQuery, setMigrantQuery] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: toDefaults(null),
  });

  const values = form.watch();
  const durationMinutes = useMemo(() => computeDurationMinutes(values.startTime, values.endTime), [values.endTime, values.startTime]);
  const durationLabel = useMemo(() => formatDuration(durationMinutes), [durationMinutes]);

  const filteredMigrants = useMemo(() => {
    const q = normalizeText(migrantQuery);
    if (!q) return migrants;
    return migrants.filter((m) => normalizeText(m.name).includes(q) || normalizeText(m.email).includes(q));
  }, [migrantQuery, migrants]);

  const summaryChecklist = useMemo(() => {
    const hasTitle = values.title.trim().length >= 3;
    const hasTime = !!durationMinutes;
    const hasParticipants =
      values.participantMigrantIds.length + values.participantCompanyIds.length + values.participantConsultantIds.length > 0;
    return { hasTitle, hasTime, hasParticipants };
  }, [durationMinutes, values.participantCompanyIds.length, values.participantConsultantIds.length, values.participantMigrantIds.length, values.title]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ consultants, migrants }, activity] = await Promise.all([
          loadActivityOptions(),
          activityId ? loadActivityForEdit(activityId) : Promise.resolve(null),
        ]);
        setConsultants(consultants.map((c) => ({ id: c.id, name: c.name })));
        setMigrants(migrants);
        const defaults = toDefaults(activity);
        form.reset(defaults);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('common.error');
        toast({ title: t.get('common.error'), description: message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activityId, form, t]);

  function toggleMigrant(id: string) {
    const current = form.getValues('participantMigrantIds');
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    form.setValue('participantMigrantIds', next, { shouldValidate: true, shouldDirty: true });
  }

  function toggleConsultant(id: string) {
    const current = form.getValues('consultantIds');
    const nextIds = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const nextNames = nextIds
      .map((cid) => consultants.find((c) => c.id === cid)?.name ?? '')
      .filter(Boolean);
    form.setValue('consultantIds', nextIds, { shouldValidate: true, shouldDirty: true });
    form.setValue('consultantNames', nextNames, { shouldValidate: true, shouldDirty: true });
    const participants = form.getValues('participantConsultantIds');
    const nextParticipants = participants.includes(id) ? participants : [...participants, id];
    form.setValue('participantConsultantIds', nextParticipants, { shouldValidate: true, shouldDirty: true });
  }

  function removeConsultant(id: string) {
    const currentIds = form.getValues('consultantIds');
    const nextIds = currentIds.filter((x) => x !== id);
    const nextNames = nextIds.map((cid) => consultants.find((c) => c.id === cid)?.name ?? '').filter(Boolean);
    form.setValue('consultantIds', nextIds, { shouldValidate: true, shouldDirty: true });
    form.setValue('consultantNames', nextNames, { shouldValidate: true, shouldDirty: true });
    const currentParticipants = form.getValues('participantConsultantIds');
    form.setValue(
      'participantConsultantIds',
      currentParticipants.filter((x) => x !== id),
      { shouldValidate: true, shouldDirty: true }
    );
  }

  function addTopic(topic: string) {
    const trimmed = topic.trim();
    if (trimmed.length < 2) return;
    const next = uniqueStrings([...form.getValues('topics'), trimmed]);
    form.setValue('topics', next, { shouldValidate: true, shouldDirty: true });
    setTopicsInput('');
  }

  function removeTopic(topic: string) {
    const next = form.getValues('topics').filter((x) => x !== topic);
    form.setValue('topics', next, { shouldValidate: true, shouldDirty: true });
  }

  type SaveToastKind = 'save' | 'publish' | 'unpublish' | 'completed' | 'cancelled';

  async function persistActivity(values: FormValues, toastKind: SaveToastKind) {
    const actorId = user?.uid;
    if (!actorId) {
      toast({ title: t.get('common.error'), description: t.get('cpc.activities.errors.no_auth'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await saveActivity({ activityId, input: values, actorId });
      if (toastKind === 'publish') {
        toast({ title: t.get('cpc.activities.publish.success.title'), description: t.get('cpc.activities.publish.success.desc') });
      } else if (toastKind === 'unpublish') {
        toast({ title: t.get('cpc.activities.unpublish.success.title'), description: t.get('cpc.activities.unpublish.success.desc') });
      } else if (toastKind === 'completed') {
        toast({ title: t.get('cpc.activities.completed.success.title'), description: t.get('cpc.activities.completed.success.desc') });
      } else if (toastKind === 'cancelled') {
        toast({ title: t.get('cpc.activities.cancelled_state.success.title'), description: t.get('cpc.activities.cancelled_state.success.desc') });
      } else {
        toast({ title: t.get('cpc.activities.save.success.title'), description: t.get('cpc.activities.save.success.desc') });
      }
      navigate(`/dashboard/cpc/atividades/${result.id}`);
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = rawMessage.includes('Missing or insufficient permissions')
        ? t.get('cpc.activities.errors.permission_denied')
        : rawMessage || t.get('cpc.activities.errors.save_failed');
      toast({ title: t.get('common.error'), description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(values: FormValues) {
    await persistActivity(values, 'save');
  }

  function onPublishToggle() {
    const current = form.getValues('status');
    if (current !== 'rascunho' && current !== 'agendada') return;
    const next: ActivityStatus = current === 'rascunho' ? 'agendada' : 'rascunho';
    const toastKind: SaveToastKind = next === 'agendada' ? 'publish' : 'unpublish';
    form.setValue('status', next, { shouldValidate: true, shouldDirty: true });
    void form.handleSubmit((v) => persistActivity({ ...v, status: next }, toastKind))();
  }

  function onMarkCompleted() {
    const next: ActivityStatus = 'concluida';
    form.setValue('status', next, { shouldValidate: true, shouldDirty: true });
    void form.handleSubmit((v) => persistActivity({ ...v, status: next }, 'completed'))();
  }

  function onMarkCancelled() {
    const next: ActivityStatus = 'cancelada';
    form.setValue('status', next, { shouldValidate: true, shouldDirty: true });
    void form.handleSubmit((v) => persistActivity({ ...v, status: next }, 'cancelled'))();
  }

  const topicsSuggestions = useMemo(() => ['Emprego', 'Saúde', 'Cultura', 'Educação', 'Habitação'], []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{activityId ? t.get('cpc.activities.edit.title') : t.get('cpc.activities.new.title')}</h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.activities.editor.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link to="/dashboard/cpc/atividades">
            <Button variant="ghost" type="button">
              {t.get('common.cancel')}
            </Button>
          </Link>
          {values.status === 'rascunho' || values.status === 'agendada' ? (
            <Button type="button" variant="secondary" className="gap-2" disabled={saving} onClick={onPublishToggle}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {values.status === 'rascunho' ? t.get('cpc.activities.actions.publish') : t.get('cpc.activities.actions.unpublish')}
            </Button>
          ) : null}
          <Button type="submit" className="gap-2" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t.get('cpc.activities.actions.save')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">{t.get('cpc.activities.editor.sections.general')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t.get('cpc.activities.fields.title')}</Label>
                <Input
                  value={values.title}
                  onChange={(e) => form.setValue('title', e.target.value, { shouldValidate: true, shouldDirty: true })}
                  placeholder={t.get('cpc.activities.fields.title_placeholder')}
                  className="mt-1"
                />
                {form.formState.errors.title ? (
                  <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.title.message)}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t.get('cpc.activities.fields.type')}</Label>
                  <Select
                    value={values.activityType}
                    onValueChange={(v) => form.setValue('activityType', v as ActivityType, { shouldValidate: true, shouldDirty: true })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder={t.get('cpc.activities.fields.type_placeholder')} /></SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {toActivityTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.activityType ? (
                    <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.activityType.message)}</p>
                  ) : null}
                </div>
                <div>
                  <Label>{t.get('cpc.activities.fields.format')}</Label>
                  <Select
                    value={values.format}
                    onValueChange={(v) => form.setValue('format', v as ActivityFormat, { shouldValidate: true, shouldDirty: true })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder={t.get('cpc.activities.fields.format_placeholder')} /></SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_FORMATS.map((format) => (
                        <SelectItem key={format} value={format}>
                          {toActivityFormatLabel(format)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.format ? (
                    <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.format.message)}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>{t.get('cpc.activities.fields.status')}</Label>
                  <Select
                    value={values.status || 'rascunho'}
                    onValueChange={(v) => form.setValue('status', v as ActivityStatus, { shouldValidate: true, shouldDirty: true })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t.get('cpc.activities.fields.status_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t.get(ACTIVITY_STATUS_I18N[s])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.status ? (
                    <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.status.message)}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{t.get('cpc.activities.editor.status_quick_hint')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={saving || values.status === 'concluida'}
                      onClick={onMarkCompleted}
                    >
                      {t.get('cpc.activities.actions.mark_completed')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={saving || values.status === 'cancelada'}
                      onClick={onMarkCancelled}
                    >
                      {t.get('cpc.activities.actions.mark_cancelled')}
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label>{t.get('cpc.activities.fields.location')}</Label>
                <Input
                  value={values.location}
                  onChange={(e) => form.setValue('location', e.target.value, { shouldValidate: true, shouldDirty: true })}
                  placeholder={t.get('cpc.activities.fields.location_placeholder')}
                  className="mt-1"
                />
                {form.formState.errors.location ? (
                  <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.location.message)}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">{t.get('cpc.activities.editor.sections.schedule')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label>{t.get('cpc.activities.fields.date')}</Label>
                  <div className="relative mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="date"
                      value={values.date}
                      onChange={(e) => form.setValue('date', e.target.value, { shouldValidate: true, shouldDirty: true })}
                      className="pl-9"
                    />
                  </div>
                  {form.formState.errors.date ? (
                    <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.date.message)}</p>
                  ) : null}
                </div>
                <div>
                  <Label>{t.get('cpc.activities.fields.start_time')}</Label>
                  <Input
                    type="time"
                    value={values.startTime}
                    onChange={(e) => form.setValue('startTime', e.target.value, { shouldValidate: true, shouldDirty: true })}
                    className="mt-1"
                  />
                  {form.formState.errors.startTime ? (
                    <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.startTime.message)}</p>
                  ) : null}
                </div>
                <div>
                  <Label>{t.get('cpc.activities.fields.end_time')}</Label>
                  <Input
                    type="time"
                    value={values.endTime}
                    onChange={(e) => form.setValue('endTime', e.target.value, { shouldValidate: true, shouldDirty: true })}
                    className="mt-1"
                  />
                  {form.formState.errors.endTime ? (
                    <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.endTime.message)}</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.fields.duration')}</p>
                  <p className="font-semibold mt-1">{durationLabel}</p>
                </div>
                <div className="text-xs text-muted-foreground">{t.get('cpc.activities.fields.duration_hint')}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">{t.get('cpc.activities.editor.sections.people')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.fields.consultants')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.activities.editor.consultants_hint')}</p>
                  </div>
                  <Button type="button" variant="outline" className="gap-2" onClick={() => setConsultantsDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t.get('cpc.activities.actions.add_consultant')}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 rounded-2xl border border-dashed p-4">
                  {values.consultantIds.length === 0 ? (
                    <span className="text-sm text-muted-foreground">{t.get('cpc.activities.editor.consultants_empty')}</span>
                  ) : null}
                  {values.consultantIds.map((id) => {
                    const name = consultants.find((c) => c.id === id)?.name ?? id;
                    return (
                      <Badge key={id} variant="secondary" className="gap-2 pr-1">
                        {name}
                        <button type="button" onClick={() => removeConsultant(id)} className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-black/5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                {form.formState.errors.consultantIds ? (
                  <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.consultantIds.message)}</p>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.fields.participants')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.activities.editor.participants_hint')}</p>
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {t.get('cpc.activities.editor.selected_count', { count: values.participantMigrantIds.length })}
                  </div>
                </div>

                <div className="mt-3 rounded-3xl bg-muted/40 p-4">
                  <div className="flex items-center gap-2">
                    <Input value={migrantQuery} onChange={(e) => setMigrantQuery(e.target.value)} placeholder={t.get('cpc.activities.editor.migrants_search')} />
                  </div>
                  <div className="mt-4 space-y-2 max-h-[280px] overflow-auto pr-1">
                    {filteredMigrants.map((migrant) => {
                      const checked = values.participantMigrantIds.includes(migrant.id);
                      return (
                        <label
                          key={migrant.id}
                          className="flex items-center justify-between gap-4 rounded-2xl bg-background/70 border p-3 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{migrant.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{migrant.email}</p>
                          </div>
                          <Checkbox checked={checked} onCheckedChange={() => toggleMigrant(migrant.id)} />
                        </label>
                      );
                    })}
                    {filteredMigrants.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">{t.get('cpc.activities.editor.migrants_empty')}</div>
                    ) : null}
                  </div>
                </div>
                {form.formState.errors.participantMigrantIds ? (
                  <p className="text-sm font-medium text-destructive mt-2">{String(form.formState.errors.participantMigrantIds.message)}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">{t.get('cpc.activities.editor.sections.topics')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {topicsSuggestions.map((topic) => (
                  <Button key={topic} type="button" variant="outline" className="rounded-full h-8 px-3 text-xs" onClick={() => addTopic(topic)}>
                    {topic}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Input value={topicsInput} onChange={(e) => setTopicsInput(e.target.value)} placeholder={t.get('cpc.activities.editor.topics_placeholder')} />
                <Button type="button" variant="outline" onClick={() => addTopic(topicsInput)}>
                  {t.get('cpc.activities.editor.topics_add')}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {values.topics.length === 0 ? <span className="text-sm text-muted-foreground">—</span> : null}
                {values.topics.map((topic) => (
                  <Badge key={topic} variant="secondary" className="gap-2 pr-1">
                    {topic}
                    <button type="button" onClick={() => removeTopic(topic)} className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-black/5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {form.formState.errors.topics ? (
                <p className="text-sm font-medium text-destructive">{String(form.formState.errors.topics.message)}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-base">{t.get('cpc.activities.editor.sections.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-foreground/80">{t.get('cpc.activities.fields.status')}</span>
                <span className="font-semibold">
                  {values.status ? toActivityStatusLabel(values.status as ActivityStatus) : t.get('cpc.activities.status.draft')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-foreground/80">{t.get('cpc.activities.fields.preview')}</span>
                <span className="font-semibold">{values.date ? `${values.date} • ${values.startTime}-${values.endTime}` : '—'}</span>
              </div>

              <div className="border-t border-primary-foreground/15 pt-4">
                <p className="text-xs font-semibold tracking-widest text-primary-foreground/80">{t.get('cpc.activities.editor.checklist')}</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-primary-foreground/85">{t.get('cpc.activities.editor.checklist_title')}</span>
                    <span className="font-semibold">{summaryChecklist.hasTitle ? t.get('common.yes') : t.get('common.no')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-primary-foreground/85">{t.get('cpc.activities.editor.checklist_time')}</span>
                    <span className="font-semibold">{summaryChecklist.hasTime ? t.get('common.yes') : t.get('common.no')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-primary-foreground/85">{t.get('cpc.activities.editor.checklist_participants')}</span>
                    <span className="font-semibold">{summaryChecklist.hasParticipants ? t.get('common.yes') : t.get('common.no')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={consultantsDialogOpen} onOpenChange={setConsultantsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t.get('cpc.activities.actions.add_consultant')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[340px] overflow-auto pr-1">
            {consultants.map((c) => {
              const checked = values.consultantIds.includes(c.id);
              return (
                <label key={c.id} className="flex items-center justify-between gap-4 rounded-2xl border p-3 cursor-pointer">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.id}</p>
                  </div>
                  <Checkbox checked={checked} onCheckedChange={() => toggleConsultant(c.id)} />
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setConsultantsDialogOpen(false)}>
              {t.get('common.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

