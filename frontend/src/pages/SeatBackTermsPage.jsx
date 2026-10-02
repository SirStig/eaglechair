import { Link } from 'react-router-dom';
import { SEO } from '../config/seoConfig';
import KnowledgePageLayout from '../components/knowledge/KnowledgePageLayout';

// Model-code letters are the ones documented in our price lists and catalog captions.
const MODEL_CODE = [
  { code: 'A', meaning: 'Armchair version of the model.' },
  { code: 'P', meaning: 'Padded (upholstered) seat.' },
  { code: 'V', meaning: 'Scooped veneer seat.' },
  { code: 'W', meaning: 'Wood seat.' },
  { code: 'R', meaning: 'Rush seat.' },
  { code: '-24 / -26', meaning: 'Counter height barstool.' },
  { code: '-30', meaning: 'Bar height barstool.' },
];

const SECTIONS = [
  {
    id: 'seats',
    title: 'Seats',
    terms: [
      { term: 'Padded seat', text: 'A foam seat covered in vinyl, fabric or leather. Shown as "P" in the model number.' },
      { term: 'Wood seat', text: 'A solid wood seat in the frame finish. Shown as "W".' },
      { term: 'Scooped veneer seat', text: 'A formed veneer seat shaped for comfort. Shown as "V".' },
      {
        term: 'Cane & rush seats',
        text: 'Woven natural seats. Our warranty does not cover cane or rush, and we do not recommend them for commercial use.',
      },
    ],
  },
  {
    id: 'backs',
    title: 'Backs',
    terms: [
      { term: 'Ladder back', text: 'Horizontal slats between the back posts.' },
      { term: 'Spindle back', text: 'Vertical turned spindles between the back posts.' },
      { term: 'X-back (cross back)', text: 'Two crossed members forming an X between the back posts.' },
      { term: 'Upholstered back', text: 'A padded back, fully or partly covered in the seat material.' },
      { term: 'Outside back', text: 'The rear face of a booth or upholstered back. Booth circles and banquettes come standard with an unfinished outside back — specify a finished one if it will be seen.' },
    ],
  },
  {
    id: 'frame',
    title: 'Frame',
    terms: [
      { term: 'Seat rail', text: 'The frame members directly under the seat that the legs join into.' },
      { term: 'Stretcher', text: 'A bar connecting two legs below the seat.' },
      { term: 'Corner block', text: 'A block fastened inside the seat-rail corners to reinforce the joint.' },
      { term: 'Glide', text: 'The foot pad on the bottom of each leg. Replace missing glides promptly — see Hardware & Bases.' },
      { term: 'Footring', text: 'The ring or rail on a barstool for resting feet.' },
    ],
  },
  {
    id: 'upholstery',
    title: 'Upholstery',
    terms: [
      { term: 'COM (Customer’s Own Material)', text: 'Fabric or vinyl you supply. We need a sample first and the material shipped prepaid; the order is scheduled once it arrives.' },
      { term: 'COL (Customer’s Own Leather)', text: 'Same conditions as COM, with a 10% upcharge over COM pricing.' },
      { term: 'Railroading', text: 'Which way a fabric runs on the seat. The term is used loosely, so tell us the direction your pattern should run.' },
      { term: 'Yardage', text: 'How much material an item needs. Allow about 20% extra for stripes, plaids or large patterns.' },
      { term: 'Foam', text: 'Every upholstered seat and back uses high-density foam meeting California TB 117-2013. Tell us before ordering if you need another standard, such as CAL 133.' },
    ],
  },
  {
    id: 'dimensions',
    title: 'Dimensions',
    terms: [
      { term: 'Architectural dimensions', text: 'Width and depth are listed as the space the item takes in an installation, not the size of a single part.' },
      { term: 'Tolerance', text: 'Dimensions in our literature are approximate. Fabric build-up can change widths by up to 3/4".' },
      { term: 'Arm & seat dimensions', text: 'Listed as actual measurements, within the tolerance above.' },
    ],
  },
];

const SeatBackTermsPage = () => (
  <KnowledgePageLayout
    pageKey="terms"
    seo={SEO.pages.seatBackTerms}
    title="Seat & Back Terms"
    subtitle="How to read an Eagle Chair model number, and the terms we use on quotes and spec sheets."
  >
    <section className="bg-white rounded-lg border border-cream-200 p-5 sm:p-8">
      <h2 className="text-2xl font-bold text-slate-800">Reading a model number</h2>
      <p className="text-slate-600 mt-2 mb-5 max-w-3xl">
        The four-digit number is the model. Letters and numbers after it describe the version — for example,{' '}
        <span className="font-mono text-slate-800">6308P</span> is model 6308 with a padded seat, and a barstool
        number ending in <span className="font-mono text-slate-800">-30</span> is bar height.
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        {MODEL_CODE.map((c) => (
          <div key={c.code} className="flex gap-4 items-baseline">
            <dt className="font-mono font-semibold text-primary-700 w-24 flex-shrink-0">{c.code}</dt>
            <dd className="text-slate-700">{c.meaning}</dd>
          </div>
        ))}
      </dl>
    </section>

    <nav aria-label="On this page" className="flex flex-wrap gap-x-6 gap-y-2 my-8 text-sm">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="text-primary-600 hover:text-primary-700 font-medium">
          {s.title}
        </a>
      ))}
    </nav>

    <div className="space-y-10">
      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">{s.title}</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {s.terms.map((t) => (
              <div key={t.term} className="bg-white border border-cream-200 rounded-lg p-5">
                <dt className="font-semibold text-slate-800">{t.term}</dt>
                <dd className="text-slate-600 mt-1">{t.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>

    <p className="mt-10 text-sm text-slate-600">
      Full terms of sale, warranty and care are in{' '}
      <Link to="/general-information" className="text-primary-600 hover:text-primary-700 font-medium">
        General Information
      </Link>
      .
    </p>
  </KnowledgePageLayout>
);

export default SeatBackTermsPage;
