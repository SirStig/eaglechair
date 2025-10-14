import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const ContactPage = () => {
  const [submitStatus, setSubmitStatus] = useState(null);
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const onSubmit = async (data) => {
    try {
      // In demo mode or real API
      const response = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSubmitStatus('success');
        reset();
        setTimeout(() => setSubmitStatus(null), 5000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      setSubmitStatus('error');
    }
  };

  const contactInfo = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      title: 'Phone',
      details: ['Main: (616) 555-0100', 'Sales: (616) 555-0101']
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: 'Email',
      details: ['info@eaglechair.com', 'sales@eaglechair.com']
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: 'Address',
      details: ['123 Furniture Lane', 'Grand Rapids, MI 49504']
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Business Hours',
      details: ['Mon-Fri: 8:00 AM - 6:00 PM EST', 'Sat: 9:00 AM - 2:00 PM EST']
    },
  ];

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-dark-50">Contact Us</h1>
          <p className="text-lg text-dark-100 max-w-2xl mx-auto">
            Have questions? We're here to help! Reach out to our team and we'll get back to you as soon as possible.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-2xl font-bold mb-6 text-dark-50">Send us a Message</h2>
              
              {submitStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6"
                >
                  ✓ Thank you! Your message has been sent successfully. We'll get back to you soon.
                </motion.div>
              )}

              {submitStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6"
                >
                  ✗ Oops! Something went wrong. Please try again or call us directly.
                </motion.div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Input
                    label="First Name"
                    {...register('firstName', { required: 'First name is required' })}
                    error={errors.firstName?.message}
                  />
                  <Input
                    label="Last Name"
                    {...register('lastName', { required: 'Last name is required' })}
                    error={errors.lastName?.message}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Input
                    label="Email"
                    type="email"
                    {...register('email', { 
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address'
                      }
                    })}
                    error={errors.email?.message}
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    {...register('phone')}
                  />
                </div>

                <Input
                  label="Company Name"
                  {...register('company')}
                />

                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-1.5">
                    Subject
                  </label>
                  <select
                    {...register('subject', { required: 'Please select a subject' })}
                    className="w-full px-4 py-2.5 border border-dark-400 bg-dark-700 text-dark-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="quote">Quote Request</option>
                    <option value="support">Customer Support</option>
                    <option value="dealer">Become a Dealer</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.subject && (
                    <p className="mt-1.5 text-sm text-secondary-500">{errors.subject.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-1.5">
                    Message
                  </label>
                  <textarea
                    {...register('message', { required: 'Message is required' })}
                    rows={6}
                    className="w-full px-4 py-2.5 border border-dark-400 bg-dark-700 text-dark-50 placeholder-dark-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  {errors.message && (
                    <p className="mt-1.5 text-sm text-secondary-500">{errors.message.message}</p>
                  )}
                </div>

                <Button type="submit" variant="primary" size="lg" className="w-full">
                  Send Message
                </Button>
              </form>
            </Card>
          </div>

          {/* Contact Info Sidebar */}
          <div className="space-y-6">
            {contactInfo.map((info, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-900 border-2 border-primary-500 rounded-lg flex items-center justify-center text-primary-500">
                      {info.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2 text-dark-50">{info.title}</h3>
                      {info.details.map((detail, i) => (
                        <p key={i} className="text-sm text-dark-100">
                          {detail}
                        </p>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}

            <Card className="bg-gradient-to-br from-dark-700 to-dark-600 border-primary-500">
              <h3 className="font-semibold mb-2 text-dark-50">Looking for a Sales Rep?</h3>
              <p className="text-sm text-dark-100 mb-4">
                Find your local representative for personalized assistance.
              </p>
              <a href="/find-a-rep">
                <Button variant="primary" size="sm" className="w-full">
                  Find a Rep
                </Button>
              </a>
            </Card>
          </div>
        </div>

        {/* Map Section */}
        <Card padding="none" className="overflow-hidden">
          <div className="h-96 bg-dark-700 flex items-center justify-center">
            <div className="text-center text-dark-200">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p>Interactive Map</p>
              <p className="text-sm">123 Furniture Lane, Grand Rapids, MI 49504</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ContactPage;


