import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  DEFAULT_CAPTCHA_LENGTH,
  generateCaptchaCode,
  isCaptchaSolved,
} from '@/lib/captchaChallenge';

type HumanVerificationCaptchaProps = {
  /** Estado atual de verificação (controlado pelo formulário). */
  verified: boolean;
  /** Notifica o formulário quando o estado de verificação muda. */
  onVerifiedChange: (verified: boolean) => void;
  /**
   * Sempre que este número mudar, gera-se um novo desafio e limpa-se a resposta.
   * Útil para reiniciar após falha de submissão ou troca de perfil.
   */
  resetSignal?: number;
  className?: string;
};

const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 64;

function drawChallenge(canvas: HTMLCanvasElement | null, code: string) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Fundo com leve gradiente para dificultar OCR ingénuo.
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, '#eef2ff');
  gradient.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Ruído: linhas aleatórias.
  for (let i = 0; i < 6; i += 1) {
    ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 120)}, ${Math.floor(
      Math.random() * 120
    )}, ${Math.floor(Math.random() * 160)}, 0.4)`;
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT);
    ctx.lineTo(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT);
    ctx.stroke();
  }

  // Ruído: pontos.
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `rgba(${Math.floor(Math.random() * 150)}, ${Math.floor(
      Math.random() * 150
    )}, ${Math.floor(Math.random() * 180)}, 0.5)`;
    ctx.beginPath();
    ctx.arc(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, Math.random() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Caracteres distorcidos.
  const padding = 18;
  const usableWidth = CANVAS_WIDTH - padding * 2;
  const step = usableWidth / Math.max(code.length, 1);
  for (let i = 0; i < code.length; i += 1) {
    const char = code.charAt(i);
    const x = padding + step * i + step / 2;
    const y = CANVAS_HEIGHT / 2;
    const angle = (Math.random() - 0.5) * 0.6;
    const fontSize = 28 + Math.floor(Math.random() * 8);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `hsl(${Math.floor(Math.random() * 220)}, 70%, 35%)`;
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
}

/**
 * CAPTCHA visível e auto-contido (canvas) para o formulário de registo.
 *
 * Não depende de serviços externos: gera um código distorcido localmente e
 * exige que o utilizador o reproduza antes de permitir a submissão. Funciona
 * como primeira barreira contra bots/spam, somando-se às proteções de
 * servidor (rate limiting + reCAPTCHA v3 verificado no backend).
 */
export default function HumanVerificationCaptcha({
  verified,
  onVerifiedChange,
  resetSignal = 0,
  className,
}: HumanVerificationCaptchaProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [code, setCode] = useState<string>(() => generateCaptchaCode(DEFAULT_CAPTCHA_LENGTH));
  const [answer, setAnswer] = useState('');
  const [touched, setTouched] = useState(false);
  const inputId = useId();
  const statusId = useId();

  const regenerate = useCallback(() => {
    const next = generateCaptchaCode(DEFAULT_CAPTCHA_LENGTH);
    setCode(next);
    setAnswer('');
    setTouched(false);
    onVerifiedChange(false);
  }, [onVerifiedChange]);

  // Redesenha sempre que o código muda.
  useEffect(() => {
    drawChallenge(canvasRef.current, code);
  }, [code]);

  // Reinicia o desafio quando o formulário pede (falha de submit / troca de perfil).
  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagir apenas ao sinal externo
  }, [resetSignal]);

  const handleAnswerChange = (value: string) => {
    setAnswer(value);
    setTouched(true);
    const solved = isCaptchaSolved(value, code);
    if (solved !== verified) {
      onVerifiedChange(solved);
    }
  };

  const showError = touched && answer.length > 0 && !verified;

  return (
    <div className={cn('space-y-2', className)}>
      <span className="text-sm font-medium text-foreground">{t.get('auth.captcha.label')}</span>

      <div className="flex items-center gap-3">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          role="img"
          aria-label={t.get('auth.captcha.imageAlt')}
          className="rounded-md border bg-muted/40"
        />
        <button
          type="button"
          onClick={regenerate}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t.get('auth.captcha.refresh')}
          title={t.get('auth.captcha.refresh')}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <label htmlFor={inputId} className="block text-sm text-muted-foreground">
        {t.get('auth.captcha.instruction')}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name="captcha-answer"
          value={answer}
          onChange={(e) => handleAnswerChange(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={DEFAULT_CAPTCHA_LENGTH + 2}
          aria-invalid={showError}
          aria-describedby={statusId}
          className={cn(
            'flex h-10 w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm uppercase tracking-[0.3em] ring-offset-background placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            showError && 'border-destructive focus-visible:ring-destructive',
            verified && 'border-emerald-500 focus-visible:ring-emerald-500'
          )}
          placeholder={t.get('auth.captcha.placeholder')}
        />
        {verified && (
          <ShieldCheck className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" aria-hidden />
        )}
      </div>

      <p
        id={statusId}
        className={cn(
          'text-xs',
          verified ? 'text-emerald-600' : showError ? 'text-destructive' : 'text-muted-foreground'
        )}
        role={showError ? 'alert' : undefined}
      >
        {verified
          ? t.get('auth.captcha.success')
          : showError
            ? t.get('auth.captcha.error')
            : t.get('auth.captcha.hint')}
      </p>
    </div>
  );
}
