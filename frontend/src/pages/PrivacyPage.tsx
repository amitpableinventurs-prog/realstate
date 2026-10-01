import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage, { LegalContact, type LegalSection } from '../components/legal/LegalPage';
import { LEGAL } from '../config/legal';

const { brand } = LEGAL;

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <p>
        {brand} ({LEGAL.companyName}) runs the {brand} website and mobile app. This policy explains what personal
        data we collect, why, who can see it, and the choices and rights you have under Indian law, including the
        Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000. It forms part of our{' '}
        <Link to="/terms">Terms of Service</Link>.
      </p>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <p><strong>Account details</strong></p>
        <ul>
          <li>Name, email address, mobile number, state and district.</li>
          <li>
            Your password (website) — stored only as a secure one-way hash, never in readable form. In the app you
            sign in with a one-time password (OTP) sent to your mobile, which we also store only in hashed form
            until it is used or expires.
          </li>
          <li>Optional details such as account type (owner, agent or builder) and company name.</li>
        </ul>
        <p><strong>Property listings</strong></p>
        <ul>
          <li>
            Khata and Khasra numbers, area, price (including price per Kattha or Dismil), property type, listing
            type (sale, rent or lease), description, address, and the photos and videos you upload.
          </li>
          <li>
            The property's location (latitude and longitude) — only if you tap "Get property location" and allow
            location access. Location is optional.
          </li>
        </ul>
        <p><strong>Enquiries and site visits</strong></p>
        <ul>
          <li>The name, mobile number, email and message you give when you send an enquiry or book a visit.</li>
        </ul>
        <p><strong>Technical data</strong></p>
        <ul>
          <li>
            IP address, device and browser type, app version and server logs, used to keep the Platform secure and
            working (for example to stop repeated login attempts).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use your data',
    body: (
      <ul>
        <li>To create and secure your account, and to sign you in (including sending OTPs and verification emails).</li>
        <li>To publish your listings and show them to people searching for property.</li>
        <li>
          To send your listing to the {brand} review team for its district, and to tell you when it is approved or
          rejected.
        </li>
        <li>To connect buyers and tenants with sellers and landlords, and to arrange site visits.</li>
        <li>To prevent fraud, spam and misuse, and to meet our legal obligations.</li>
        <li>To send you service messages about your account and listings. We do not sell your data.</li>
      </ul>
    ),
  },
  {
    id: 'who-can-see',
    title: 'Who can see your data',
    body: (
      <>
        <ul>
          <li>
            <strong>Everyone:</strong> approved listings are public — including the details, photos, videos,
            location, the name or company shown on the listing and, for listings posted on the website, the
            contact phone number entered on the listing.
          </li>
          <li>
            <strong>Signed-in users:</strong> your mobile number is shown to a signed-in user who asks to contact
            you about your listing, and your name and mobile number are shared with the owner when you send an
            enquiry or book a visit.
          </li>
          <li>
            <strong>Our team:</strong> {brand} administrators, including the reviewer for your district, can see your
            listings and account details to review listings and support you.
          </li>
          <li>
            <strong>Service providers</strong> who process data for us under contract: cloud hosting and database
            providers, ImageKit (photo and video storage), Brevo (emails) and our SMS provider (OTP messages).
          </li>
          <li>
            <strong>Authorities:</strong> when required by law, a court order or a lawful request from a government
            agency.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <>
        <p>We use only what is needed to keep you signed in:</p>
        <ul>
          <li>
            A secure, httpOnly cookie that keeps your website session active (it cannot be read by other scripts).
          </li>
          <li>Your browser's local storage, which holds your sign-in token and basic profile (name and email).</li>
        </ul>
        <p>
          We do not currently use advertising or third-party analytics cookies. Clearing your browser data signs you
          out.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep data',
    body: (
      <ul>
        <li>Account data is kept while your account is open.</li>
        <li>
          Deleting your account in the app permanently deletes your profile, listings (with their photos and
          videos), saved properties and enquiries. To delete a website account, contact us.
        </li>
        <li>OTPs expire within minutes. Security logs are kept only as long as needed for security and legal purposes.</li>
        <li>We may keep limited records longer where the law requires it.</li>
      </ul>
    ),
  },
  {
    id: 'security',
    title: 'How we protect your data',
    body: (
      <p>
        Data is sent over encrypted connections (HTTPS). Passwords and OTPs are stored only as one-way hashes,
        repeated failed logins lock the account temporarily, and access for our team is limited to what each role
        needs. No system is completely secure, so please keep your password and OTPs private.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>You can:</p>
        <ul>
          <li>see and correct your details in your profile, or ask us for a summary of the data we hold about you;</li>
          <li>ask us to delete your data, or delete your app account yourself;</li>
          <li>withdraw consent — for example, turn off location access at any time in your phone settings;</li>
          <li>nominate another person to use these rights for you in case of death or incapacity;</li>
          <li>complain to our Grievance Officer, and then to the Data Protection Board of India.</li>
        </ul>
        <p>Contact us using the details below. We may need to confirm your identity first.</p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: <p>{brand} is only for people aged 18 or over. We do not knowingly collect data from children.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy. We will change the "Last updated" date above and, for important changes, tell
        you in the app, on the website or by email.
      </p>
    ),
  },
  {
    id: 'contact-us',
    title: 'Contact and grievances',
    body: <LegalContact />,
  },
];

const PrivacyPage: React.FC = () => (
  <LegalPage
    title="Privacy Policy"
    seoDescription={`How ${brand} collects, uses and protects your personal data.`}
    intro={
      <p>
        Your privacy matters to us. This policy explains, in plain language, how {brand} handles your personal
        data when you use our website and mobile app.
      </p>
    }
    sections={sections}
    related={{ to: '/terms', label: 'Read our Terms of Service' }}
  />
);

export default PrivacyPage;
