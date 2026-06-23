import { useEffect, useRef, useState } from 'react';
import { mountHcaptchaWidget, resetHcaptchaWidget, unmountHcaptchaWidget } from '@/lib/hcaptcha';
import { loadRecaptchaPublicSettings } from '@/lib/recaptcha';

type HcaptchaRegisterWidgetProps = {
  onVerifiedChange: (verified: boolean) => void;
  resetSignal: number;
};

export default function HcaptchaRegisterWidget({
  onVerifiedChange,
  resetSignal,
}: HcaptchaRegisterWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedSiteKeyRef = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const settings = await loadRecaptchaPublicSettings();
      if (cancelled) return;
      if (!settings.enabled || settings.provider !== 'hcaptcha' || !settings.siteKey) {
        onVerifiedChange(true);
        setVisible(false);
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      setVisible(true);
      mountedSiteKeyRef.current = settings.siteKey;
      onVerifiedChange(false);

      await mountHcaptchaWidget(container, settings.siteKey, {
        onSuccess: () => onVerifiedChange(true),
        onExpired: () => onVerifiedChange(false),
        onError: () => onVerifiedChange(false),
      });
    })();

    return () => {
      cancelled = true;
      unmountHcaptchaWidget();
      mountedSiteKeyRef.current = null;
    };
  }, [onVerifiedChange]);

  useEffect(() => {
    if (!visible || resetSignal === 0) return;
    resetHcaptchaWidget();
    onVerifiedChange(false);

    const siteKey = mountedSiteKeyRef.current;
    const container = containerRef.current;
    if (!siteKey || !container) return;

    void mountHcaptchaWidget(container, siteKey, {
      onSuccess: () => onVerifiedChange(true),
      onExpired: () => onVerifiedChange(false),
      onError: () => onVerifiedChange(false),
    });
  }, [resetSignal, onVerifiedChange, visible]);

  return (
    <div
      ref={containerRef}
      className={visible ? 'flex justify-center' : 'hidden'}
      aria-hidden={!visible}
      aria-label="hCaptcha"
    />
  );
}
