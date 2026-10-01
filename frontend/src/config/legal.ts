// Company details shown on the Terms and Privacy pages.
// TODO before launch: replace every value in [brackets] with the real details,
// and have a lawyer review both pages.
export const LEGAL = {
  brand: 'Bhumi Bazar',
  companyName: '[Registered company / business name]',
  address: '[Registered office address]',
  email: '[support email address]',
  phone: '[support phone number]',
  // Required for platforms in India (IT Rules, 2021 / DPDP Act, 2023)
  grievanceOfficer: {
    name: '[Grievance Officer name]',
    email: '[grievance email address]',
  },
  courtsCity: '[City]', // courts with jurisdiction over disputes
  lastUpdated: '30 September 2026',
} as const;
