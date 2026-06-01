import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Scale, HeartHandshake, LifeBuoy, Users, type LucideIcon } from 'lucide-react';
import { listConsultants, type ConsultantOption } from '@/features/activities/repository';
import {
  ensureServiceAreasSeeded,
  updateServiceArea,
  type ServiceArea,
  type ServiceAreaId,
  type ServiceAreaDuration,
} from '@/features/serviceAreas/serviceAreas';

const AREA_ICON: Record<ServiceAreaId, LucideIcon> = {
  legal: Scale,
  psychology: HeartHandshake,
  mediation: LifeBuoy,
};

export default function ServiceAreasAdminPage() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [editing, setEditing] = useState<ServiceArea | null>(null);

  useEffect(() => {
    if (!isAdmin || !user?.uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [loadedAreas, loadedConsultants] = await Promise.all([
          ensureServiceAreasSeeded(user.uid),
          listConsultants(),
        ]);
        if (cancelled) return;
        setAreas(loadedAreas);
        setConsultants(loadedConsultants);
      } catch (error) {
        console.error('[ServiceAreasAdminPage] falha ao carregar:', error);
        if (!cancelled) toast({ title: t.get('common.error'), variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, user?.uid, t, toast]);

  function handleSaved(updated: ServiceArea) {
    setAreas((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditing(null);
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="cpc-container py-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-rose-600">{t.get('common.error')}</p>
            <p className="mt-2 text-sm text-muted-foreground">Apenas administradores podem gerir as áreas de serviço.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="cpc-container py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Users className="h-7 w-7 text-primary" /> {t.get('serviceAreas.title')}
            </h1>
            <p className="text-muted-foreground mt-1">Defina os responsáveis e a duração padrão por área.</p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/dashboard/cpc">{t.get('common.back')}</Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {areas.map((areaItem) => {
              const Icon = AREA_ICON[areaItem.id];
              return (
                <Card key={areaItem.id} className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-lg">
                      <span className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        {t.get(areaItem.name_key)}
                      </span>
                      <Badge variant="outline" className={areaItem.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>
                        {t.get(areaItem.is_active ? 'serviceAreas.active' : 'serviceAreas.inactive')}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t.get('serviceAreas.duration')}</p>
                      <p className="mt-1 font-medium">
                        {t.get(areaItem.default_duration_minutes === 60 ? 'serviceAreas.duration60' : 'serviceAreas.duration30')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t.get('serviceAreas.responsibles')}</p>
                      {areaItem.responsible_names.length > 0 ? (
                        <ul className="mt-1 space-y-0.5">
                          {areaItem.responsible_names.map((name) => (
                            <li key={name} className="text-sm">{name}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">{t.get('serviceAreas.noResponsibles')}</p>
                      )}
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => setEditing(areaItem)}>
                      {t.get('serviceAreas.editArea')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {editing ? (
        <ServiceAreaEditorDialog
          area={editing}
          consultants={consultants}
          updatedBy={user?.uid ?? ''}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </Layout>
  );
}

function ServiceAreaEditorDialog({
  area,
  consultants,
  updatedBy,
  onClose,
  onSaved,
}: {
  area: ServiceArea;
  consultants: ConsultantOption[];
  updatedBy: string;
  onClose: () => void;
  onSaved: (updated: ServiceArea) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [duration, setDuration] = useState<ServiceAreaDuration>(area.default_duration_minutes);
  const [active, setActive] = useState(area.is_active);
  const [selectedUids, setSelectedUids] = useState<string[]>(area.responsible_uids);
  const [saving, setSaving] = useState(false);

  const consultantById = useMemo(() => new Map(consultants.map((c) => [c.id, c])), [consultants]);

  function toggle(uid: string) {
    setSelectedUids((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const responsible_names = selectedUids.map((uid) => consultantById.get(uid)?.name ?? uid);
      await updateServiceArea(
        area.id,
        { responsible_uids: selectedUids, responsible_names, default_duration_minutes: duration, is_active: active },
        updatedBy
      );
      onSaved({
        ...area,
        responsible_uids: selectedUids,
        responsible_names,
        default_duration_minutes: duration,
        is_active: active,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      });
      toast({ title: t.get('serviceAreas.saveSuccess') });
    } catch (error) {
      console.error('[ServiceAreaEditorDialog] falha ao guardar:', error);
      toast({ title: t.get('serviceAreas.saveError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t.get('serviceAreas.editArea')} — {t.get(area.name_key)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>{t.get('serviceAreas.duration')}</Label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v) as ServiceAreaDuration)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">{t.get('serviceAreas.duration30')}</SelectItem>
                <SelectItem value="60">{t.get('serviceAreas.duration60')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t.get('serviceAreas.responsibles')}</Label>
            <div className="mt-1.5 max-h-[280px] space-y-2 overflow-auto rounded-2xl border p-3">
              {consultants.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.get('serviceAreas.noResponsibles')}</p>
              ) : (
                consultants.map((c) => (
                  <label key={c.id} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.role}</p>
                    </div>
                    <Checkbox checked={selectedUids.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="area-active">{t.get('serviceAreas.active')}</Label>
            <Switch id="area-active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t.get('serviceAreas.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t.get('serviceAreas.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
