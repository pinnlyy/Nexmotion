/**
 * AM Prem — informational adapter only.
 *
 * SECURITY: This module deliberately does NOT create/activate accounts,
 * generate license keys, or bypass any subscription/paid service.
 * If the Nexmotion operator obtains explicit authorization from the
 * upstream service, hook a real licensed API into PremAdapter.
 */

export interface PremPlan {
  id: string;
  name: string;
  price: string;
  features: string[];
}

export interface PremAccountInfo {
  authenticated: boolean;
  plan: string | null;
  validUntil: string | null;
  status: 'none' | 'active' | 'expired' | 'unknown';
  note: string;
}

export const PREM_PLANS: PremPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'Rp 0',
    features: [
      'Finder search',
      'Player preview',
      'Media replacement',
      'Preset export (XML / ZIP)',
      'SD preview rendering',
    ],
  },
  {
    id: 'pro',
    name: 'Pro (self-host)',
    price: 'Community / Free',
    features: [
      'Everything in Free',
      '1080p rendering (self-hosted workers)',
      'PNG frame export',
      'Priority render queue (self-hosted)',
      'No telemetry',
    ],
  },
];

export const PREM_OFFICIAL_NOTE = `Nexmotion is an independent tool. It does not create, sell, or
activate Alight Motion premium (AM Prem) accounts. To get AM Premium,
purchase it only through the official Alight Motion app or authorized
channels. Never share your password, and never trust third parties that
claim to "activate premium" for you — that is typically account takeover
and is not supported here.`;

export class PremAdapter {
  name = 'informational-only';

  getAccountInfo(userId: string | null): PremAccountInfo {
    return {
      authenticated: false,
      plan: null,
      validUntil: null,
      status: 'none',
      note: 'Nexmotion does not manage premium subscriptions. See PREM_OFFICIAL_NOTE.',
    };
  }

  async activate(): Promise<{ ok: false; error: string }> {
    return {
      ok: false,
      error: 'Activation is not available. Nexmotion does not bypass or automate premium account activation.',
    };
  }

  async verifyOfficialLink(): Promise<boolean> {
    return false; // intentionally not automated — manual user action only
  }
}

export function getPremAdapter() { return new PremAdapter(); }
