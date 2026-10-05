import LegalDocumentPage from '../components/legal/LegalDocumentPage';
import { SEO } from '../config/seoConfig';

const PrivacyPolicyPage = () => (
  <LegalDocumentPage
    seo={SEO.pages.privacy}
    type="privacy_policy"
    slug="privacy-policy"
    name="Privacy Policy"
    related={{ name: 'Terms of Service', path: '/terms' }}
  />
);

export default PrivacyPolicyPage;
