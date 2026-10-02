import EditableWrapper from '../admin/EditableWrapper';
import { usePageContent } from '../../hooks/useContent';

const FIELDS = [
  { key: 'title', label: 'Heading', required: true },
  { key: 'subtitle', type: 'textarea', label: 'Subheading', rows: 2 },
];

/**
 * A section heading + subheading stored as PageContent (page/section).
 * Falls back to the defaults until the CMS has a value; editable inline in
 * edit mode. Markup stays with the caller:
 *
 *   <EditableSectionHeading page="home" section="featured_products"
 *     defaultTitle="Featured Products" defaultSubtitle="…">
 *     {({ title, subtitle }) => <><h2>{title}</h2><p>{subtitle}</p></>}
 *   </EditableSectionHeading>
 */
const EditableSectionHeading = ({ page, section, defaultTitle, defaultSubtitle = '', label, className, children }) => {
  const { data } = usePageContent(page, section);
  const title = data?.title || defaultTitle;
  const subtitle = data?.subtitle || defaultSubtitle;

  const handleSave = async ({ title: newTitle, subtitle: newSubtitle }) => {
    const { updatePageContent } = await import('../../services/cmsAdminService');
    return updatePageContent(page, section, { title: newTitle, subtitle: newSubtitle ?? '' });
  };

  return (
    <EditableWrapper
      id={`${page}-${section}-heading`}
      type="section-heading"
      data={{ title, subtitle }}
      fieldSchema={FIELDS}
      onSave={handleSave}
      label={label || `${defaultTitle} heading`}
      className={className}
    >
      {children({ title, subtitle })}
    </EditableWrapper>
  );
};

export default EditableSectionHeading;
