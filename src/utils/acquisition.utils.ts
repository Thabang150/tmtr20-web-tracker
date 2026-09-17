export const SOURCE_CATEGORIES = [
  'Direct',
  'Organic Search',
  'Paid Search',
  'Social',
  'Paid Social',
  'Video',
  'Referral',
  'Email',
  'Other',
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

const SEARCH_HOSTS = new Set(['google.', 'bing.com', 'yahoo.', 'duckduckgo.com', 'baidu.com', 'yandex.']);
const SOCIAL_HOSTS = new Set(['facebook.com', 'instagram.com', 'linkedin.com', 'tiktok.com', 'x.com', 'twitter.com']);
const VIDEO_HOSTS = new Set(['youtube.com', 'youtu.be', 'vimeo.com']);

export interface AcquisitionInput {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export interface AcquisitionData extends AcquisitionInput {
  referralDomain?: string;
  sourceCategory: SourceCategory;
}

export function getAcquisitionData(input: AcquisitionInput): AcquisitionData {
  const referralDomain = getReferralDomain(input.referrer);
  const source = input.utmSource?.toLowerCase();
  const medium = input.utmMedium?.toLowerCase();

  return {
    ...input,
    referralDomain,
    sourceCategory: classifySource({ medium, source, referralDomain }),
  };
}

export function hasAttribution(input: AcquisitionInput): boolean {
  return Boolean(input.referrer || input.utmSource || input.utmMedium || input.utmCampaign || input.utmContent || input.utmTerm);
}

export function getReferralDomain(referrer?: string): string | undefined {
  if (!referrer) {
    return undefined;
  }

  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch (_error) {
    return undefined;
  }
}

function classifySource(input: { medium?: string; source?: string; referralDomain?: string }): SourceCategory {
  const medium = input.medium ?? '';
  const source = input.source ?? '';
  const domain = input.referralDomain ?? '';

  if (!medium && !source && !domain) return 'Direct';
  if (['cpc', 'ppc', 'paid', 'paidsearch'].includes(medium)) return 'Paid Search';
  if (['paid_social', 'paidsocial', 'social_paid'].includes(medium)) return 'Paid Social';
  if (medium === 'email') return 'Email';
  if (medium === 'video' || matchesHost(domain, VIDEO_HOSTS)) return 'Video';
  if (['organic', 'organic_search'].includes(medium) || matchesHost(domain, SEARCH_HOSTS)) return 'Organic Search';
  if (['social', 'social_media'].includes(medium) || matchesHost(domain, SOCIAL_HOSTS)) return 'Social';
  if (domain) return 'Referral';
  return 'Other';
}

function matchesHost(domain: string, hosts: Set<string>): boolean {
  return Array.from(hosts).some((host) => host.endsWith('.') ? domain.includes(host) : domain === host || domain.endsWith(`.${host}`));
}