import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Property from '../models/propertyModel.js';
import Appointment from '../models/appointmentModel.js';
import User from '../models/userModel.js';
import BlogPost from '../models/blogPostModel.js';
import Job from '../models/jobModel.js';
import JobApplication from '../models/jobApplicationModel.js';
import { slugify } from '../utils/slugify.js';

// Demo data for local development: website properties (managed in the admin
// panel, shown on the website), a demo user with a few viewing appointments,
// blog posts, and job openings with sample applications.
// Safe to re-run — previous demo records are replaced, nothing else is touched.
//   npm run seed:demo

dotenv.config({ path: './.env.local' });
dotenv.config({ path: './.env' });

const DEMO_PHONE = '+91 98765 43210';
const DEMO_USER = { name: 'Demo User', email: 'demo@bhumibazar.test', password: 'Demo@12345' };

const img = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80`;
const mapLink = (place) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

const PROPERTIES = [
  {
    title: 'Sea-View 3BHK Apartment in Bandra West',
    location: 'Bandra West, Mumbai',
    price: 42500000, beds: 3, baths: 3, sqft: 1650, type: 'Apartment', availability: 'buy',
    description: 'Bright corner apartment on a high floor with an unobstructed sea view, modular kitchen and two balconies. Five minutes from Carter Road promenade.',
    amenities: ['Parking', 'Gym', 'Swimming Pool', 'Security', 'Lift', 'Power Backup', 'Balcony'],
    image: [img('1522708323590-d24dbb6b0267'), img('1502672260266-1c1ef2d93688'), img('1560448204-e02f11c3d0e2')],
  },
  {
    title: 'Modern 2BHK Near Thane Station',
    location: 'Naupada, Thane',
    price: 13500000, beds: 2, baths: 2, sqft: 980, type: 'Apartment', availability: 'buy',
    description: 'Ready-to-move 2BHK in a gated society, a short walk from Thane station and Viviana Mall. Vastu compliant with covered parking.',
    amenities: ['Parking', 'Security', 'Lift', 'Gated Community', 'Children Play Area', 'CCTV Surveillance'],
    image: [img('1545324418-cc1a3fa10c00'), img('1493809842364-78817add7ffb')],
  },
  {
    title: 'Furnished 1BHK for Rent in Powai',
    location: 'Hiranandani Gardens, Powai, Mumbai',
    price: 38000, beds: 1, baths: 1, sqft: 620, type: 'Apartment', availability: 'rent',
    description: 'Fully furnished 1BHK with lake-facing windows, ideal for working professionals. Monthly rent; 11-month agreement, 2 months deposit.',
    amenities: ['Parking', 'Gym', 'Swimming Pool', 'Security', 'Lift', 'Wi-Fi'],
    image: [img('1502672260266-1c1ef2d93688'), img('1522708323590-d24dbb6b0267')],
  },
  {
    title: 'Independent Bungalow with Garden in Nashik',
    location: 'Gangapur Road, Nashik',
    price: 21000000, beds: 4, baths: 4, sqft: 3200, type: 'House', availability: 'buy',
    description: 'Spacious independent bungalow on a 5,000 sq. ft. plot with a landscaped garden, terrace and servant quarters, close to the vineyards.',
    amenities: ['Parking', 'Garden', 'Security', 'Power Backup', 'Balcony', 'Water Supply 24/7'],
    image: [img('1568605114967-8130f3a36994'), img('1570129477492-45c003edd2be'), img('1564013799919-ab600027ffc6')],
  },
  {
    title: 'Luxury Villa with Private Pool in Lonavala',
    location: 'Tungarli, Lonavala',
    price: 68000000, beds: 5, baths: 6, sqft: 5400, type: 'Villa', availability: 'buy',
    description: 'Hill-view weekend villa with a private infinity pool, home theatre and a large deck. Two hours from Mumbai and Pune.',
    amenities: ['Swimming Pool', 'Parking', 'Garden', 'Security', 'Home Theater', 'Power Backup', 'CCTV Surveillance'],
    image: [img('1613490493576-7fde63acd811'), img('1613977257363-707ba9348227'), img('1600596542815-ffad4c1539a9')],
  },
  {
    title: 'Contemporary Villa in Whitefield',
    location: 'Whitefield, Bengaluru',
    price: 34500000, beds: 4, baths: 4, sqft: 3600, type: 'Villa', availability: 'buy',
    description: 'Gated-community villa near ITPL with a double-height living room, private garden and clubhouse access.',
    amenities: ['Clubhouse', 'Swimming Pool', 'Gym', 'Gated Community', 'Garden', 'Parking', 'Security'],
    image: [img('1600585154340-be6161a56a0c'), img('1600607687939-ce8a6c25118c'), img('1600566753190-17f0baa2a6c3')],
  },
  {
    title: 'Family House for Rent in Koregaon Park',
    location: 'Koregaon Park, Pune',
    price: 85000, beds: 3, baths: 3, sqft: 2100, type: 'House', availability: 'rent',
    description: 'Semi-furnished independent house on a quiet lane with a garden and two covered parking spots. Monthly rent; family preferred.',
    amenities: ['Parking', 'Garden', 'Security', 'Power Backup', 'Balcony'],
    image: [img('1580587771525-78b9dba3b914'), img('1570129477492-45c003edd2be')],
  },
  {
    title: 'Premium Office Space in BKC',
    location: 'Bandra Kurla Complex, Mumbai',
    price: 450000, beds: 0, baths: 2, sqft: 2800, type: 'Office', availability: 'rent',
    description: 'Plug-and-play Grade-A office with 40 workstations, two cabins, a conference room and pantry. Monthly rent.',
    amenities: ['Parking', 'Security', 'Lift', 'Power Backup', 'Air Conditioning', 'CCTV Surveillance', 'Wi-Fi'],
    image: [img('1497366216548-37526070297c'), img('1486406146926-c627a92ad1ab')],
  },
  {
    title: 'Commercial Office Floor in Cyber City',
    location: 'DLF Cyber City, Gurugram',
    price: 95000000, beds: 0, baths: 4, sqft: 6500, type: 'Office', availability: 'buy',
    description: 'Full office floor in a leased-out tower with metro connectivity. Good rental yield for investors.',
    amenities: ['Parking', 'Security', 'Lift', 'Power Backup', 'Fire Safety', 'Air Conditioning'],
    image: [img('1486406146926-c627a92ad1ab'), img('1497366216548-37526070297c')],
  },
  {
    title: '3BHK Apartment in Satellite',
    location: 'Satellite, Ahmedabad',
    price: 9800000, beds: 3, baths: 2, sqft: 1450, type: 'Apartment', availability: 'buy',
    description: 'Well-ventilated 3BHK in a mature society with a clubhouse and garden, close to schools and SG Highway.',
    amenities: ['Parking', 'Clubhouse', 'Garden', 'Security', 'Lift', 'Children Play Area'],
    image: [img('1574362848149-11496d93a7c7'), img('1560448204-e02f11c3d0e2')],
  },
  {
    title: '2BHK Builder Floor for Rent in Saket',
    location: 'Saket, New Delhi',
    price: 42000, beds: 2, baths: 2, sqft: 1100, type: 'House', availability: 'rent',
    description: 'Second-floor builder floor with a private terrace, walking distance from Saket metro and malls. Monthly rent.',
    amenities: ['Parking', 'Security', 'Power Backup', 'Balcony'],
    image: [img('1605276374104-dee2a0ed3cd6'), img('1493809842364-78817add7ffb')],
  },
  {
    title: 'Farmhouse with Open Land near Karjat',
    location: 'Karjat, Raigad',
    price: 18500000, beds: 3, baths: 3, sqft: 2400, type: 'House', availability: 'buy',
    description: 'Farmhouse on 1 acre of open land with mango trees, a borewell and river access. Clear title, ideal weekend home.',
    amenities: ['Parking', 'Garden', 'Water Supply 24/7', 'Security'],
    image: [img('1500382017468-9049fed747ef'), img('1416331108676-a22ccb276e35')],
  },
];

const BLOG_POSTS = [
  {
    title: '7 Documents to Check Before Buying Land in India',
    category: 'Buying Guide',
    tags: ['land', 'documents', 'khata', 'khasra'],
    isFeatured: true,
    coverImage: img('1500382017468-9049fed747ef'),
    excerpt: 'Title deed, Khata, Khasra, encumbrance certificate and more: the paperwork that protects you before you pay a single rupee for a plot.',
    content: `Buying land is one of the biggest financial decisions most families make, and the paperwork matters as much as the location. Before you sign an agreement or pay a token amount, make sure you have seen and verified these documents.

## 1. Title deed (sale deed)
The title deed proves who owns the land today. Trace the chain of ownership back at least 30 years so you know every previous transfer was legal.

## 2. Khata and Khasra numbers
The Khata number identifies the owner's account in the revenue records, and the Khasra number identifies the specific plot. Match both against the seller's documents and the land records portal of your state.

## 3. Encumbrance certificate
This certificate shows whether the land has any registered loan, mortgage or legal dues. Ask for one covering at least the last 13 years.

## 4. Mutation records
Mutation updates the revenue records after a sale or inheritance. If the seller's name is not in the mutation register, the transfer to them may not be complete.

## 5. Land use and conversion
Agricultural land may need conversion (NA permission) before you can build a house. Check the approved land use in the development plan.

## 6. Survey map and boundaries
Get the survey map and walk the boundaries on site. Fencing that does not match the map is a common source of disputes.

## 7. Tax receipts
Up-to-date property tax receipts show there are no pending dues with the local body.

## Before you pay
- Verify documents with the sub-registrar office or a property lawyer
- Never pay the full amount before registration
- Keep copies of everything the seller gives you

On Bhumi Bazar, listings with a Verified badge have had their land records checked by our team, but an independent legal check is always worth the small cost.`,
  },
  {
    title: 'Khata vs Khasra: What Do These Land Record Terms Mean?',
    category: 'Land Records',
    tags: ['khata', 'khasra', 'land records'],
    coverImage: img('1416331108676-a22ccb276e35'),
    excerpt: 'Two numbers appear on almost every land listing in India. Here is what each one tells you, and why you should verify both.',
    content: `If you have looked at land listings in India, you have seen the terms Khata and Khasra. They sound similar but describe different things.

## Khasra number: the plot
A Khasra number is the survey number given to a specific piece of land in a village map. It tells you where the plot is and its boundaries. When a plot is divided, you will often see numbers like 123/2.

## Khata number: the owner's account
A Khata number identifies the account of the owner or family in the revenue records. One Khata can include several Khasra plots owned by the same people.

## Why both matter
- The Khasra confirms you are buying the plot you visited
- The Khata confirms the seller is the recorded owner
- Mismatches between the two are a warning sign

## How to verify
Most states publish land records online. Search using the district, village and Khasra number, then check that the owner's name matches the seller. When in doubt, visit the local tehsil office.

Every land listing on Bhumi Bazar shows both numbers so you can check them before you call the seller.`,
  },
  {
    title: 'Home Loan Checklist for First-Time Buyers',
    category: 'Finance',
    tags: ['home loan', 'EMI', 'first-time buyer'],
    coverImage: img('1560448204-e02f11c3d0e2'),
    excerpt: 'How much you can borrow, what banks look at and the documents to keep ready, so your loan approval does not hold up your purchase.',
    content: `A pre-approved home loan makes you a stronger buyer: sellers take you seriously and you know your real budget.

## How much can you borrow?
Banks usually cap your EMI at around 40-50% of your monthly take-home income, after existing EMIs. Use an EMI calculator with a few interest rates to see what fits.

## What lenders look at
- Credit score (750+ gets the best rates)
- Stable income and employment history
- Existing loans and credit card dues
- The property's legal and technical valuation

## Documents to keep ready
- PAN, Aadhaar and address proof
- Last 6 months of salary slips and bank statements
- Form 16 or ITRs for the last 2-3 years
- Property documents once you finalise a home

## Tips
- Compare the total cost, not just the interest rate: processing fees and insurance add up
- A larger down payment lowers both your EMI and interest paid
- Keep your credit utilisation low in the months before you apply`,
  },
  {
    title: 'Renting vs Buying in Mumbai: How to Decide',
    category: 'Market Insights',
    tags: ['Mumbai', 'rent', 'buy'],
    coverImage: img('1502672260266-1c1ef2d93688'),
    excerpt: 'Rental yields in Mumbai are low, but buying ties up capital. A simple way to compare both options for your situation.',
    content: `In Mumbai, the monthly rent for a flat is often a small fraction of what the EMI on the same flat would be. That makes the rent-or-buy question less obvious than it seems.

## When renting makes sense
- You may move cities or neighbourhoods within 3-5 years
- You would rather keep your savings invested elsewhere
- You want to live in an area you could not afford to buy in

## When buying makes sense
- You plan to stay for 7-10 years or more
- You have a stable income and an emergency fund after the down payment
- You value the security of owning your home

## A quick comparison
Add up the down payment, stamp duty, registration and interiors. Compare the EMI plus maintenance with the rent you would pay. Then consider what the down payment could earn if invested instead.

There is no single right answer, but running the numbers for your own situation usually makes the choice clear.`,
  },
  {
    title: 'Why Verified Listings Save You Time',
    category: 'Bhumi Bazar',
    tags: ['verified', 'safety'],
    coverImage: img('1600585154340-be6161a56a0c'),
    excerpt: 'What the Verified badge on Bhumi Bazar means, what we check and how it helps you shortlist faster.',
    content: `Listings with a Verified badge have had their key details reviewed by the Bhumi Bazar team.

## What we check
- The owner's identity and phone number
- Khata and Khasra numbers against the land records
- Photos taken at the actual property

## What it does not replace
A Verified badge is a strong first filter, but it is not a legal opinion. For any purchase, have the title checked by a lawyer before you pay.

## How to find them
Use the Verified filter on search, or look for the green badge on listing photos.`,
  },
  {
    title: 'Agricultural Land Lease: What Owners Should Put in the Agreement',
    category: 'Legal',
    tags: ['lease', 'agriculture', 'agreement'],
    coverImage: img('1500382017468-9049fed747ef'),
    excerpt: 'Duration, rent revisions, water use and exit terms: the clauses that avoid disputes when leasing farmland.',
    content: `Leasing out farmland can provide steady income, but a vague agreement causes most disputes.

## Key clauses
- Lease duration and renewal terms
- Rent amount, payment schedule and yearly revision
- Who pays for water, electricity and repairs
- Permitted crops and use of chemicals
- What happens to standing crops when the lease ends

## Registration
Leases for longer than a year generally need to be registered. Check the rules and stamp duty in your state.

## Before signing
Verify the tenant's identity, keep photos of the land's condition, and have a local lawyer review the agreement.`,
  },
  {
    title: 'Upcoming Infrastructure Projects Around Pune (Draft)',
    category: 'Market Insights',
    tags: ['Pune', 'infrastructure'],
    status: 'draft',
    coverImage: img('1486406146926-c627a92ad1ab'),
    excerpt: 'A draft post to show that unpublished articles stay hidden from the website.',
    content: 'Draft content — not visible on the website until published from the admin panel.',
  },
];

const JOBS = [
  {
    title: 'Field Sales Executive',
    department: 'Sales',
    location: 'Thane, Maharashtra',
    employmentType: 'full_time', workMode: 'onsite',
    experience: '1-3 years', salaryRange: '₹3.5-5 LPA + incentives',
    summary: 'Meet land owners and buyers, arrange site visits and help close deals across Thane and Kalyan.',
    description: 'You will be the face of Bhumi Bazar on the ground, building relationships with land owners, brokers and buyers.',
    responsibilities: ['Onboard land and property owners onto the platform', 'Arrange and accompany buyers on site visits', 'Follow up on enquiries and close deals', 'Share market feedback with the product team'],
    requirements: ['1-3 years in real estate or field sales', 'Fluent in Marathi and Hindi', 'Two-wheeler and valid driving licence', 'Comfortable with smartphone apps'],
  },
  {
    title: 'React Native Developer',
    department: 'Engineering',
    location: 'Remote (India)',
    employmentType: 'full_time', workMode: 'remote',
    experience: '2-5 years', salaryRange: '₹12-20 LPA',
    summary: 'Build the Bhumi Bazar mobile app: OTP login, property registration with photos and videos, search and saved listings.',
    description: 'Join a small team shipping the app used by owners, buyers and tenants every day.',
    responsibilities: ['Build and ship features in React Native', 'Integrate REST APIs and handle offline states', 'Improve app performance and crash-free rate', 'Publish releases to Play Store and App Store'],
    requirements: ['2+ years of React Native in production', 'Strong TypeScript', 'Experience with camera, media upload and location APIs', 'Good eye for UI detail'],
  },
  {
    title: 'Backend Engineer (Node.js)',
    department: 'Engineering',
    location: 'Pune, Maharashtra',
    employmentType: 'full_time', workMode: 'hybrid',
    experience: '3-6 years', salaryRange: '₹15-25 LPA',
    summary: 'Own the APIs behind listings, search, enquiries and OTP login on Node.js and MongoDB.',
    description: 'You will design and scale the services that power the Bhumi Bazar app and website.',
    responsibilities: ['Design and build REST APIs in Node.js/Express', 'Model data in MongoDB and optimise queries', 'Integrate SMS, storage and payment providers', 'Write tests and review code'],
    requirements: ['3+ years with Node.js in production', 'Solid MongoDB knowledge', 'Understanding of auth, rate limiting and API security', 'Experience with cloud deployments'],
  },
  {
    title: 'Land Verification Officer',
    department: 'Operations',
    location: 'Nashik, Maharashtra',
    employmentType: 'full_time', workMode: 'onsite',
    experience: '2-4 years', salaryRange: '₹4-6 LPA',
    summary: 'Verify Khata/Khasra records, ownership and site photos so listings can earn the Verified badge.',
    description: 'Accuracy is everything in this role: buyers rely on your checks.',
    responsibilities: ['Check land records on state portals and at tehsil offices', 'Visit sites to confirm boundaries and photos', 'Flag disputes, encumbrances and mismatches', 'Maintain verification reports'],
    requirements: ['Knowledge of Maharashtra land records (7/12, Khata, Khasra)', 'Experience in revenue, legal or real estate work', 'Attention to detail', 'Willingness to travel within the district'],
  },
  {
    title: 'Customer Support Associate',
    department: 'Customer Success',
    location: 'Mumbai, Maharashtra',
    employmentType: 'part_time', workMode: 'hybrid',
    experience: '0-2 years', salaryRange: '₹15-20k / month',
    summary: 'Help buyers and owners over phone and chat with listings, enquiries and account questions.',
    description: 'A great starting role for graduates who enjoy helping people.',
    responsibilities: ['Answer calls and chats from users', 'Guide owners through listing a property', 'Escalate issues to the right team', 'Log feedback for product improvements'],
    requirements: ['Good communication in Hindi, Marathi and English', 'Patient and friendly', 'Basic computer skills'],
  },
  {
    title: 'Marketing Intern',
    department: 'Marketing',
    location: 'Mumbai, Maharashtra',
    employmentType: 'internship', workMode: 'hybrid',
    experience: 'Fresher', salaryRange: '₹10k / month stipend',
    summary: 'Closed position — shown to demonstrate closed jobs.',
    status: 'closed',
    responsibilities: ['Social media content', 'Campaign reporting'],
    requirements: ['Pursuing or completed a degree in marketing or media'],
  },
];

const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date;
};

const seed = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data in production');
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Replace previous demo run
  const titles = PROPERTIES.map((p) => p.title);
  const oldIds = (await Property.find({ title: { $in: titles }, phone: DEMO_PHONE }).select('_id')).map((p) => p._id);
  await Appointment.deleteMany({ propertyId: { $in: oldIds } });
  await Property.deleteMany({ _id: { $in: oldIds } });

  // Stagger createdAt so "newest first" sorting looks natural
  const now = Date.now();
  const properties = await Property.insertMany(PROPERTIES.map((p, i) => ({
    ...p,
    phone: DEMO_PHONE,
    googleMapLink: mapLink(p.location),
    status: 'active',
    createdAt: new Date(now - i * 26 * 60 * 60 * 1000),
    updatedAt: new Date(now - i * 26 * 60 * 60 * 1000),
  })));
  console.log(`Inserted ${properties.length} properties`);

  const user = await User.findOneAndUpdate(
    { email: DEMO_USER.email },
    {
      name: DEMO_USER.name,
      email: DEMO_USER.email,
      password: await bcrypt.hash(DEMO_USER.password, 12),
      isEmailVerified: true,
      status: 'active',
      failedLoginAttempts: 0,
      $unset: { lockUntil: '' },
    },
    { upsert: true, new: true }
  );

  const appointments = await Appointment.insertMany([
    { propertyId: properties[0]._id, userId: user._id, date: daysFromNow(2), time: '11:00', status: 'pending', notes: 'Would like to see the sea view in the morning.' },
    { propertyId: properties[4]._id, userId: user._id, date: daysFromNow(5), time: '16:30', status: 'confirmed', notes: 'Weekend visit with family.', meetingPlatform: 'google-meet', meetingLink: 'https://meet.google.com/abc-defg-hij' },
    { propertyId: properties[2]._id, userId: user._id, date: daysFromNow(-3), time: '18:00', status: 'completed', notes: 'Checked furnishing and society rules.' },
    { propertyId: properties[1]._id, guestInfo: { name: 'Priya Sharma', email: 'priya.sharma@example.com', phone: '+91 91234 56789' }, date: daysFromNow(1), time: '10:30', status: 'pending', notes: 'First-time buyer, needs loan guidance.' },
    { propertyId: properties[7]._id, guestInfo: { name: 'Rahul Mehta', email: 'rahul.mehta@example.com', phone: '+91 99887 66554' }, date: daysFromNow(-1), time: '15:00', status: 'cancelled', notes: 'Looking for 30+ seats.', cancelReason: 'Client postponed office move.' },
  ]);
  console.log(`Inserted ${appointments.length} appointments (demo user: ${DEMO_USER.email} / ${DEMO_USER.password})`);

  // Blog — replace posts with the same slugs
  const posts = BLOG_POSTS.map((p, i) => {
    const date = new Date(now - (i * 4 + 1) * 24 * 60 * 60 * 1000);
    return {
      ...p,
      slug: slugify(p.title),
      authorName: p.authorName || 'Bhumi Bazar Team',
      status: p.status || 'published',
      publishedAt: (p.status || 'published') === 'published' ? date : undefined,
      views: 40 + ((i * 37) % 200),
      createdAt: date,
      updatedAt: date,
    };
  });
  await BlogPost.deleteMany({ slug: { $in: posts.map((p) => p.slug) } });
  await BlogPost.insertMany(posts);
  console.log(`Inserted ${posts.length} blog posts`);

  // Careers — replace jobs with the same slugs (and their applications)
  const jobs = JOBS.map((j, i) => {
    const date = new Date(now - (i * 3 + 2) * 24 * 60 * 60 * 1000);
    return { ...j, slug: slugify(`${j.title} ${j.location}`), status: j.status || 'open', createdAt: date, updatedAt: date };
  });
  const oldJobIds = (await Job.find({ slug: { $in: jobs.map((j) => j.slug) } }).select('_id')).map((j) => j._id);
  await JobApplication.deleteMany({ job: { $in: oldJobIds } });
  await Job.deleteMany({ _id: { $in: oldJobIds } });
  const insertedJobs = await Job.insertMany(jobs);

  const applications = [
    { job: insertedJobs[1], name: 'Ankit Verma', email: 'ankit.verma@example.com', phone: '+91 98200 11223', resumeLink: 'https://drive.google.com/file/d/demo-ankit/view', linkedinUrl: 'https://www.linkedin.com/in/ankit-verma-demo', experienceYears: 3, coverLetter: 'I have shipped two React Native apps with media upload and maps.', status: 'shortlisted' },
    { job: insertedJobs[0], name: 'Sneha Patil', email: 'sneha.patil@example.com', phone: '+91 97300 44556', resumeLink: 'https://drive.google.com/file/d/demo-sneha/view', experienceYears: 2, coverLetter: 'Two years selling plots in Kalyan-Dombivli.', status: 'new' },
    { job: insertedJobs[2], name: 'Rohan Kulkarni', email: 'rohan.k@example.com', phone: '+91 99220 77889', resumeLink: 'https://www.dropbox.com/s/demo-rohan/resume.pdf', experienceYears: 5, status: 'reviewing' },
  ];
  await JobApplication.insertMany(applications.map((a) => ({ ...a, job: a.job._id, jobTitle: a.job.title })));
  for (const job of insertedJobs) {
    job.applications = applications.filter((a) => a.job === job).length;
    await job.save();
  }
  console.log(`Inserted ${insertedJobs.length} jobs and ${applications.length} applications`);
};

seed()
  .catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
