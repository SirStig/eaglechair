import { motion } from 'framer-motion';
import Card from '../components/ui/Card';

const AboutPage = () => {
  const milestones = [
    { year: '1984', title: 'Company Founded', description: 'Eagle Chair was established in Houston, Texas by the Yuglich Family' },
    { year: '1995', title: 'Expansion', description: 'Opened new manufacturing facility and doubled capacity' },
    { year: '2005', title: 'National Distribution', description: 'Expanded distribution network to serve nationwide' },
    { year: '2024', title: 'Continued Excellence', description: 'Continuing the Yuglich Family legacy of quality craftsmanship' },
  ];

  const values = [
    {
      title: 'Quality First',
      description: 'We never compromise on materials or craftsmanship. Every piece is built to last.'
    },
    {
      title: 'Customer Partnership',
      description: 'We build lasting relationships with our clients, supporting them every step of the way.'
    },
    {
      title: 'American Made',
      description: 'Proudly manufacturing in the USA, supporting local communities and jobs.'
    },
    {
      title: 'Sustainability',
      description: 'Committed to environmentally responsible practices and materials.'
    },
  ];

  return (
    <div className="min-h-screen bg-dark-800">
      {/* Hero Section */}
      <section className="relative h-[500px] pt-16 from-primary-700 to-primary-500 text-white">
        <div className="absolute inset-0 opacity-20">
          <img
            src="https://images.unsplash.com/photo-1565891741441-64926e441838?w=1920"
            alt="Workshop"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative container h-full flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <h1 className="text-5xl lg:text-6xl font-bold mb-6">
              Our Story
            </h1>
            <p className="text-xl lg:text-2xl">
              Family-owned and operated since 1984, continuing the Yuglich Family legacy of 
              quality commercial furniture manufacturing in Houston, Texas.
            </p>
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
              <img
                src="https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=800"
                alt="Our Team"
                className="rounded-2xl shadow-2xl"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold mb-6 text-dark-50">Craftsmanship & Dedication</h2>
              <p className="text-lg text-dark-100 mb-4">
                Founded in Houston, Texas in 1984 by the Yuglich Family, Eagle Chair has grown into 
                a trusted name in commercial furniture manufacturing. Under the leadership of Katarina 
                Kac-Statton and Maximilian Kac, we've maintained our commitment to quality, craftsmanship, 
                and customer satisfaction.
              </p>
              <p className="text-lg text-dark-100 mb-4">
                Our furniture graces thousands of restaurants, hotels, and hospitality venues 
                across the country. Each piece is a testament to our dedication to excellence 
                and our understanding of the demanding needs of commercial environments.
              </p>
              <p className="text-lg text-dark-100">
                As a family-owned business, we take pride in treating every customer like family. 
                Your success is our success, and we're here to support you every step of the way.
              </p>
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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
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
            ))}
          </div>
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
            {milestones.map((milestone, index) => (
              <motion.div
                key={index}
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
                  {index !== milestones.length - 1 && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-primary-800"></div>
                  )}
                </div>
                <Card className="flex-1">
                  <h3 className="text-xl font-semibold mb-2 text-dark-50">{milestone.title}</h3>
                  <p className="text-dark-100">{milestone.description}</p>
                </Card>
              </motion.div>
            ))}
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
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { name: 'Katarina Kac-Statton', role: 'Leadership', image: '/team/katarina.jpg' },
              { name: 'Maximilian Kac', role: 'Leadership', image: '/team/maximilian.jpg' },
            ].map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="text-center">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-primary-500"
                  />
                  <h3 className="text-xl font-semibold mb-1 text-dark-50">{member.name}</h3>
                  <p className="text-dark-100">{member.role}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-700 to-primary-500 text-white">
        <div className="container text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Work Together?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Experience the Eagle Chair difference. Let's create something amazing for your business.
          </p>
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


