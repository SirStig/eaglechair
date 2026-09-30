// eslint-disable-next-line no-unused-vars
import { m } from 'framer-motion';
import SEOHead from '../components/SEOHead';
import { SEO } from '../config/seoConfig';
import Card from '../components/ui/Card';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import EditableWrapper from '../components/admin/EditableWrapper';
import EditableList from '../components/admin/EditableList';
import { useEditMode } from '../contexts/useEditMode';
import { useCompanyValues, useCompanyMilestones, useTeamMembers, usePageContent } from '../hooks/useContent';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import logger from '../utils/logger';

const CONTEXT = 'AboutPage';

// Admin-only write API; loaded on first save so public visitors never download it
const loadCmsAdmin = () => import('../services/cmsAdminService');

const AboutPage = () => {
  const { isEditMode } = useEditMode();
  const { data: values, loading: valuesLoading } = useCompanyValues();
  const { data: milestones, loading: milestonesLoading } = useCompanyMilestones();
  const { data: team, loading: teamLoading } = useTeamMembers();
  const { data: heroSection } = usePageContent('about', 'hero');
  const { data: storySection } = usePageContent('about', 'story');
  const { data: ctaSection } = usePageContent('about', 'cta');

  const loading = valuesLoading || milestonesLoading || teamLoading;

  // Hero content
  const heroTitle = heroSection?.title || "About Eagle Chair";
  const heroSubtitle = heroSection?.subtitle || "Crafting Excellence in Seating Solutions";
  const heroImage = heroSection?.imageUrl || "https://images.unsplash.com/photo-1565891741441-64926e441838?w=1920";

  // Story content
  const storyTitle = storySection?.title || "Our Story";
  const storyContent = storySection?.content || "";
  const storyImage = storySection?.imageUrl || "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=800";

  // CTA content
  const ctaTitle = ctaSection?.title || "Ready to Work Together?";
  const ctaContent = ctaSection?.content || "Experience the Eagle Chair difference. Let's create something amazing for your business.";

  // Content update handlers. Saves go through cmsAdminService; the API client
  // then invalidates the shared content caches, so every content hook on the
  // page re-fetches - no per-call refetch or cache juggling here.
  const handleSaveContent = async (pageSlug, sectionKey, newData) => {
    try {
      logger.info(CONTEXT, `Saving content for ${pageSlug}/${sectionKey}`);
      const { updatePageContent } = await loadCmsAdmin();
      await updatePageContent(pageSlug, sectionKey, newData);
      logger.info(CONTEXT, 'Content saved successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to save content', error);
      throw error;
    }
  };

  const cmsAction = (name) => async (...args) => {
    const service = await loadCmsAdmin();
    return service[name](...args);
  };

  // Values handlers
  const handleUpdateValue = cmsAction('updateCompanyValue');
  const handleCreateValue = cmsAction('createCompanyValue');
  const handleDeleteValue = cmsAction('deleteCompanyValue');

  // Milestones handlers
  const handleUpdateMilestone = cmsAction('updateCompanyMilestone');
  const handleCreateMilestone = cmsAction('createCompanyMilestone');
  const handleDeleteMilestone = cmsAction('deleteCompanyMilestone');

  // Team handlers
  const handleUpdateTeamMember = cmsAction('updateTeamMember');
  const handleCreateTeamMember = cmsAction('createTeamMember');
  const handleDeleteTeamMember = cmsAction('deleteTeamMember');

  return (
    <div className="min-h-screen bg-dark-800">
      <SEOHead {...SEO.pages.about} />
      {/* Hero Section - extends to top, header floats above */}
      <section className="relative min-h-[500px] sm:min-h-[600px] lg:min-h-[700px] -mt-[var(--header-height)] pt-[var(--header-height)] bg-dark-900 text-white flex">
        <div className="absolute inset-0 opacity-30">
          <ResponsiveImage
            src={heroImage}
            sizes="100vw"
            alt="Workshop"
            className="absolute inset-0 w-full h-full object-cover img-sharp"
            priority
            decoding="sync"
          />
        </div>

        <div className="relative container flex-1 flex items-center">
          <m.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <EditableWrapper
              id="about-hero-title"
              type="text"
              data={{ title: heroTitle }}
              onSave={(newData) => handleSaveContent('about', 'hero', { ...heroSection, ...newData })}
              label="Hero Title"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
                {heroTitle}
              </h1>
            </EditableWrapper>

            <EditableWrapper
              id="about-hero-subtitle"
              type="textarea"
              data={{ subtitle: heroSubtitle }}
              onSave={(newData) => handleSaveContent('about', 'hero', { ...heroSection, ...newData })}
              label="Hero Subtitle"
            >
              <p className="text-lg sm:text-xl lg:text-2xl">
                {heroSubtitle}
              </p>
            </EditableWrapper>

            <EditableWrapper
              id="about-hero-image"
              type="image"
              data={{ imageUrl: heroImage }}
              onSave={(newData) => handleSaveContent('about', 'hero', { ...heroSection, ...newData })}
              label="Hero Background Image"
            >
              {isEditMode && (
                <button className="mt-4 px-4 py-2 bg-accent-600/90 hover:bg-accent-700 text-white rounded-lg text-sm font-semibold backdrop-blur-sm border border-accent-400 transition-all">
                  📷 Change Background Image
                </button>
              )}
            </EditableWrapper>
          </m.div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center mb-12 sm:mb-16">
            <m.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <EditableWrapper
                id="about-story-image"
                type="image"
                data={{ imageUrl: storyImage }}
                onSave={(newData) => handleSaveContent('about', 'story', { ...storySection, ...newData })}
                label="Story Image"
              >
                {/* w-full: with srcset the intrinsic width depends on the chosen
                    candidate, so size by the column instead. */}
                <ResponsiveImage
                  src={storyImage}
                  sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
                  alt="Our Team"
                  className="w-full rounded-2xl shadow-2xl"
                />
              </EditableWrapper>
            </m.div>
            <m.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <EditableWrapper
                id="about-story-title"
                type="text"
                data={{ title: storyTitle }}
                onSave={(newData) => handleSaveContent('about', 'story', { ...storySection, ...newData })}
                label="Story Title"
              >
                <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-dark-50">{storyTitle}</h2>
              </EditableWrapper>

              <EditableWrapper
                id="about-story-content"
                type="textarea"
                data={{ content: storyContent }}
                onSave={(newData) => handleSaveContent('about', 'story', { ...storySection, ...newData })}
                label="Story Content"
              >
                {storyContent.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-lg text-dark-100 mb-4">
                    {paragraph}
                  </p>
                ))}
              </EditableWrapper>
            </m.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-dark-700">
        <div className="container">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-dark-50">Our Values</h2>
            <p className="text-lg sm:text-xl text-dark-100">The principles that guide everything we do</p>
          </div>
          {loading ? (
            <div className="flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <EditableList
              id="company-values-list"
              items={values || []}
              onUpdate={handleUpdateValue}
              onCreate={handleCreateValue}
              onDelete={handleDeleteValue}
              itemType="value"
              label="Company Values"
              addButtonText="Add Value"
              defaultNewItem={{
                title: 'New Value',
                description: 'Value description',
                icon: '',
                display_order: (values || []).length
              }}
              renderItem={(value, index) => (
                <m.div
                  key={value.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="text-center h-full overflow-hidden">
                    {/* Value Image or Icon */}
                    {value.image_url || value.imageUrl ? (
                      <div className="w-full h-40 overflow-hidden mb-4">
                        <ResponsiveImage
                          src={value.image_url || value.imageUrl}
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                          alt={value.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-primary-900 border-2 border-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4 mt-4">
                        {value.icon ? (
                          <span className="text-2xl">{value.icon}</span>
                        ) : (
                          <div className="w-8 h-8 bg-primary-500 rounded"></div>
                        )}
                      </div>
                    )}

                    {/* Value Content */}
                    <div className="px-4 pb-4">
                      <h3 className="text-xl font-semibold mb-1 text-dark-50">{value.title}</h3>
                      {value.subtitle && (
                        <p className="text-sm text-primary-400 mb-2">{value.subtitle}</p>
                      )}
                      <p className="text-dark-100">{value.description}</p>
                    </div>
                  </Card>
                </m.div>
              )}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8"
            />
          )}
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-dark-800">
        <div className="container">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-dark-50">Our Journey</h2>
            <p className="text-lg sm:text-xl text-dark-100">Key milestones in our history</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <EditableList
              id="company-milestones-list"
              items={milestones || []}
              onUpdate={handleUpdateMilestone}
              onCreate={handleCreateMilestone}
              onDelete={handleDeleteMilestone}
              itemType="milestone"
              label="Company Milestones"
              addButtonText="Add Milestone"
              defaultNewItem={{
                year: new Date().getFullYear().toString(),
                title: 'New Milestone',
                description: 'Milestone description',
                display_order: (milestones || []).length
              }}
              renderItem={(milestone, index) => (
                <m.div
                  key={milestone.id || index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-6 mb-8 items-start"
                >
                  <div className="flex-shrink-0 w-24 text-right">
                    <div className="text-2xl font-bold text-primary-500">{milestone.year}</div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <div className="w-4 h-4 bg-primary-500 rounded-full mt-1"></div>
                    {index !== (milestones || []).length - 1 && (
                      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-primary-800"></div>
                    )}
                  </div>
                  <Card className="flex-1">
                    <h3 className="text-xl font-semibold mb-2 text-dark-50">{milestone.title}</h3>
                    <p className="text-dark-100">{milestone.description}</p>
                  </Card>
                </m.div>
              )}
            />
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-dark-700">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-dark-50">Meet Our Leadership</h2>
            <p className="text-xl text-dark-100">The team behind Eagle Chair's success</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <EditableList
              id="team-members-list"
              items={team || []}
              onUpdate={handleUpdateTeamMember}
              onCreate={handleCreateTeamMember}
              onDelete={handleDeleteTeamMember}
              itemType="team-member"
              label="Team Members"
              addButtonText="Add Team Member"
              defaultNewItem={{
                name: 'New Member',
                title: 'Position',
                bio: '',
                photo_url: '',
                display_order: (team || []).length
              }}
              renderItem={(member, index) => (
                <m.div
                  key={member.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="mb-6"
                >
                  <Card className="text-center">
                    <ResponsiveImage
                      src={member.photo_url || member.image}
                      sizes="128px"
                      alt={member.name}
                      className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-primary-500"
                    />
                    <h3 className="text-xl font-semibold mb-1 text-dark-50">{member.name}</h3>
                    <p className="text-dark-100">{member.title || member.role}</p>
                    {member.bio && <p className="text-sm text-dark-200 mt-2">{member.bio}</p>}
                  </Card>
                </m.div>
              )}
              className="grid md:grid-cols-2 gap-8"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-dark-900 border-y border-dark-700">
        <div className="container text-center">
          <EditableWrapper
            id="about-cta-title"
            type="text"
            data={{ title: ctaTitle }}
            onSave={(newData) => handleSaveContent('about', 'cta', { ...ctaSection, ...newData })}
            label="CTA Title"
          >
            <h2 className="text-4xl font-bold mb-6 text-dark-50">{ctaTitle}</h2>
          </EditableWrapper>

          <EditableWrapper
            id="about-cta-content"
            type="textarea"
            data={{ content: ctaContent }}
            onSave={(newData) => handleSaveContent('about', 'cta', { ...ctaSection, ...newData })}
            label="CTA Content"
          >
            <p className="text-xl mb-8 max-w-2xl mx-auto text-dark-100">
              {ctaContent}
            </p>
          </EditableWrapper>

          <div className="flex gap-4 justify-center">
            <a href="/contact">
              <button className="px-8 py-3 bg-dark-900 text-primary-500 rounded-lg font-semibold hover:bg-dark-800 transition-colors border-2 border-primary-500">
                Contact Us
              </button>
            </a>
            <a href="/find-a-rep">
              <button className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/20 transition-colors">
                Find Your Rep
              </button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;


