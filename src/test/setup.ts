import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  document.body.style.pointerEvents = '';
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.body.removeAttribute('data-scroll-locked');
});

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

if (!('hasPointerCapture' in Element.prototype)) {
  (Element.prototype as unknown as { hasPointerCapture: (pointerId: number) => boolean }).hasPointerCapture = () => false;
}
if (!('setPointerCapture' in Element.prototype)) {
  (Element.prototype as unknown as { setPointerCapture: (pointerId: number) => void }).setPointerCapture = () => undefined;
}
if (!('releasePointerCapture' in Element.prototype)) {
  (Element.prototype as unknown as { releasePointerCapture: (pointerId: number) => void }).releasePointerCapture = () => undefined;
}

if (!('scrollIntoView' in Element.prototype)) {
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => undefined;
}
