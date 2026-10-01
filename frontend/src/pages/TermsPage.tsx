import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage, { LegalContact, type LegalSection } from '../components/legal/LegalPage';
import { LEGAL } from '../config/legal';

const { brand } = LEGAL;

const sections: LegalSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    body: (
      <>
        <p>
          These Terms of Service ("Terms") apply to the {brand} website and mobile app (together, the "Platform"),
          operated by {LEGAL.companyName} ("we", "us"). By creating an account or using the Platform you agree to
          these Terms and to our <Link to="/privacy">Privacy Policy</Link>. If you do not agree, please do not use
          the Platform.
        </p>
        <p>
          {brand} is an online marketplace where property owners, agents and builders list land and property for
          sale, rent or lease, and where buyers and tenants can find and contact them. We are not a party to any
          deal made between users and do not act as anyone's broker or agent unless we say so in writing.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Your account',
    body: (
      <>
        <ul>
          <li>You must be at least 18 years old and able to enter into a binding contract under Indian law.</li>
          <li>
            Give true and complete details when you sign up — your name, email, mobile number, state and district —
            and keep them up to date.
          </li>
          <li>
            You are responsible for everything done through your account. Keep your password and the one-time
            passwords (OTPs) we send you private, and tell us straight away if you think someone else has used
            your account.
          </li>
          <li>One person may hold one account. Accounts may not be sold or transferred.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'listings',
    title: 'Listing a property',
    body: (
      <>
        <p>When you list a property you confirm that:</p>
        <ul>
          <li>you own it, or are authorised in writing by the owner to list it;</li>
          <li>
            the details are true and not misleading, including the Khata and Khasra numbers, area, price,
            location, photos, videos and description;
          </li>
          <li>you have the right to upload the photos and videos, and they show the actual property.</li>
        </ul>
        <p>
          If you enter a price per unit (for example per Kattha or per Dismil), the Platform works out the total
          price from the area you enter. Please check that the total shown is correct.
        </p>
        <p>
          Listings are reviewed by the {brand} team for the district you choose, before or after they go live. We
          may approve, reject or remove any listing — for example if it is incomplete,
          duplicated, misleading, unlawful or breaks these Terms — and we may tell you the reason. Website
          listings expire automatically 45 days after they are posted unless renewed.
        </p>
        <p>
          You keep ownership of your content. You give us a free, non-exclusive licence to host, display, resize and
          share it on the Platform and in our promotion of your listing, for as long as the listing is on the
          Platform.
        </p>
      </>
    ),
  },
  {
    id: 'verification',
    title: 'Land records and due diligence',
    body: (
      <>
        <p>
          Unless a listing shows a "Verified" badge, {brand} has <strong>not</strong> checked the Khata, Khasra,
          ownership or any other land record details with government records. Even a verified listing is only
          checked to the extent we describe at the time.
        </p>
        <p>
          Before paying any money or signing any agreement, buyers and tenants must do their own checks — for
          example title and ownership documents, encumbrance, mutation records, land use, approvals and, where it
          applies, RERA registration — and take independent legal advice. Never pay advance money to anyone you
          have not verified.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Enquiries, contact details and site visits',
    body: (
      <>
        <p>
          When you send an enquiry, request a seller's contact details or book a site visit, we share the details
          needed for that — such as your name and mobile number — with the other user. Use other users' details
          only to discuss the property concerned. Sending spam, unwanted marketing or harassment is not allowed.
        </p>
        <p>
          Any negotiation, payment, agreement or registration happens directly between the users. {brand} is not
          responsible for it.
        </p>
      </>
    ),
  },
  {
    id: 'conduct',
    title: 'What you must not do',
    body: (
      <ul>
        <li>List property you have no right to sell, rent or lease, or post fake or duplicate listings.</li>
        <li>Upload content that is false, offensive, discriminatory, or infringes someone else's rights.</li>
        <li>Use the Platform for fraud, money laundering or any activity that is illegal in India.</li>
        <li>Copy or scrape listings or user data, or use bots or automated tools without our written permission.</li>
        <li>Try to break, overload or get around the security of the Platform or other users' accounts.</li>
      </ul>
    ),
  },
  {
    id: 'fees',
    title: 'Fees',
    body: (
      <p>
        If we charge for any service (for example featured listings), the price and terms will be shown to you
        before you pay. We may change prices for future purchases with prior notice on the Platform.
      </p>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension and closing accounts',
    body: (
      <>
        <p>
          We may suspend or close an account, or remove its listings, if it breaks these Terms or the law, if we
          receive a valid complaint or order, or to protect other users. Where reasonable we will tell you why.
        </p>
        <p>
          You can stop using the Platform at any time. In the app you can delete your account from your profile;
          this also deletes your listings, saved properties and enquiries. For the website, contact us using the
          details below.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Disclaimers and limitation of liability',
    body: (
      <>
        <p>
          The Platform is provided "as is". Listing information comes from users, and we do not guarantee that it
          is accurate, complete or up to date, or that a property is available.
        </p>
        <p>
          To the extent allowed by law, {brand} is not liable for any loss arising from deals between users, from
          relying on listing information, or from the Platform being unavailable. Our total liability for any claim
          is limited to the amount you paid us, if any, in the 12 months before the claim.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these Terms from time to time. We will change the "Last updated" date above and, for
        important changes, tell you in the app, on the website or by email. Continuing to use the Platform after a
        change means you accept the updated Terms.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law and disputes',
    body: (
      <p>
        These Terms are governed by the laws of India. Please contact us first so we can try to resolve any
        dispute. If it cannot be resolved, the courts at {LEGAL.courtsCity} will have exclusive jurisdiction.
      </p>
    ),
  },
  {
    id: 'contact-us',
    title: 'Contact and grievances',
    body: <LegalContact />,
  },
];

const TermsPage: React.FC = () => (
  <LegalPage
    title="Terms of Service"
    seoDescription={`The rules for using ${brand} to list, find, buy, rent and lease land and property.`}
    intro={
      <p>
        Please read these terms carefully. They explain your rights and responsibilities when you use {brand} to
        list or find land and property.
      </p>
    }
    sections={sections}
    related={{ to: '/privacy', label: 'Read our Privacy Policy' }}
  />
);

export default TermsPage;
