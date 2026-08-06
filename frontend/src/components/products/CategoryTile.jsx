import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFitText } from '../../hooks/useFitText';

// Allow a wrap after a slash so "Booths/Banquettes" breaks as "Booths/" +
// "Banquettes" instead of mid-word when the column is narrow.
const withSoftBreaks = (text) => (text || '').replace(/\//g, '/\u200B');

/**
 * CategoryTile
 *
 * One full-bleed category column, shared by the Products dropdown and the
 * home page product grid so both stay in step.
 *
 * The heading auto-fits its column: with five columns on a laptop screen a
 * fixed heading size overflows and gets clipped, so the size is measured
 * down to whatever fits on at most two lines. Link sizing and padding step
 * down as the columns get narrower.
 */
const CategoryTile = ({
  title,
  href,
  imageUrl,
  fallbackImage,
  links = [],
  viewAllLabel,
  viewAllHref,
  columns = 4,
  heightClassName = 'h-[550px] sm:h-[650px] lg:h-[700px]',
  backgroundClassName = 'bg-dark-900',
  eager = false,
  onLinkClick,
}) => {
  const [loaded, setLoaded] = useState(false);
  const isNarrow = columns >= 5;

  const { ref: titleRef, fontSize, lineHeight } = useFitText(title, {
    min: 15,
    max: isNarrow ? 26 : 30,
    maxLines: 2,
  });

  // Long category names make this the widest line in the column, so it fits
  // itself too - over at most two lines, with the arrow glued to the last word
  // by a non-breaking space so it is never orphaned on a row of its own.
  const { ref: viewAllRef, fontSize: viewAllFontSize } = useFitText(viewAllLabel, {
    min: 11,
    max: isNarrow ? 14 : 16,
    maxLines: 2,
  });

  const linkClass = `block w-full text-left px-2 text-white transition-all duration-200 hover:translate-x-2 [text-shadow:0_0_12px_rgba(0,0,0,0.9),0_0_4px_rgba(0,0,0,0.8),0_1px_3px_rgba(0,0,0,0.9)] ${
    isNarrow ? 'py-2 text-sm' : 'py-3 text-base'
  }`;

  return (
    <div className="relative group">
      <div className={`relative overflow-hidden ${heightClassName}`}>
        <Link to={href} className={`absolute inset-0 block ${backgroundClassName}`}>
          <img
            src={imageUrl}
            alt={title}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-150 group-hover:scale-110 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              if (fallbackImage && e.target.src !== fallbackImage) {
                e.target.src = fallbackImage;
              }
              setLoaded(true);
            }}
            loading={eager ? 'eager' : 'lazy'}
            fetchpriority={eager ? 'high' : 'auto'}
          />
          <div
            className="absolute top-0 left-0 right-0 bottom-0 w-full h-full pointer-events-none"
            style={{
              minWidth: '100%',
              minHeight: '100%',
              background:
                'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.35) 85%, rgba(0,0,0,0.2) 100%)',
            }}
            aria-hidden
          />
        </Link>

        <div
          className={`absolute inset-0 flex flex-col justify-between pointer-events-none ${
            isNarrow ? 'p-4 sm:p-5' : 'p-6 sm:p-8'
          }`}
        >
          <div className="min-w-0">
            <h3
              ref={titleRef}
              className="text-white font-bold mb-2 min-w-0 break-words hyphens-auto [text-shadow:0_0_20px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.8),0_2px_4px_rgba(0,0,0,0.9)]"
              style={{ fontSize: `${fontSize}px`, lineHeight }}
            >
              {withSoftBreaks(title)}
            </h3>
            <div className="w-16 h-1 bg-primary-500 rounded-full" />
          </div>

          <div className={`relative pointer-events-auto py-6 ${isNarrow ? 'pl-1 sm:pl-2' : 'pl-2 sm:pl-4'}`}>
            <div className={isNarrow ? 'space-y-1' : 'space-y-2'}>
              {links.map((link) => (
                <Link
                  key={link.key}
                  to={link.to}
                  onClick={onLinkClick}
                  className={`${linkClass} font-medium hover:text-white`}
                >
                  {link.label}
                </Link>
              ))}

              <Link
                ref={viewAllRef}
                to={viewAllHref || href}
                onClick={onLinkClick}
                className={`${linkClass} font-bold mt-4 hover:text-primary-300 break-words`}
                style={{ fontSize: `${viewAllFontSize}px` }}
              >
                {`${withSoftBreaks(viewAllLabel)}\u00A0→`}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryTile;
