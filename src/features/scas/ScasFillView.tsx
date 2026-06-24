import { useState } from 'react';
import { Loader2, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getTranslationStringAtPath,
  interpolateTranslation,
  type Language,
} from '@/lib/i18n';
import type { UseScasFillResult } from './useScasFill';

const SCAS_LANGUAGES: Language[] = ['pt', 'en', 'es', 'fr'];
const SCALE_EMOJI: Record<number, string> = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };

function scasText(lang: Language, path: string, params?: Record<string, string | number>): string {
  const raw =
    getTranslationStringAtPath(lang, path) ?? getTranslationStringAtPath('pt', path) ?? path;
  return interpolateTranslation(raw, params);
}

export interface ScasFillViewProps {
  fill: UseScasFillResult;
  onBack: () => void;
  onSubmitted: () => void;
}

export function ScasFillView({ fill, onBack, onSubmitted }: ScasFillViewProps) {
  const { language: uiLanguage } = useLanguage();
  const [showConfirm, setShowConfirm] = useState(false);

  if (fill.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (fill.submitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          <h2 className="text-xl font-bold">{scasText(uiLanguage, 'scas.migrant.thanksTitle')}</h2>
          <p className="text-muted-foreground">{scasText(uiLanguage, 'scas.migrant.thanksBody')}</p>
          <Button onClick={onSubmitted}>{scasText(uiLanguage, 'scas.migrant.back')}</Button>
        </CardContent>
      </Card>
    );
  }

  if (!fill.pending) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center space-y-4">
          <ShieldCheck className="h-12 w-12 text-primary mx-auto" />
          <p className="text-muted-foreground">{scasText(uiLanguage, 'scas.migrant.lockedNotice')}</p>
          <Button variant="outline" onClick={onBack}>
            {scasText(uiLanguage, 'scas.migrant.back')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const momentTitleKey =
    fill.pending.moment_type === 'T0'
      ? 'scas.migrant.ctaT0Title'
      : fill.pending.moment_type === 'T_TRILHA'
        ? 'scas.migrant.ctaTrailTitle'
        : 'scas.migrant.ctaPdiTitle';

  const submitErrorText = fill.submitError
    ? fill.submitError === 'INCOMPLETE'
      ? scasText(uiLanguage, 'scas.errors.incomplete')
      : fill.submitError === 'ALREADY_SUBMITTED'
        ? scasText(uiLanguage, 'scas.errors.alreadySubmitted')
        : fill.submitError === 'NOT_ELIGIBLE'
          ? scasText(uiLanguage, 'scas.errors.notEligible')
          : scasText(uiLanguage, 'scas.errors.generic')
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{scasText(fill.formLanguage, 'scas.title')}</h1>
          <p className="text-sm text-muted-foreground">{scasText(uiLanguage, momentTitleKey)}</p>
        </div>
        <div className="w-40">
          <Select value={fill.formLanguage} onValueChange={(v) => fill.setFormLanguage(v as Language)}>
            <SelectTrigger aria-label={scasText(uiLanguage, 'scas.languageLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCAS_LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{scasText(fill.formLanguage, 'scas.intro')}</p>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {scasText(uiLanguage, 'scas.migrant.progress', {
            answered: fill.answeredCount,
            total: fill.items.length,
          })}
        </span>
        {fill.savingItem !== null ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="space-y-4">
        {fill.items.map((itemId, index) => (
          <Card key={itemId}>
            <CardHeader className="pb-2">
              <p className="font-medium">
                <span className="text-muted-foreground mr-2">{index + 1}.</span>
                {scasText(fill.formLanguage, `scas.items.${itemId}`)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((value) => {
                  const selected = fill.responses[itemId] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => void fill.handleAnswer(itemId, value)}
                      aria-pressed={selected}
                      aria-label={scasText(fill.formLanguage, `scas.scale.${value}`)}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors min-h-16 ${
                        selected
                          ? 'border-primary bg-primary/10'
                          : 'hover:border-primary/40 hover:bg-muted'
                      }`}
                    >
                      <span className="text-2xl" aria-hidden>
                        {SCALE_EMOJI[value]}
                      </span>
                      <span className="text-[10px] leading-tight text-center text-muted-foreground">
                        {scasText(fill.formLanguage, `scas.scale.${value}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {submitErrorText ? (
        <p className="text-sm font-medium text-destructive">{submitErrorText}</p>
      ) : null}

      {!showConfirm ? (
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button variant="outline" onClick={onBack}>
            {scasText(uiLanguage, 'scas.migrant.saveDraft')}
          </Button>
          <Button disabled={!fill.allAnswered} onClick={() => setShowConfirm(true)}>
            {scasText(uiLanguage, 'scas.migrant.submit')}
          </Button>
        </div>
      ) : (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">{scasText(uiLanguage, 'scas.migrant.confirmTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {scasText(uiLanguage, 'scas.migrant.confirmBody')}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={fill.submitting}>
                {scasText(uiLanguage, 'scas.migrant.confirmCancel')}
              </Button>
              <Button
                onClick={async () => {
                  const ok = await fill.submit();
                  if (ok) setShowConfirm(false);
                }}
                disabled={fill.submitting || !fill.allAnswered}
              >
                {fill.submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {scasText(uiLanguage, 'scas.migrant.submitting')}
                  </>
                ) : (
                  scasText(uiLanguage, 'scas.migrant.confirmSubmit')
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
