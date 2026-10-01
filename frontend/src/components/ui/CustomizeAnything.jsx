/**
 * "Customize anything" graphic for the product page hero.
 *
 * Drawn in the catalog spec-symbol style (see public/assets/spec-icons):
 * thin brown linework with one bold colored bar. Every mark is the same
 * side-profile chair with a different part called out.
 */

const LINE = '#594a42';

// Shared chair profile: back post / rear leg, seat, front leg
const Frame = () => (
  <g stroke={LINE} strokeWidth="0.6" strokeLinecap="round" fill="none">
    <path d="M4.5 1.5 V16.5" />
    <path d="M4.5 9 H13.5" />
    <path d="M13.5 9 V16.5" />
  </g>
);

const MARKS = [
  {
    key: 'finish',
    label: 'Finish',
    art: (
      <>
        <Frame />
        <rect x="3.4" y="1.2" width="2.2" height="15.6" fill="#44a099" />
        <rect x="12.4" y="9" width="2.2" height="7.8" fill="#44a099" />
      </>
    ),
  },
  {
    key: 'fabric',
    label: 'Fabric',
    art: (
      <>
        <Frame />
        <rect x="4.5" y="7" width="9.6" height="2" fill="#e25a8c" />
        <rect x="5" y="2" width="1.8" height="5.4" fill="#e25a8c" />
      </>
    ),
  },
  {
    key: 'size',
    label: 'Size',
    art: (
      <>
        <Frame />
        <rect x="15.6" y="1.5" width="1.4" height="15" fill="#5966af" />
        <path d="M14.8 1.5 H17.8 M14.8 16.5 H17.8" stroke="#5966af" strokeWidth="0.6" />
      </>
    ),
  },
  {
    key: 'details',
    label: 'Arms & Details',
    art: (
      <>
        <Frame />
        <rect x="4.5" y="4.6" width="8.4" height="1.6" fill="#5b9e43" />
        <rect x="11.6" y="4.6" width="1.3" height="4.4" fill="#5b9e43" />
      </>
    ),
  },
];

const CustomizeAnything = ({ className = '' }) => (
  <section
    aria-label="Every model can be customized"
    className={`rounded-xl border border-cream-300 bg-cream-50 p-4 sm:p-5 ${className}`}
  >
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream-800">Made to order</p>
    <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-800">Customize anything.</h2>
    <p className="mt-1 text-sm text-slate-600">
      Every model can be built your way. If you need it, just ask.
    </p>

    <ul className="mt-4 grid grid-cols-4 gap-2">
      {MARKS.map((mark) => (
        <li key={mark.key} className="flex flex-col items-center text-center gap-1.5">
          <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-white border border-cream-200">
            <svg viewBox="0 0 18 18" className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden="true">
              {mark.art}
            </svg>
          </span>
          <span className="text-xs font-medium leading-tight text-slate-700">{mark.label}</span>
        </li>
      ))}
    </ul>
  </section>
);

export default CustomizeAnything;
