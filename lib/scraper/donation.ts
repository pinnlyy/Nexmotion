export interface DonationMethod {
  id: string;
  name: string;
  detail: string;
  note: string;
}

export interface DonationSettings {
  qrisImage: string | null;
  methods: DonationMethod[];
  supportContact: string;
}

export const DONATION_DISCLAIMER =
  'Donation is voluntary. Verify the recipient and payment details independently. Nexmotion does not process payments or guarantee transactions.';

export function getDonationConfig(): DonationSettings {
  const qrisImage = process.env.NEX_QRIS_IMAGE_URL?.trim() || null;
  const supportContact =
    process.env.NEX_SUPPORT_CONTACT?.trim() || 'Contact the instance operator.';

  const methods: DonationMethod[] = [];

  const names = ['DANA', 'GoPay', 'OVO', 'Bank Transfer'];

  for (const name of names) {
    const key = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const detail = process.env[`NEX_DONATION_${key}`]?.trim();

    if (detail) {
      methods.push({
        id: key.toLowerCase(),
        name,
        detail,
        note: 'Verify the recipient details before making a payment.',
      });
    }
  }

  return {
    qrisImage,
    methods,
    supportContact,
  };
}
