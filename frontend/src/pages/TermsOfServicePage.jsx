import LegalDocumentPage from '../components/legal/LegalDocumentPage';
import { SEO } from '../config/seoConfig';

const TermsOfServicePage = () => (
  <LegalDocumentPage
    seo={SEO.pages.terms}
    type="conditions_of_sale"
    slug="conditions-of-sale"
    name="Terms of Service"
    related={{ name: 'Privacy Policy', path: '/privacy' }}
  />
);

export default TermsOfServicePage;
