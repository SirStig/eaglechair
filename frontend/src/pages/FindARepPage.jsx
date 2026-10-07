import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import SEOHead from '../components/SEOHead';
import { SEO } from '../config/seoConfig';
import { m } from 'framer-motion';
import Card from '../components/ui/Card';
import USMapInteractive from '../components/USMapInteractive';
import EditableWrapper from '../components/admin/EditableWrapper';
import EditableSectionHeading from '../components/common/EditableSectionHeading';
import EditableList from '../components/admin/EditableList';
import { useSalesReps, useSiteSettings } from '../hooks/useContent';
import logger from '../utils/logger';
import { getStateName } from '../utils/usStates';
import { trackRepSearch } from '../utils/analytics';
import { salesContact, telHref, mailtoHref } from '../utils/contactLinks';

const CONTEXT = 'FindARepPage';

// Admin-only write API; loaded on first save so public visitors never download it
const loadCmsAdmin = () => import('../services/cmsAdminService');

const getRepStates = (rep) => rep.states_covered || rep.statesCovered || rep.states || [];
const getRepTerritory = (rep) => rep.territoryName || rep.territory_name || rep.territory || '';
// { TN: 'Memphis' } - states the rep covers only part of
const getRepAreas = (rep) => rep.stateAreas || rep.state_areas || {};
const formatCoverage = (rep, code) => {
  const area = getRepAreas(rep)[code];
  return area ? `${getStateName(code)} (${area} only)` : getStateName(code);
};

const FindARepPage = () => {
  const [selectedState, setSelectedState] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const mapRef = useRef(null);
  const { data: salesReps } = useSalesReps();
  const { data: siteSettings } = useSiteSettings();

  // Use API data with memoization
  const reps = useMemo(() => salesReps || [], [salesReps]);

  // States without a dedicated rep fall back to the main Houston office's sales line
  const houseRep = useMemo(() => {
    const cityState = [siteSettings?.city, siteSettings?.state].filter(Boolean).join(', ');
    return {
      id: 'house',
      isHouse: true,
      name: `${siteSettings?.companyName || 'Eagle Chair'} Sales`,
      territory: cityState ? `Main Office · ${cityState}` : 'Main Office',
      phone: siteSettings?.salesPhone || siteSettings?.primaryPhone,
      email: siteSettings?.salesEmail || siteSettings?.primaryEmail,
    };
  }, [siteSettings]);

  // Everyone serving a state: reps limited to an area of it first (most
  // specific), then the statewide rep - or the main office, which covers the
  // rest of the state when no rep covers all of it
  const getStateCoverage = useCallback((stateCode) => {
    if (!stateCode) return [];
    const covering = reps.filter(rep => getRepStates(rep).includes(stateCode));
    const partial = covering
      .filter(rep => getRepAreas(rep)[stateCode])
      .map(rep => ({ rep, area: `${getRepAreas(rep)[stateCode]} only` }));
    const statewide = covering.find(rep => !getRepAreas(rep)[stateCode]) || houseRep;
    return [...partial, { rep: statewide, area: partial.length ? `Rest of ${getStateName(stateCode)}` : null }];
  }, [reps, houseRep]);

  // For the map: a state is gold if any local rep covers it, even partly
  const getRep = useCallback((stateCode) => {
    if (!stateCode) return null;
    return getStateCoverage(stateCode).find(entry => !entry.rep.isHouse)?.rep || houseRep;
  }, [getStateCoverage, houseRep]);

  const activeState = selectedState || hoveredState;
  const activeCoverage = getStateCoverage(activeState);
  const selectedCoverage = getStateCoverage(selectedState);

  // Which territories people look up (clicks, not hovers)
  useEffect(() => {
    if (selectedState) trackRepSearch(getStateName(selectedState));
  }, [selectedState]);

  const selectRepTerritory = (rep) => {
    const states = getRepStates(rep);
    if (!states.length) return;
    setSelectedState(states[0]);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderRepCard = ({ rep: displayRep, area }) => (
    <m.div
      key={`${displayRep.id}-${area || ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <div className="text-center mb-6">
          {area && (
            <p className="inline-block mb-3 px-3 py-1 rounded-full text-xs font-semibold bg-[#9a7426]/20 border border-[#9a7426]/60 text-primary-300">
              {area}
            </p>
          )}
          <div className="w-24 h-24 bg-dark-700 border-2 border-primary-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-12 h-12 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-1 text-dark-50">{displayRep.name}</h3>
          {getRepTerritory(displayRep) && <p className="text-sm text-dark-100">{getRepTerritory(displayRep)}</p>}
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
              <p className="text-sm text-dark-200">
                {displayRep.isHouse
                  ? `${area || getStateName(activeState)} is served directly by our main office`
                  : getRepStates(displayRep).map(code => formatCoverage(displayRep, code)).join(', ')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-dark-500">
          <a href={`mailto:${displayRep.email}`}>
            <button className="w-full px-4 py-2 bg-primary-500 text-dark-900 rounded-lg hover:bg-primary-600 transition-colors font-semibold">
              {displayRep.isHouse ? 'Contact Sales' : `Contact ${displayRep.name.split(' ')[0]}`}
            </button>
          </a>
        </div>
      </Card>
    </m.div>
  );

  // Handlers for CRUD operations
  const handleUpdateRep = async (id, updates) => {
    try {
      logger.info(CONTEXT, `Updating sales rep ${id}`);
      const { updateSalesRep } = await loadCmsAdmin();
      await updateSalesRep(id, updates);
      logger.info(CONTEXT, 'Sales rep updated successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to update sales rep', error);
      throw error;
    }
  };

  const handleCreateRep = async (newData) => {
    try {
      logger.info(CONTEXT, 'Creating new sales rep');
      const { createSalesRep } = await loadCmsAdmin();
      await createSalesRep(newData);
      logger.info(CONTEXT, 'Sales rep created successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to create sales rep', error);
      throw error;
    }
  };

  const handleDeleteRep = async (id) => {
    try {
      logger.info(CONTEXT, `Deleting sales rep ${id}`);
      const { deleteSalesRep } = await loadCmsAdmin();
      await deleteSalesRep(id);
      logger.info(CONTEXT, 'Sales rep deleted successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to delete sales rep', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <SEOHead {...SEO.pages.findARep} />
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <EditableSectionHeading
            page="find_a_rep"
            section="header"
            defaultTitle="Find Your Sales Representative"
            defaultSubtitle="Click on your state to find your local Eagle Chair representative. They're ready to help with product selection, quotes, and personalized service."
            label="Find a Rep page heading"
          >
            {({ title, subtitle }) => (
              <>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-dark-50">{title}</h1>
                {subtitle && <p className="text-lg text-dark-100 max-w-2xl mx-auto">{subtitle}</p>}
              </>
            )}
          </EditableSectionHeading>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Map Section */}
          <div className="lg:col-span-2 scroll-mt-24" ref={mapRef}>
            <Card>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-dark-50">Interactive US Map</h2>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs sm:text-sm text-dark-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-sm bg-[#9a7426] ring-1 ring-black/30" aria-hidden="true" />
                    Local representative
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-sm bg-[#4a4a4a] ring-1 ring-black/30" aria-hidden="true" />
                    Main office
                  </span>
                </div>
              </div>

              {/* US Map SVG - Direct, no nested cards */}
              <USMapInteractive
                selectedState={selectedState}
                hoveredState={hoveredState}
                onStateClick={setSelectedState}
                onStateHover={setHoveredState}
                getRep={getRep}
              />

              {/* Selection summary – on mobile this is the quickest path to contact info */}
              <div className="mt-4 rounded-lg border border-dark-500 bg-dark-700/60 px-4 py-3" aria-live="polite">
                {selectedState ? (
                  <div className="space-y-3">
                    <p className="text-base font-semibold text-dark-50">{getStateName(selectedState)}</p>
                    {selectedCoverage.map(({ rep, area }) => (
                      <div key={`${rep.id}-${area || ''}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="min-w-0 text-sm text-dark-100">
                          {area && <span className="font-medium text-dark-50">{area}: </span>}
                          {rep.isHouse ? (
                            'Served directly by our main office'
                          ) : (
                            <>Represented by <span className="text-primary-500 font-medium">{rep.name}</span></>
                          )}
                        </p>
                        <div className="flex gap-2 lg:hidden">
                          {rep.phone && (
                            <a
                              href={`tel:${rep.phone}`}
                              className="flex-1 sm:flex-none text-center px-4 py-2 rounded-lg bg-primary-500 text-dark-900 font-semibold text-sm"
                            >
                              Call
                            </a>
                          )}
                          {rep.email && (
                            <a
                              href={`mailto:${rep.email}`}
                              className="flex-1 sm:flex-none text-center px-4 py-2 rounded-lg border border-primary-500 text-primary-500 font-semibold text-sm"
                            >
                              Email
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-dark-100">
                    Tap or click any state. Gold states have a dedicated local representative.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Rep Info Sidebar */}
          <div className="">
            {activeCoverage.length > 0 ? (
              <div className="space-y-6">
                {activeCoverage.map((entry) => (entry.rep.isHouse ? (
                  renderRepCard(entry)
                ) : (
                  <EditableWrapper
                    key={entry.rep.id}
                    id={`sales-rep-${entry.rep.id}`}
                    type="sales-rep"
                    data={entry.rep}
                    onSave={(newData) => handleUpdateRep(entry.rep.id, newData)}
                    label={`Rep: ${entry.rep.name}`}
                  >
                    {renderRepCard(entry)}
                  </EditableWrapper>
                )))}
              </div>
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
                <p>
                  <strong className="text-primary-500">Phone:</strong>{' '}
                  <a href={telHref(salesContact(siteSettings).phone) || undefined} className="hover:text-primary-400 hover:underline">
                    {salesContact(siteSettings).phone || 'N/A'}
                  </a>
                </p>
                <p>
                  <strong className="text-primary-500">Email:</strong>{' '}
                  <a href={mailtoHref(salesContact(siteSettings).email) || undefined} className="hover:text-primary-400 hover:underline break-all">
                    {salesContact(siteSettings).email || 'N/A'}
                  </a>
                </p>
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
              phone: '',
              territoryName: 'New Territory',
              statesCovered: ['TX'],
              displayOrder: reps.length
            }}
            renderItem={(rep) => {
              const states = getRepStates(rep);
              const isActive = selectedCoverage.some(entry => !entry.rep.isHouse && entry.rep.id === rep.id);
              return (
                <Card
                  key={rep.id}
                  className={`hover:shadow-xl hover:border-primary-500 transition-all cursor-pointer ${isActive ? 'border-primary-500' : ''}`}
                  onClick={() => selectRepTerritory(rep)}
                >
                  <h3 className={`text-lg font-semibold text-dark-50 ${getRepTerritory(rep) ? 'mb-1' : 'mb-3'}`}>{rep.name}</h3>
                  {getRepTerritory(rep) && (
                    <p className="text-sm text-dark-100 mb-3">{getRepTerritory(rep)}</p>
                  )}
                  <ul className="flex flex-wrap gap-1.5 mb-3" aria-label={`States covered by ${rep.name}`}>
                    {states.map(code => (
                      <li key={code}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedState(code);
                            mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            selectedState === code
                              ? 'bg-primary-500 border-primary-500 text-dark-900'
                              : 'bg-[#9a7426]/20 border-[#9a7426]/60 text-primary-300 hover:border-primary-500'
                          }`}
                        >
                          {formatCoverage(rep, code)}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-1 text-sm">
                    <a href={`tel:${rep.phone}`} onClick={(e) => e.stopPropagation()} className="block text-primary-500">{rep.phone}</a>
                    <a href={`mailto:${rep.email}`} onClick={(e) => e.stopPropagation()} className="block text-primary-500 break-all">{rep.email}</a>
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


