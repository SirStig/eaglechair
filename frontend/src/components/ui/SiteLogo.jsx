import ResponsiveImage from './ResponsiveImage';

// White logo: every surface SiteLogo sits on (header, footer, auth pages) is dark
export const DEFAULT_LOGO = '/assets/eagle-chair-logo-white.png';

/**
 * Company logo for dark backgrounds from Site Settings (an upload, kept at
 * full resolution) or the bundled white default. It's shown ~48-64px tall, so request a small rendition
 * instead of the original, skip the blurred placeholder (a blurry logo looks
 * broken) and never upgrade to full resolution.
 */
const SiteLogo = ({ src, alt = 'Eagle Chair', sizes = '320px', onError, ...rest }) => (
  <ResponsiveImage
    src={src || DEFAULT_LOGO}
    alt={alt}
    sizes={sizes}
    placeholder={false}
    fullResolution={false}
    onError={(e) => {
      if (e.target.src.endsWith(DEFAULT_LOGO)) return;
      e.target.src = DEFAULT_LOGO;
      if (onError) onError(e);
    }}
    {...rest}
  />
);

export default SiteLogo;
