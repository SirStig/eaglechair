import { Helmet } from 'react-helmet-async';

/**
 * SEO Head Component
 * 
 * Industry-standard SEO component for dynamic meta tags, Open Graph, and Twitter Cards
 */
export const SEOHead = ({ 
  title, 
  description, 
  image, 
  url, 
  type = 'website',
  keywords,
  canonical,
  noindex = false,
  structuredData
}) => {
  const siteUrl = 'https://www.eaglechair.com';
  const fullUrl = canonical || (url ? `${siteUrl}${url}` : siteUrl);
  const fullImage = image ? (image.startsWith('http') ? image : `${siteUrl}${image}`) : `${siteUrl}/og-image.jpg`;
  
  // Ensure title doesn't exceed 60 characters (SEO best practice)
  const seoTitle = title && title.length > 60 ? `${title.substring(0, 57)}...` : title;
  
  // Ensure description doesn't exceed 160 characters (SEO best practice)
  const seoDescription = description && description.length > 160 ? `${description.substring(0, 157)}...` : description;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      {seoTitle && <title>{seoTitle}</title>}
      {seoDescription && <meta name="description" content={seoDescription} />}
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />
      
      {/* Open Graph / Facebook */}
      {seoTitle && <meta property="og:title" content={seoTitle} />}
      {seoDescription && <meta property="og:description" content={seoDescription} />}
      <meta property="og:image" content={fullImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Eagle Chair" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      {seoTitle && <meta name="twitter:title" content={seoTitle} />}
      {seoDescription && <meta name="twitter:description" content={seoDescription} />}
      <meta name="twitter:image" content={fullImage} />
      
      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEOHead;

