import { motion } from 'framer-motion';
import Card from '../components/ui/Card';
import EditableWrapper from '../components/admin/EditableWrapper';
import EditableList from '../components/admin/EditableList';
import { useCompanyValues, useCompanyMilestones, useTeamMembers, usePageContent } from '../hooks/useContent';
import {
  updatePageContent,
  updateCompanyValue,
  updateCompanyMilestone,
  updateTeamMember,
  createCompanyValue,
  createCompanyMilestone,
  createTeamMember,
  deleteCompanyValue,
  deleteCompanyMilestone,
  deleteTeamMember
} from '../services/contentService';
import { demoAboutContent } from '../data/demoData';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import logger from '../utils/logger';

const CONTEXT = 'AboutPage';

const AboutPage = () => {
  const { data: values, loading: valuesLoading, refetch: refetchValues } = useCompanyValues();
  const { data: milestones, loading: milestonesLoading, refetch: refetchMilestones } = useCompanyMilestones();
  const { data: team, loading: teamLoading, refetch: refetchTeam } = useTeamMembers();
  const { data: heroSection, loading: heroLoading, refetch: refetchHero } = usePageContent('about', 'hero');
  const { data: storySection, loading: storyLoading, refetch: refetchStory } = usePageContent('about', 'story');
  const { data: ctaSection, loading: ctaLoading, refetch: refetchCta } = usePageContent('about', 'cta');

  const loading = valuesLoading || milestonesLoading || teamLoading;

  // Hero content
  const heroTitle = heroSection?.title || demoAboutContent.hero.title;
  const heroSubtitle = heroSection?.subtitle || demoAboutContent.hero.subtitle;
  const heroImage = heroSection?.image_url || "https://images.unsplash.com/photo-1565891741441-64926e441838?w=1920";

  // Story content
  const storyTitle = storySection?.title || demoAboutContent.story.title;
  const storyContent = storySection?.content || demoAboutContent.story.paragraphs.join('\n\n');
  const storyImage = storySection?.image_url || "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=800";

  // CTA content
  const ctaTitle = ctaSection?.title || "Ready to Work Together?";
  const ctaContent = ctaSection?.content || "Experience the Eagle Chair difference. Let's create something amazing for your business.";

  // Content update handlers
  const handleSaveContent = async (pageSlug, sectionKey, newData, refetchFn) => {
    try {
      logger.info(CONTEXT, `Saving content for ${pageSlug}/${sectionKey}`);
      await updatePageContent(pageSlug, sectionKey, newData);
      refetchFn();
      logger.info(CONTEXT, 'Content saved successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to save content', error);
      throw error;
    }
  };

  // Values handlers
  const handleUpdateValue = async (id, updates) => {
    await updateCompanyValue(id, updates);
    refetchValues();
  };

  const handleCreateValue = async (newData) => {
    await createCompanyValue(newData);
    refetchValues();
  };

  const handleDeleteValue = async (id) => {
    await deleteCompanyValue(id);
    refetchValues();
  };

  // Milestones handlers
  const handleUpdateMilestone = async (id, updates) => {
    await updateCompanyMilestone(id, updates);
    refetchMilestones();
  };

  const handleCreateMilestone = async (newData) => {
    await createCompanyMilestone(newData);
    refetchMilestones();
  };

  const handleDeleteMilestone = async (id) => {
    await deleteCompanyMilestone(id);
    refetchMilestones();
  };

  // Team handlers
  const handleUpdateTeamMember = async (id, updates) => {
    await updateTeamMember(id, updates);
    refetchTeam();
  };

  const handleCreateTeamMember = async (newData) => {
    await createTeamMember(newData);
    refetchTeam();
  };

  const handleDeleteTeamMember = async (id) => {
    await deleteTeamMember(id);
    refetchTeam();
  };

  return (
    <div className="min-h-screen bg-dark-800">
      {/* Hero Section */}
      <section className="relative h-[500px] pt-16 bg-dark-900 text-white">
        <EditableWrapper
          id="about-hero-image"
          type="image"
          data={{ image_url: heroImage }}
          onSave={(newData) => handleSaveContent('about', 'hero', { ...heroSection, ...newData }, refetchHero)}
          label="Hero Background"
        >
          <div className="absolute inset-0 opacity-30">
            <img
              src={heroImage}
              alt="Workshop"
              className="w-full h-full object-cover"
            />
          </div>
        </EditableWrapper>
        <div className="relative container h-full flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <EditableWrapper
              id="about-hero-title"
              type="text"
              data={{ title: heroTitle }}
              onSave={(newData) => handleSaveContent('about', 'hero', { ...heroSection, ...newData }, refetchHero)}
              label="Hero Title"
            >
              <h1 className="text-5xl lg:text-6xl font-bold mb-6">
                {heroTitle}
              </h1>
            </EditableWrapper>
            
            <EditableWrapper
              id="about-hero-subtitle"
              type="textarea"
              data={{ subtitle: heroSubtitle }}
              onSave={(newData) => handleSaveContent('about', 'hero', { ...heroSection, ...newData }, refetchHero)}
              label="Hero Subtitle"
            >
              <p className="text-xl lg:text-2xl">
                {heroSubtitle}
              </p>
            </EditableWrapper>
          </motion.div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <EditableWrapper
                id="about-story-image"
                type="image"
                data={{ image_url: storyImage }}
                onSave={(newData) => handleSaveContent('about', 'story', { ...storySection, ...newData }, refetchStory)}
                label="Story Image"
              >
                <img
                  src={storyImage}
                  alt="Our Team"
                  className="rounded-2xl shadow-2xl"
                />
              </EditableWrapper>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <EditableWrapper
                id="about-story-title"
                type="text"
                data={{ title: storyTitle }}
                onSave={(newData) => handleSaveContent('about', 'story', { ...storySection, ...newData }, refetchStory)}
                label="Story Title"
              >
                <h2 className="text-3xl font-bold mb-6 text-dark-50">{storyTitle}</h2>
              </EditableWrapper>
              
              <EditableWrapper
                id="about-story-content"
                type="textarea"
                data={{ content: storyContent }}
                onSave={(newData) => handleSaveContent('about', 'story', { ...storySection, ...newData }, refetchStory)}
                label="Story Content"
              >
                {storyContent.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-lg text-dark-100 mb-4">
                    {paragraph}
                  </p>
                ))}
              </EditableWrapper>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-dark-700">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-dark-50">Our Values</h2>
            <p className="text-xl text-dark-100">The principles that guide everything we do</p>
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
                <motion.div
                  key={value.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="text-center h-full">
                    <div className="w-16 h-16 bg-primary-900 border-2 border-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <div className="w-8 h-8 bg-primary-500 rounded"></div>
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-dark-50">{value.title}</h3>
                    <p className="text-dark-100">{value.description}</p>
                  </Card>
                </motion.div>
              )}
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
            />
          )}
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20 bg-dark-800">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-dark-50">Our Journey</h2>
            <p className="text-xl text-dark-100">Key milestones in our history</p>
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
                <motion.div
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
                </motion.div>
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
                <motion.div
                  key={member.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="mb-6"
                >
                  <Card className="text-center">
                    <img
                      src={member.photo_url || member.image}
                      alt={member.name}
                      className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-primary-500"
                    />
                    <h3 className="text-xl font-semibold mb-1 text-dark-50">{member.name}</h3>
                    <p className="text-dark-100">{member.title || member.role}</p>
                    {member.bio && <p className="text-sm text-dark-200 mt-2">{member.bio}</p>}
                  </Card>
                </motion.div>
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
            onSave={(newData) => handleSaveContent('about', 'cta', { ...ctaSection, ...newData }, refetchCta)}
            label="CTA Title"
          >
            <h2 className="text-4xl font-bold mb-6 text-dark-50">{ctaTitle}</h2>
          </EditableWrapper>
          
          <EditableWrapper
            id="about-cta-content"
            type="textarea"
            data={{ content: ctaContent }}
            onSave={(newData) => handleSaveContent('about', 'cta', { ...ctaSection, ...newData }, refetchCta)}
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


