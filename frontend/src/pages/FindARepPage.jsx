import { useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../components/ui/Card';
import USMapInteractive from '../components/USMapInteractive';
import EditableWrapper from '../components/admin/EditableWrapper';
import EditableList from '../components/admin/EditableList';
import { useSalesReps, useSiteSettings } from '../hooks/useContent';
import {
  updateSalesRep,
  createSalesRep,
  deleteSalesRep
} from '../services/contentService';
import { demoReps, companyInfo } from '../data/demoData';
import logger from '../utils/logger';

const CONTEXT = 'FindARepPage';

const FindARepPage = () => {
  const [selectedState, setSelectedState] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const { data: salesReps, refetch } = useSalesReps();
  const { data: siteSettings } = useSiteSettings();

  // Use API data or fallback to demo
  const reps = salesReps || demoReps;

  // Get rep for selected/hovered state
  const getRep = (stateCode) => {
    if (!stateCode) return null;
    return reps.find(rep => (rep.states_covered || rep.statesCovered || rep.states).includes(stateCode));
  };

  const displayRep = getRep(selectedState || hoveredState);

  // Handlers for CRUD operations
  const handleUpdateRep = async (id, updates) => {
    try {
      logger.info(CONTEXT, `Updating sales rep ${id}`);
      await updateSalesRep(id, updates);
      refetch();
      logger.info(CONTEXT, 'Sales rep updated successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to update sales rep', error);
      throw error;
    }
  };

  const handleCreateRep = async (newData) => {
    try {
      logger.info(CONTEXT, 'Creating new sales rep');
      await createSalesRep(newData);
      refetch();
      logger.info(CONTEXT, 'Sales rep created successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to create sales rep', error);
      throw error;
    }
  };

  const handleDeleteRep = async (id) => {
    try {
      logger.info(CONTEXT, `Deleting sales rep ${id}`);
      await deleteSalesRep(id);
      refetch();
      logger.info(CONTEXT, 'Sales rep deleted successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to delete sales rep', error);
      throw error;
    }
  };

  // Simplified US Map with state codes
  const statesByRegion = {
    northeast: ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'],
    southeast: ['MD', 'DE', 'VA', 'WV', 'KY', 'NC', 'SC', 'TN', 'GA', 'FL', 'AL', 'MS', 'LA'],
    midwest: ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
    southwest: ['TX', 'OK', 'AR', 'NM', 'AZ'],
    west: ['CO', 'WY', 'MT', 'ID', 'UT', 'NV', 'CA', 'OR', 'WA', 'AK', 'HI'],
  };

  const allStates = Object.values(statesByRegion).flat();

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-dark-50">Find Your Sales Representative</h1>
          <p className="text-lg text-dark-100 max-w-2xl mx-auto">
            Click on your state to find your local Eagle Chair representative. 
            They're ready to help with product selection, quotes, and personalized service.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-2xl font-bold mb-6 text-dark-50">Interactive US Map</h2>
              
              <p className="text-center text-dark-100 mb-4">
                Click a state to view your representative
              </p>
              
              {/* US Map SVG - Direct, no nested cards */}
              <USMapInteractive
                selectedState={selectedState}
                hoveredState={hoveredState}
                onStateClick={setSelectedState}
                onStateHover={setHoveredState}
                getRep={getRep}
              />

              <p className="text-center text-sm text-dark-200 mt-4">
                {selectedState ? `Selected: ${selectedState}` : 'Click any state to find your sales representative'}
              </p>
            </Card>
          </div>

          {/* Rep Info Sidebar */}
          <div>
            {displayRep ? (
              <EditableWrapper
                id={`sales-rep-${displayRep.id}`}
                type="sales-rep"
                data={displayRep}
                onSave={(newData) => handleUpdateRep(displayRep.id, newData)}
                label={`Rep: ${displayRep.name}`}
              >
                <motion.div
                  key={displayRep.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <div className="text-center mb-6">
                      <div className="w-24 h-24 bg-dark-700 border-2 border-primary-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <svg className="w-12 h-12 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold mb-1 text-dark-50">{displayRep.name}</h3>
                      <p className="text-sm text-dark-100">{displayRep.territory_name || displayRep.territory}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-dark-100">Phone</p>
                          <a href={`tel:${displayRep.phone}`} className="text-primary-500 hover:text-primary-400">
                            {displayRep.phone}
                          </a>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-dark-100">Email</p>
                          <a href={`mailto:${displayRep.email}`} className="text-primary-500 hover:text-primary-400 break-all">
                            {displayRep.email}
                          </a>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      <div>
                        <p className="text-sm font-medium text-dark-100">Coverage Area</p>
                        <p className="text-sm text-dark-200">{(displayRep.states_covered || displayRep.statesCovered || displayRep.states).join(', ')}</p>
                      </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-dark-500">
                      <a href={`mailto:${displayRep.email}`}>
                        <button className="w-full px-4 py-2 bg-primary-500 text-dark-900 rounded-lg hover:bg-primary-600 transition-colors font-semibold">
                          Contact {displayRep.name.split(' ')[0]}
                        </button>
                      </a>
                    </div>
                  </Card>
                </motion.div>
              </EditableWrapper>
            ) : (
              <Card className="text-center py-12">
                <svg className="w-16 h-16 text-dark-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-dark-200">Select a state to view your representative</p>
              </Card>
            )}

            {/* Contact Card */}
            <Card className="mt-6 bg-gradient-to-br from-dark-700 to-dark-600 border-primary-500">
              <h3 className="font-semibold mb-2 text-dark-50">Need General Help?</h3>
              <p className="text-sm text-dark-100 mb-4">
                Our main office is available to assist you.
              </p>
              <div className="space-y-2 text-sm text-dark-100">
                <p><strong className="text-primary-500">Phone:</strong> {siteSettings?.primaryPhone || companyInfo.contact.phone}</p>
                <p><strong className="text-primary-500">Email:</strong> {siteSettings?.primaryEmail || companyInfo.contact.email}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* All Reps List */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 text-dark-50">All Sales Representatives</h2>
          <EditableList
            id="sales-reps-list"
            items={reps}
            onUpdate={handleUpdateRep}
            onCreate={handleCreateRep}
            onDelete={handleDeleteRep}
            itemType="sales-rep"
            label="Sales Representatives"
            addButtonText="Add Sales Representative"
            defaultNewItem={{
              name: 'New Representative',
              email: 'rep@eaglechair.com',
              phone: '(555) 000-0000',
              territory_name: 'New Territory',
              states_covered: ['TX'],
              display_order: reps.length
            }}
            renderItem={(rep) => {
              const states = rep.states_covered || rep.statesCovered || rep.states;
              const territory = rep.territory_name || rep.territoryName || rep.territory;
              return (
                <Card 
                  key={rep.id} 
                  className="hover:shadow-xl hover:border-primary-500 transition-all cursor-pointer" 
                  onClick={() => setSelectedState(states[0])}
                >
                  <h3 className="text-lg font-semibold mb-1 text-dark-50">{rep.name}</h3>
                  <p className="text-sm text-dark-100 mb-3">{territory}</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-dark-200">
                      <strong className="text-dark-50">States:</strong> {states.join(', ')}
                    </p>
                    <p className="text-primary-500">{rep.phone}</p>
                    <p className="text-primary-500 break-all">{rep.email}</p>
                  </div>
                </Card>
              );
            }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          />
        </div>
      </div>
    </div>
  );
};

export default FindARepPage;


