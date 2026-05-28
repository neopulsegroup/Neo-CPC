import { getDocument } from '@/integrations/firebase/firestore';

export type BrandingSection = 'left' | 'center' | 'right';
export type BrandingContentType = 'image' | 'pagination' | 'title';

export type BrandingSlot = {
  mode: BrandingContentType;
  imageUrl: string;
  imagePath: string;
};

export type BrandingSettings = {
  header: Record<BrandingSection, BrandingSlot>;
  footer: Record<BrandingSection, BrandingSlot>;
};

export type BrandingSettingsDoc = {
  id: string;
  header?: Partial<Record<BrandingSection, Partial<BrandingSlot> | null>> | null;
  footer?: Partial<Record<BrandingSection, Partial<BrandingSlot> | null>> | null;
};

export const BRANDING_SECTIONS: BrandingSection[] = ['left', 'center', 'right'];

/** Logótipos incluídos na app (sem Storage) — servidos a partir de `/public/branding`. */
export const BRANDING_BUILTIN_HEADER_CENTER_URL = '/branding/logo-SF.png';
export const BRANDING_BUILTIN_FOOTER_CENTER_URL = '/branding/logos-cpc-sf.png';
export const BRANDING_BUILTIN_HEADER_CENTER_PATH = 'built-in:logo-SF.png';
export const BRANDING_BUILTIN_FOOTER_CENTER_PATH = 'built-in:logos-cpc-sf.png';

export function defaultBranding(): BrandingSettings {
  const makeImageSlot = (): BrandingSlot => ({ mode: 'image', imageUrl: '', imagePath: '' });
  return {
    header: {
      left: makeImageSlot(),
      center: {
        mode: 'image',
        imageUrl: BRANDING_BUILTIN_HEADER_CENTER_URL,
        imagePath: BRANDING_BUILTIN_HEADER_CENTER_PATH,
      },
      right: makeImageSlot(),
    },
    footer: {
      left: { mode: 'title', imageUrl: '', imagePath: '' },
      center: {
        mode: 'image',
        imageUrl: BRANDING_BUILTIN_FOOTER_CENTER_URL,
        imagePath: BRANDING_BUILTIN_FOOTER_CENTER_PATH,
      },
      right: { mode: 'pagination', imageUrl: '', imagePath: '' },
    },
  };
}

export function normalizeBranding(input: BrandingSettingsDoc | null | undefined): BrandingSettings {
  const base = defaultBranding();
  if (!input) return base;

  for (const section of BRANDING_SECTIONS) {
    const headerSlot = input.header?.[section];
    const url =
      headerSlot && typeof headerSlot.imageUrl === 'string' ? headerSlot.imageUrl.trim() : '';
    if (url) {
      base.header[section] = {
        mode: 'image',
        imageUrl: url,
        imagePath: typeof headerSlot?.imagePath === 'string' ? headerSlot.imagePath : '',
      };
    }
  }

  for (const section of BRANDING_SECTIONS) {
    const footerSlot = input.footer?.[section];
    if (!footerSlot) continue;

    const defaultFooter = defaultBranding().footer[section];
    const mode =
      footerSlot.mode === 'pagination' || footerSlot.mode === 'title' || footerSlot.mode === 'image'
        ? footerSlot.mode
        : defaultFooter.mode;
    const fUrl = typeof footerSlot.imageUrl === 'string' ? footerSlot.imageUrl.trim() : '';
    const path = typeof footerSlot.imagePath === 'string' ? footerSlot.imagePath : '';

    if (mode === 'image') {
      if (fUrl) {
        base.footer[section] = { mode: 'image', imageUrl: fUrl, imagePath: path };
      } else if (section === 'center') {
        base.footer[section] = {
          mode: 'image',
          imageUrl: BRANDING_BUILTIN_FOOTER_CENTER_URL,
          imagePath: BRANDING_BUILTIN_FOOTER_CENTER_PATH,
        };
      } else {
        base.footer[section] = { mode: 'image', imageUrl: '', imagePath: '' };
      }
    } else {
      base.footer[section] = { mode, imageUrl: '', imagePath: '' };
    }
  }

  return base;
}

export async function fetchDocumentBranding(): Promise<BrandingSettings> {
  try {
    const doc = await getDocument<BrandingSettingsDoc>('system_settings', 'document_branding');
    return normalizeBranding(doc);
  } catch {
    return defaultBranding();
  }
}
