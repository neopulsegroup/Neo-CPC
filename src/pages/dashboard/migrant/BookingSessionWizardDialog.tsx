import { useEffect, useMemo, useState } from 'react';
import { addDocument, updateDocument } from '@/integrations/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Check, Star } from 'lucide-react';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export type BookingServiceId = 'legal' | 'psychology' | 'mediation';
export type BookingSpecialistRole = 'jurista' | 'psicologa' | 'mediador';

export type BookingServiceOption = {
  id: BookingServiceId;
  title: string;
  description: string;
  priceLabel: string;
  specialistRoles: BookingSpecialistRole[];
};

export type BookingSpecialistOption = {
  id: string;
  name: string;
  role: BookingSpecialistRole;
  languages: Array<'PT' | 'EN' | 'ES'>;
  rating: number;
  reviewCount: number;
};

export type BookingWizardStep = 1 | 2 | 3 | 4;

export type BookingWizardPreset = {
  step?: BookingWizardStep;
  serviceId?: BookingServiceId | null;
  specialistId?: string | null;
  rescheduleFromSessionId?: string | null;
};

export const BOOKING_SERVICES: BookingServiceOption[] = [
  {
    id: 'legal',
    title: 'Aconselhamento jurídico',
    description: 'Apoio sobre documentação, regularização, direitos e reagrupamento familiar.',
    priceLabel: 'Gratuito',
    specialistRoles: ['jurista'],
  },
  {
    id: 'psychology',
    title: 'Apoio psicológico',
    description: 'Sessão individual com foco em bem-estar emocional e adaptação.',
    priceLabel: 'Gratuito',
    specialistRoles: ['psicologa'],
  },
  {
    id: 'mediation',
    title: 'Mediação & integração',
    description: 'Orientação prática sobre emprego, habitação e integração no território.',
    priceLabel: 'Gratuito',
    specialistRoles: ['mediador'],
  },
];

export const BOOKING_SPECIALISTS: BookingSpecialistOption[] = [
  { id: 'spec-jur-1', name: 'Dra. Sarah Miller', role: 'jurista', languages: ['PT', 'EN'], rating: 4.9, reviewCount: 124 },
  { id: 'spec-jur-2', name: 'Dr. Amir Benali', role: 'jurista', languages: ['PT', 'ES'], rating: 4.7, reviewCount: 89 },
  { id: 'spec-psy-1', name: 'Dra. Sofia Costa', role: 'psicologa', languages: ['PT', 'EN'], rating: 4.8, reviewCount: 102 },
  { id: 'spec-psy-2', name: 'Dr. Luca Rossi', role: 'psicologa', languages: ['PT', 'ES'], rating: 4.6, reviewCount: 64 },
  { id: 'spec-med-1', name: 'Joana Pereira', role: 'mediador', languages: ['PT', 'EN', 'ES'], rating: 4.9, reviewCount: 211 },
  { id: 'spec-med-2', name: 'Miguel Santos', role: 'mediador', languages: ['PT', 'EN'], rating: 4.5, reviewCount: 57 },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0)).join('').toUpperCase();
}

function formatPtDate(date: Date) {
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatPtWeekdayShort(date: Date) {
  return date.toLocaleDateString('pt-PT', { weekday: 'short' });
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function specialistRoleLabel(role: BookingSpecialistRole) {
  if (role === 'jurista') return 'Jurista';
  if (role === 'psicologa') return 'Psicóloga';
  return 'Mediador';
}

// Horário de funcionamento: 09:00–17:00, em períodos de 30 minutos.
const BOOKING_START_HOUR = 9;
const BOOKING_END_HOUR = 17;

function buildHalfHourSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  for (let minutes = startHour * 60; minutes < endHour * 60; minutes += 30) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
}

function getAvailableTimesFor(specialistId: string, date: Date) {
  const base = buildHalfHourSlots(BOOKING_START_HOUR, BOOKING_END_HOUR);
  const seed = specialistId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const day = date.getDate();
  return base.map((time, index) => {
    const available = ((seed + day + index) % 4) !== 0;
    return { time, available };
  });
}

export function BookingServiceStep({
  services,
  value,
  onChange,
  loading,
}: {
  services: BookingServiceOption[];
  value: BookingServiceId | null;
  onChange: (next: BookingServiceId) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <RadioGroup value={value ?? ''} onValueChange={(v) => onChange(v as BookingServiceId)} className="grid gap-3 sm:grid-cols-2">
      {services.map((service) => (
        <Label
          key={service.id}
          htmlFor={`service-${service.id}`}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-colors hover:bg-slate-50',
            value === service.id ? 'border-primary ring-1 ring-primary' : 'border-slate-200',
          )}
        >
          <RadioGroupItem id={`service-${service.id}`} value={service.id} className="mt-1" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{service.title}</p>
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{service.priceLabel}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{service.description}</p>
          </div>
        </Label>
      ))}
    </RadioGroup>
  );
}

export function BookingSpecialistStep({
  specialists,
  value,
  onChange,
  loading,
}: {
  specialists: BookingSpecialistOption[];
  value: string | null;
  onChange: (next: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (specialists.length === 0) {
    return <div className="text-sm text-slate-500">Sem especialistas disponíveis para este serviço.</div>;
  }

  return (
    <RadioGroup value={value ?? ''} onValueChange={onChange} className="grid gap-3 sm:grid-cols-2">
      {specialists.map((spec) => (
        <Label
          key={spec.id}
          htmlFor={`spec-${spec.id}`}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-colors hover:bg-slate-50',
            value === spec.id ? 'border-primary ring-1 ring-primary' : 'border-slate-200',
          )}
        >
          <RadioGroupItem id={`spec-${spec.id}`} value={spec.id} className="mt-1" />
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">{getInitials(spec.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{spec.name}</p>
                  <p className="text-xs text-slate-600">{specialistRoleLabel(spec.role)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1 text-slate-700">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-semibold">{spec.rating.toFixed(1)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{spec.reviewCount} avaliações</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {spec.languages.map((lang) => (
                  <Badge key={lang} variant="secondary" className="bg-slate-100 text-slate-600">
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Label>
      ))}
    </RadioGroup>
  );
}

export function BookingDateTimeStep({
  selectedDate,
  onDateChange,
  timeValue,
  onTimeChange,
  specialistId,
  loading,
}: {
  selectedDate: Date | null;
  onDateChange: (next: Date) => void;
  timeValue: string | null;
  onTimeChange: (next: string) => void;
  specialistId: string;
  loading?: boolean;
}) {
  const times = selectedDate ? getAvailableTimesFor(specialistId, selectedDate) : [];
  const chosenDayLabel = selectedDate ? `${formatPtWeekdayShort(selectedDate)}, ${formatPtDate(selectedDate)}` : '';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-xl border bg-white">
        <UICalendar mode="single" selected={selectedDate ?? undefined} onSelect={(d) => d && onDateChange(d)} />
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Horários disponíveis</p>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        </div>
        {selectedDate ? (
          <p className="mt-1 text-xs text-slate-500">{chosenDayLabel}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Selecione uma data para ver os horários.</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {selectedDate
            ? times.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => onTimeChange(slot.time)}
                  className={cn(
                    'inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors',
                    slot.available ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300',
                    timeValue === slot.time && slot.available ? 'border-primary bg-primary text-white hover:bg-primary' : '',
                  )}
                >
                  {slot.time}
                  {timeValue === slot.time && slot.available ? <Check className="ml-2 h-4 w-4" /> : null}
                </button>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}

export function BookingConfirmationStep({
  service,
  specialist,
  date,
  time,
}: {
  service: BookingServiceOption;
  specialist: BookingSpecialistOption;
  date: Date;
  time: string;
}) {
  return (
    <div className="grid gap-4 rounded-xl border bg-white p-4 sm:p-5">
      <div className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Serviço</p>
        <p className="text-sm font-semibold text-slate-900">{service.title}</p>
        <p className="text-xs text-slate-600">{service.description}</p>
      </div>
      <div className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Especialista</p>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">{getInitials(specialist.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{specialist.name}</p>
            <p className="text-xs text-slate-600">{specialistRoleLabel(specialist.role)}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data e hora</p>
        <p className="text-sm font-semibold text-slate-900">
          {formatPtDate(date)} • {time}
        </p>
      </div>
    </div>
  );
}

export default function BookingSessionWizardDialog({
  open,
  onOpenChange,
  userId,
  preset,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  preset?: BookingWizardPreset;
  onBooked?: () => void;
}) {
  const presetStep = preset?.step ?? 1;
  const presetServiceId = preset?.serviceId ?? null;
  const presetSpecialistId = preset?.specialistId ?? null;
  const presetRescheduleId = preset?.rescheduleFromSessionId ?? null;

  const [wizardStep, setWizardStep] = useState<BookingWizardStep>(1);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardTransitionLoading, setWizardTransitionLoading] = useState(false);
  const [wizardConfirmLoading, setWizardConfirmLoading] = useState(false);
  const [serviceId, setServiceId] = useState<BookingServiceId | null>(null);
  const [specialistId, setSpecialistId] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState<Date | null>(null);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [specialistsLoading, setSpecialistsLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [rescheduleFromSessionId, setRescheduleFromSessionId] = useState<string | null>(null);

  const selectedService = useMemo(() => (serviceId ? BOOKING_SERVICES.find((s) => s.id === serviceId) ?? null : null), [serviceId]);
  const availableSpecialists = useMemo(() => {
    if (!selectedService) return [];
    return BOOKING_SPECIALISTS.filter((s) => selectedService.specialistRoles.includes(s.role));
  }, [selectedService]);
  const selectedSpecialist = useMemo(() => (specialistId ? BOOKING_SPECIALISTS.find((s) => s.id === specialistId) ?? null : null), [specialistId]);

  function resetWizard() {
    setWizardStep(1);
    setWizardError(null);
    setWizardTransitionLoading(false);
    setWizardConfirmLoading(false);
    setServiceId(null);
    setSpecialistId(null);
    setSlotDate(null);
    setSlotTime(null);
    setSpecialistsLoading(false);
    setSlotsLoading(false);
    setRescheduleFromSessionId(null);
  }

  useEffect(() => {
    if (!open) {
      resetWizard();
      return;
    }
    setWizardStep(presetStep);
    setWizardError(null);
    setWizardTransitionLoading(false);
    setWizardConfirmLoading(false);
    setServiceId(presetServiceId);
    setSpecialistId(presetSpecialistId);
    setSlotDate(null);
    setSlotTime(null);
    setSpecialistsLoading(false);
    setSlotsLoading(false);
    setRescheduleFromSessionId(presetRescheduleId);
  }, [open, presetRescheduleId, presetServiceId, presetSpecialistId, presetStep]);

  useEffect(() => {
    if (!open) return;
    setWizardError(null);
  }, [wizardStep, open]);

  useEffect(() => {
    if (!open) return;
    if (wizardStep !== 2) return;
    setSpecialistsLoading(true);
    Promise.resolve().then(() => setSpecialistsLoading(false));
  }, [open, wizardStep, serviceId]);

  useEffect(() => {
    if (!open) return;
    if (wizardStep !== 3) return;
    if (!specialistId) return;
    setSlotsLoading(true);
    Promise.resolve().then(() => setSlotsLoading(false));
  }, [open, wizardStep, specialistId]);

  function validateStep(step: BookingWizardStep) {
    if (step === 1 && !serviceId) return 'Selecione um serviço para continuar.';
    if (step === 2 && !specialistId) return 'Selecione um especialista para continuar.';
    if (step === 3 && (!slotDate || !slotTime)) return 'Selecione a data e um horário disponível.';
    return null;
  }

  async function goNext() {
    const error = validateStep(wizardStep);
    if (error) {
      setWizardError(error);
      return;
    }
    if (wizardStep === 4) return;
    setWizardTransitionLoading(true);
    await Promise.resolve();
    setWizardTransitionLoading(false);
    setWizardStep((wizardStep + 1) as BookingWizardStep);
  }

  function goBack() {
    if (wizardStep === 1) return;
    setWizardStep((wizardStep - 1) as BookingWizardStep);
  }

  async function confirmBooking() {
    if (!userId || !selectedService || !selectedSpecialist || !slotDate || !slotTime) return;
    setWizardConfirmLoading(true);
    setWizardError(null);
    try {
      if (rescheduleFromSessionId) {
        await updateDocument('sessions', rescheduleFromSessionId, { status: 'Cancelada' });
      }
      await addDocument('sessions', {
        migrant_id: userId,
        session_type: selectedSpecialist.role,
        scheduled_date: toISODate(slotDate),
        scheduled_time: slotTime,
        status: 'Agendada',
        service_id: selectedService.id,
        service_label: selectedService.title,
        specialist_id: selectedSpecialist.id,
        specialist_name: selectedSpecialist.name,
      });
      toast({ title: 'Sessão marcada', description: 'A sua marcação foi confirmada com sucesso.' });
      onOpenChange(false);
      onBooked?.();
      resetWizard();
    } catch {
      setWizardError('Não foi possível confirmar a marcação. Tente novamente.');
    } finally {
      setWizardConfirmLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetWizard();
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl p-0">
        <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="hidden border-r bg-slate-50 p-6 lg:block">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Marcar Sessão</p>
                <p className="text-xs text-slate-500">Apoio socio-profissional</p>
              </div>
              <DialogClose aria-label="Cancelar" className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                ✕
              </DialogClose>
            </div>

            <div className="mt-6 space-y-4">
              {[
                { step: 1 as const, title: 'Seleção de Serviço', subtitle: selectedService?.title ?? 'Escolha um serviço' },
                { step: 2 as const, title: 'Seleção de Especialista', subtitle: selectedSpecialist?.name ?? 'Escolha um profissional' },
                { step: 3 as const, title: 'Data e Hora', subtitle: slotDate && slotTime ? `${formatPtDate(slotDate)} • ${slotTime}` : 'Escolha um horário' },
                { step: 4 as const, title: 'Confirmação', subtitle: 'Reveja os detalhes' },
              ].map((item) => {
                const active = wizardStep === item.step;
                const completed =
                  item.step === 1 ? !!serviceId :
                  item.step === 2 ? !!specialistId :
                  item.step === 3 ? !!slotDate && !!slotTime :
                  false;
                return (
                  <div key={item.step} className={cn('flex items-start gap-3 rounded-xl p-3', active ? 'bg-white ring-1 ring-primary' : '')}>
                    <div
                      className={cn(
                        'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                        completed ? 'border-primary bg-primary text-white' : active ? 'border-primary text-primary' : 'border-slate-200 text-slate-400',
                      )}
                    >
                      {completed ? <Check className="h-4 w-4" /> : item.step}
                    </div>
                    <div className="min-w-0">
                      <p className={cn('text-sm font-semibold', active ? 'text-slate-900' : 'text-slate-700')}>{item.title}</p>
                      <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-center justify-between border-b px-5 py-4 lg:px-8">
              <DialogHeader className="space-y-0 text-left">
                <DialogTitle className="text-lg font-semibold text-slate-900">Marcar sessão</DialogTitle>
                <DialogDescription className="sr-only">Wizard de marcação de sessão em quatro etapas.</DialogDescription>
                <p className="text-xs text-slate-500">
                  Etapa {wizardStep} de 4
                </p>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <DialogClose asChild>
                  <Button variant="outline" className="h-9">Cancelar</Button>
                </DialogClose>
              </div>
            </div>

            <div className="px-5 py-4 lg:px-8">
              <Progress value={(wizardStep / 4) * 100} className="h-2" />
              {wizardError ? <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{wizardError}</p> : null}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6 lg:px-8">
              {wizardTransitionLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A carregar…
                  </div>
                </div>
              ) : (
                <>
                  {wizardStep === 1 ? (
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Selecione o serviço</h2>
                      <p className="mt-1 text-sm text-slate-600">Escolha o tipo de apoio que precisa.</p>
                      <div className="mt-5">
                        <BookingServiceStep
                          services={BOOKING_SERVICES}
                          value={serviceId}
                          onChange={(next) => {
                            setServiceId(next);
                            setSpecialistId(null);
                            setSlotDate(null);
                            setSlotTime(null);
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {wizardStep === 2 ? (
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Selecione o especialista</h2>
                      <p className="mt-1 text-sm text-slate-600">Profissionais disponíveis para o serviço escolhido.</p>
                      <div className="mt-5">
                        <BookingSpecialistStep
                          specialists={availableSpecialists}
                          value={specialistId}
                          onChange={(next) => {
                            setSpecialistId(next);
                            setSlotDate(null);
                            setSlotTime(null);
                          }}
                          loading={specialistsLoading}
                        />
                      </div>
                    </div>
                  ) : null}

                  {wizardStep === 3 ? (
                    <div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-slate-900">Selecione data e hora</h2>
                          <p className="mt-1 text-sm text-slate-600">Escolha um horário disponível.</p>
                        </div>
                        <div className="flex gap-2">
                          {selectedService ? (
                            <div className="rounded-xl border bg-white px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Serviço</p>
                              <p className="text-sm font-semibold text-slate-900">{selectedService.title}</p>
                            </div>
                          ) : null}
                          {selectedSpecialist ? (
                            <div className="rounded-xl border bg-white px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Especialista</p>
                              <p className="text-sm font-semibold text-slate-900">{selectedSpecialist.name}</p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-5">
                        {selectedSpecialist ? (
                          <BookingDateTimeStep
                            selectedDate={slotDate}
                            onDateChange={(d) => {
                              setSlotDate(d);
                              setSlotTime(null);
                            }}
                            timeValue={slotTime}
                            onTimeChange={setSlotTime}
                            specialistId={selectedSpecialist.id}
                            loading={slotsLoading}
                          />
                        ) : (
                          <div className="text-sm text-slate-500">Selecione um especialista para ver os horários.</div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {wizardStep === 4 && selectedService && selectedSpecialist && slotDate && slotTime ? (
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Confirmação</h2>
                      <p className="mt-1 text-sm text-slate-600">Revise os detalhes antes de confirmar.</p>
                      <div className="mt-5">
                        <BookingConfirmationStep service={selectedService} specialist={selectedSpecialist} date={slotDate} time={slotTime} />
                      </div>
                      {wizardConfirmLoading ? (
                        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          A confirmar…
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="border-t px-5 py-4 lg:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="outline" className="h-10" onClick={goBack} disabled={wizardStep === 1 || wizardTransitionLoading || wizardConfirmLoading}>
                  Voltar
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="text-xs text-slate-500 sm:mr-3">
                    {selectedService ? (
                      <span className="font-semibold text-slate-700">{selectedService.title}</span>
                    ) : (
                      <span>Selecione um serviço</span>
                    )}
                    {slotDate && slotTime ? <span className="text-slate-400"> • </span> : null}
                    {slotDate && slotTime ? <span className="font-semibold text-slate-700">{formatPtDate(slotDate)} {slotTime}</span> : null}
                  </div>

                  {wizardStep < 4 ? (
                    <Button className="h-10" onClick={goNext} disabled={wizardTransitionLoading || wizardConfirmLoading}>
                      Próximo
                    </Button>
                  ) : (
                    <Button className="h-10" onClick={confirmBooking} disabled={wizardTransitionLoading || wizardConfirmLoading || !userId}>
                      {wizardConfirmLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Confirmar marcação
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
