import { Helmet } from 'react-helmet-async';
import { DEFAULT_SHARE_IMAGE, SITE_NAME, absoluteMediaUrl, absoluteUrl } from '../config/site';

const DESCRIPTION_MAX = 158;

// Cut at a word boundary instead of mid-word
const truncate = (text, max) => {
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[,;:\-–—\s]+$/, '')}…`;
};

/**
 * Page <head>: title, description, canonical, robots, Open Graph, Twitter
 * card and JSON-LD.
 *
 * Product, family, category and static pages are also prerendered for
 * crawlers that don't run JavaScript (backend/services/seo_prerender.py);
 * keep the tags here in line with render_head() there.
 *
 * @param {string} url - App path of the page; the canonical URL unless `canonical` is given
 * @param {string} image - Share image (a 1200x630 card, or any image URL/path)
 * @param {object|object[]} structuredData - One or more JSON-LD objects
 */
export const SEOHead = ({
  title,
  description,
  image,
  imageAlt,
  imageWidth = 1200,
  imageHeight = 630,
  url,
  type = 'website',
  keywords,
  canonical,
  noindex = false,
  structuredData,
}) => {
  const fullUrl = absoluteUrl(canonical || url || '/');
  const fullImage = absoluteMediaUrl(image) || DEFAULT_SHARE_IMAGE;
  const seoDescription = truncate(description, DESCRIPTION_MAX);
  const alt = imageAlt || title;
  const schemas = (Array.isArray(structuredData) ? structuredData : [structuredData]).filter(Boolean);

  return (
    <Helmet>
      {title && <title>{title}</title>}
      {seoDescription && <meta name="description" content={seoDescription} />}
      {keywords && <meta name="keywords" content={keywords} />}
      <meta
        name="robots"
        content={noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}
      />
      <link rel="canonical" href={fullUrl} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content={type} />
      {title && <meta property="og:title" content={title} />}
      {seoDescription && <meta property="og:description" content={seoDescription} />}
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={fullImage} />
      {imageWidth && <meta property="og:image:width" content={String(imageWidth)} />}
      {imageHeight && <meta property="og:image:height" content={String(imageHeight)} />}
      {alt && <meta property="og:image:alt" content={alt} />}

      <meta name="twitter:card" content="summary_large_image" />
      {title && <meta name="twitter:title" content={title} />}
      {seoDescription && <meta name="twitter:description" content={seoDescription} />}
      <meta name="twitter:image" content={fullImage} />
      {alt && <meta name="twitter:image:alt" content={alt} />}

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEOHead;
