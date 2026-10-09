import { ok } from '../../utils/v1.js';

// GET /legal/privacy-policy and /legal/terms-and-conditions — public, fixed text
// for the mobile app (the website has its own pages). Have a lawyer review this
// text and set SUPPORT_EMAIL / SUPPORT_PHONE before launch.

const BRAND = 'Bhumi Bazar';
const VERSION = '1.0';
const LAST_UPDATED = '2026-10-09';

const contact = () => ({
    email: process.env.SUPPORT_EMAIL || null,
    phone: process.env.SUPPORT_PHONE || null,
});

const PRIVACY = [
    {
        title: 'Who we are',
        content: [
            `${BRAND} is a land marketplace where owners list land for sale, rent or lease and buyers find it. This policy explains what personal data we collect, why, who can see it and the choices you have under Indian law, including the Digital Personal Data Protection Act, 2023.`,
        ],
    },
    {
        title: 'What we collect',
        content: [
            'Account details: your mobile number, name, email (optional), state and district. You sign in with a one-time password (OTP) sent to your mobile; we do not use passwords.',
            'Listing details: khata and khasra numbers, area, price, description, address, photos and videos, and the property location (only if you choose to share it).',
            'Enquiries and visit bookings: the name, phone, email and message you send.',
            'Device data: a push notification (FCM) token, device type, app version and IP address, used to send notifications and keep the service secure.',
            'Feedback you send us, such as ratings and messages.',
        ],
    },
    {
        title: 'How we use your data',
        content: [
            'To create your account and sign you in.',
            'To publish your listings after review and tell you when they are approved or rejected.',
            'To connect buyers with sellers and arrange site visits.',
            'To send service notifications about your account, listings and enquiries.',
            'To prevent fraud and misuse, and to meet legal obligations. We do not sell your personal data.',
        ],
    },
    {
        title: 'Who can see your data',
        content: [
            'Everyone: approved listings, including details, photos, videos and location.',
            'Signed-in users: your mobile number is shown to a signed-in user who wants to contact you about your listing. Your name and phone are shared with the owner when you send an enquiry or book a visit.',
            `Our team: ${BRAND} administrators can see listings and account details to review listings and support you.`,
            'Service providers that process data for us: hosting, database, photo and video storage, SMS and notification providers.',
            'Authorities, when required by law.',
        ],
    },
    {
        title: 'Location and permissions',
        content: [
            'Location is used only if you tap the option to add your property location and allow it. You can refuse and still list your land.',
            'Notifications are optional. You can turn them off in your phone settings.',
        ],
    },
    {
        title: 'How long we keep data',
        content: [
            'We keep your data while your account is active. When you delete your account, your profile and listings are hidden and your sessions end. We may keep limited records where the law requires.',
        ],
    },
    {
        title: 'Your rights',
        content: [
            'You can see and correct your details in your profile, delete your listings, delete your account, and withdraw consent. You can also ask us to access, correct or erase your data, or raise a grievance, by contacting us.',
        ],
    },
    {
        title: 'Security',
        content: [
            'We protect your data with encrypted connections and access controls. No system is completely secure, so please keep your phone and OTP private.',
        ],
    },
    {
        title: 'Children',
        content: [`${BRAND} is not meant for people under 18.`],
    },
    {
        title: 'Changes to this policy',
        content: ['We may update this policy. The date at the top shows the latest version, and we will tell you about important changes in the app.'],
    },
];

const TERMS = [
    {
        title: 'Acceptance',
        content: [`By using ${BRAND} you agree to these terms and to our Privacy Policy. If you do not agree, please do not use the app.`],
    },
    {
        title: 'Eligibility and account',
        content: [
            'You must be 18 or older and able to enter a legal contract in India.',
            'You sign in with your mobile number and an OTP. You are responsible for activity on your account and for keeping your OTP private.',
        ],
    },
    {
        title: 'Listing land',
        content: [
            'You may list only land you own or are authorised to sell, rent or lease.',
            'Details such as khata number, khasra number, area, price, photos and videos must be true and not misleading.',
            'Every new or edited listing is reviewed by our team. We may approve, reject, edit or remove a listing, for example if it is false, duplicate, unlawful or in the wrong district.',
            'Mark your listing as sold, rented or leased once the deal is done.',
        ],
    },
    {
        title: 'Using the app',
        content: [
            'Do not post false or fraudulent listings, harass other users, use the app to send spam, scrape data, or try to break or bypass the security of the service.',
            'Contact details of owners are for genuine enquiries only.',
        ],
    },
    {
        title: `${BRAND} is a platform`,
        content: [
            `${BRAND} only connects buyers and sellers. We are not a party to any sale, rent or lease, we are not a broker, and we do not guarantee the title, price, boundaries or legal status of any land.`,
            'Verify ownership, records and documents yourself, with a lawyer where needed, before you pay or sign anything.',
        ],
    },
    {
        title: 'Your content',
        content: [
            'You own what you upload, but you allow us to show it on the app and website to operate the service. You promise you have the right to upload it.',
        ],
    },
    {
        title: 'Suspension and deletion',
        content: [
            'We may suspend or block accounts that break these terms. You can delete your account from the app at any time.',
        ],
    },
    {
        title: 'Limitation of liability',
        content: [
            `To the extent allowed by law, ${BRAND} is not liable for losses from dealings between users, from wrong or outdated listing details, or from service interruptions. The service is provided "as is".`,
        ],
    },
    {
        title: 'Governing law',
        content: ['These terms are governed by the laws of India. Disputes are subject to the courts of the city where our registered office is located.'],
    },
    {
        title: 'Changes and contact',
        content: ['We may update these terms; using the app after an update means you accept it. For questions or complaints, use the contact details in the response or the Contact Us option in the app.'],
    },
];

const legalDocument = (type, title, sections) => (req, res) => ok(res, {
    type,
    title,
    version: VERSION,
    last_updated: LAST_UPDATED,
    sections,
    contact: contact(),
});

export const privacyPolicy = legalDocument('privacy-policy', 'Privacy Policy', PRIVACY);
export const termsAndConditions = legalDocument('terms-and-conditions', 'Terms & Conditions', TERMS);
