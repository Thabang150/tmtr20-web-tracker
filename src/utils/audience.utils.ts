export const OPERATING_SYSTEMS = ['Windows', 'macOS', 'iOS', 'Android', 'Linux', 'Other'] as const;
export const VIEWPORT_CATEGORIES = ['small', 'medium', 'large'] as const;
export const SCREEN_CATEGORIES = ['small', 'medium', 'large'] as const;

export type OperatingSystem = (typeof OPERATING_SYSTEMS)[number];
export type ViewportCategory = (typeof VIEWPORT_CATEGORIES)[number];
export type ScreenCategory = (typeof SCREEN_CATEGORIES)[number];

export interface AudienceInput {
  os?: string;
  language?: string;
  timezone?: string;
  viewportCategory?: string;
  screenCategory?: string;
}

export interface AudienceData {
  os?: OperatingSystem;
  language?: string;
  timezone?: string;
  viewportCategory?: ViewportCategory;
  screenCategory?: ScreenCategory;
}

export function normalizeAudience(input: AudienceInput): AudienceData {
  return {
    os: normalizeOperatingSystem(input.os),
    language: normalizeLanguage(input.language),
    timezone: normalizeTimezone(input.timezone),
    viewportCategory: normalizeCategory(input.viewportCategory),
    screenCategory: normalizeCategory(input.screenCategory),
  };
}

function normalizeOperatingSystem(value?: string): OperatingSystem | undefined {
  return OPERATING_SYSTEMS.includes(value as OperatingSystem) ? value as OperatingSystem : undefined;
}

function normalizeLanguage(value?: string): string | undefined {
  if (!value || !/^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/.test(value)) {
    return undefined;
  }
  return value;
}

function normalizeTimezone(value?: string): string | undefined {
  if (!value || value.length > 100) return undefined;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value }).format();
    return value;
  } catch (_error) {
    return undefined;
  }
}

function normalizeCategory(value?: string): ViewportCategory | undefined {
  return VIEWPORT_CATEGORIES.includes(value as ViewportCategory) ? value as ViewportCategory : undefined;
}