import { useEffect, useRef, useState } from 'react';
import logger from '../utils/logger';
import { useSiteSettings } from '../hooks/useContent';

const CONTEXT = 'USMapInteractive';

const USMapInteractive = ({ 
  selectedState, 
  hoveredState, 
  onStateClick, 
  onStateHover,
  getRep 
}) => {
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stateElementsMap, setStateElementsMap] = useState(null);
  const { data: siteSettings } = useSiteSettings();

  // Initialize map once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      logger.error(CONTEXT, 'Container ref not available - this should not happen');
      setError('Failed to initialize map container');
      setIsLoading(false);
      return;
    }

    logger.info(CONTEXT, 'Starting to load SVG map');
    logger.time('SVG Load');

    fetch('/assets/us-map.svg')
      .then(response => {
        logger.debug(CONTEXT, `Fetch response status: ${response.status}`);
        if (!response.ok) {
          throw new Error(`Failed to load map (Status: ${response.status})`);
        }
        return response.text();
      })
      .then(svgText => {
        logger.timeEnd('SVG Load');
        logger.info(CONTEXT, `SVG loaded successfully, size: ${svgText.length} bytes`);
        
        container.innerHTML = svgText;
        
        const svg = container.querySelector('svg');
        if (!svg) {
          throw new Error('SVG element not found in loaded content');
        }

        logger.debug(CONTEXT, 'SVG element found, configuring...');

        // Make SVG responsive
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.maxWidth = '100%';
        svg.style.display = 'block';
        
        // Set viewBox if missing
        if (!svg.hasAttribute('viewBox')) {
          const width = svg.getAttribute('width');
          const height = svg.getAttribute('height');
          if (width && height) {
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            logger.debug(CONTEXT, `Set viewBox: 0 0 ${width} ${height}`);
          }
        }
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        // Find all path elements (states)
        const allPaths = Array.from(svg.querySelectorAll('path'));
        logger.info(CONTEXT, `Found ${allPaths.length} path elements`);

        // Function to get state code from class attribute
        const getStateCode = (element) => {
          const className = element.getAttribute('class');
          if (className) {
            const classes = className.split(' ');
            for (const cls of classes) {
              if (cls.length === 2 && /^[a-z]{2}$/.test(cls)) {
                return cls.toUpperCase();
              }
            }
          }
          return null;
        };

        // Map all state paths
        const stateElements = new Map();
        
        allPaths.forEach(element => {
          const stateCode = getStateCode(element);
          if (stateCode) {
            if (!stateElements.has(stateCode)) {
              stateElements.set(stateCode, []);
            }
            stateElements.get(stateCode).push(element);
          }
        });

        const mappedStates = Array.from(stateElements.keys()).sort();
        logger.info(CONTEXT, `Mapped ${stateElements.size} states`, { states: mappedStates });

        if (stateElements.size === 0) {
          throw new Error('No states could be identified in SVG');
        }

        // Store the map for later use
        setStateElementsMap(stateElements);
        setIsLoading(false);
        
        logger.info(CONTEXT, 'Map initialization complete');
      })
      .catch(err => {
        logger.error(CONTEXT, 'Error loading/processing SVG', err);
        setError(err.message);
        setIsLoading(false);
      });
  }, []); // Only run once on mount

  // Apply styles and events after map is loaded
  useEffect(() => {
    if (!stateElementsMap) {
      logger.trace(CONTEXT, 'State elements map not ready yet');
      return;
    }

    logger.debug(CONTEXT, 'Setting up state styles and event handlers');

    // Apply styles and events to each state
    stateElementsMap.forEach((elements, stateCode) => {
      const rep = getRep(stateCode);
      const hasRep = !!rep;

      elements.forEach(element => {
        // Set base styles
        element.style.cursor = hasRep ? 'pointer' : 'default';
        element.style.transition = 'fill 0.2s ease-in-out, stroke 0.2s ease-in-out';
        element.style.strokeWidth = '1';
        element.style.stroke = '#525252'; // Dark border

        // Function to update element style
        const updateStyle = () => {
          const isSelected = selectedState === stateCode;
          const isHovered = hoveredState === stateCode;

          if (isSelected) {
            element.style.fill = '#f4a52d'; // Gold for selected
            element.style.strokeWidth = '2';
            element.style.stroke = '#d4af37';
          } else if (isHovered && hasRep) {
            element.style.fill = '#fbbf24'; // Lighter gold for hover
            element.style.strokeWidth = '1.5';
          } else if (hasRep) {
            element.style.fill = '#6b6b6b'; // Medium gray for available states
            element.style.strokeWidth = '1';
          } else {
            element.style.fill = '#3a3a3a'; // Dark gray for unavailable
            element.style.opacity = '0.7';
            element.style.strokeWidth = '1';
          }
        };

        // Initial style
        updateStyle();

        // Remove old event listeners to prevent duplicates
        const clickHandler = (e) => {
          e.stopPropagation();
          logger.debug(CONTEXT, `State clicked: ${stateCode}`);
          onStateClick(stateCode);
        };

        const mouseEnterHandler = () => {
          logger.trace(CONTEXT, `Mouse enter: ${stateCode}`);
          onStateHover(stateCode);
        };

        const mouseLeaveHandler = () => {
          logger.trace(CONTEXT, `Mouse leave: ${stateCode}`);
          onStateHover(null);
        };

        // Store handlers for cleanup
        element._clickHandler = clickHandler;
        element._mouseEnterHandler = mouseEnterHandler;
        element._mouseLeaveHandler = mouseLeaveHandler;
        element._updateStyle = updateStyle;

        // Add event listeners
        if (hasRep) {
          element.addEventListener('click', clickHandler);
          element.addEventListener('mouseenter', mouseEnterHandler);
          element.addEventListener('mouseleave', mouseLeaveHandler);

          // Update tooltip
          let titleEl = element.querySelector('title');
          if (titleEl) {
            const originalTitle = titleEl.textContent.split(' -')[0];
            titleEl.textContent = `${originalTitle} - Click to view representative`;
          }
        } else {
          let titleEl = element.querySelector('title');
          if (titleEl) {
            const originalTitle = titleEl.textContent.split(' -')[0];
            titleEl.textContent = `${originalTitle} - No representative assigned`;
          }
        }
      });
    });

    const statesWithReps = Array.from(stateElementsMap.keys())
      .filter(code => getRep(code))
      .sort();
    logger.info(CONTEXT, `States with representatives: ${statesWithReps.length}`, { states: statesWithReps });

    // Cleanup function
    return () => {
      logger.debug(CONTEXT, 'Cleaning up event listeners');
      stateElementsMap.forEach((elements) => {
        elements.forEach(element => {
          if (element._clickHandler) {
            element.removeEventListener('click', element._clickHandler);
          }
          if (element._mouseEnterHandler) {
            element.removeEventListener('mouseenter', element._mouseEnterHandler);
          }
          if (element._mouseLeaveHandler) {
            element.removeEventListener('mouseleave', element._mouseLeaveHandler);
          }
        });
      });
    };
  }, [stateElementsMap, getRep, onStateClick, onStateHover]);

  // Update styles when selection changes
  useEffect(() => {
    if (!stateElementsMap) return;

    logger.trace(CONTEXT, 'Updating styles', { selected: selectedState, hovered: hoveredState });

    stateElementsMap.forEach((elements) => {
      elements.forEach(element => {
        if (element._updateStyle) {
          element._updateStyle();
        }
      });
    });
  }, [selectedState, hoveredState, stateElementsMap]);

  return (
    <div className="relative w-full">
      {/* Loading overlay */}
      {isLoading && (
        <div className="flex items-center justify-center h-96 bg-dark-700 rounded-lg border border-dark-500">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-dark-100">Loading interactive map...</p>
          </div>
        </div>
      )}

      {/* Error overlay - User Friendly */}
      {error && (
        <div className="flex items-center justify-center min-h-96 bg-dark-700 rounded-lg border-2 border-secondary-600">
          <div className="text-center p-8 max-w-md">
            <svg className="w-16 h-16 text-secondary-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
            </svg>
            <h3 className="text-xl font-semibold text-dark-50 mb-3">Map Temporarily Unavailable</h3>
            <p className="text-dark-100 mb-6">
              We're having trouble loading the interactive map right now. Don't worry - you can still find your sales representative using the list below or by contacting us directly.
            </p>
            <div className="bg-dark-800 rounded-lg p-4 text-left">
              <p className="text-sm text-dark-100 mb-2">
                <strong className="text-primary-500">Need Help?</strong>
              </p>
                <p className="text-sm text-dark-200">
                Call us at <span className="text-primary-500 font-semibold">{siteSettings?.primaryPhone || 'N/A'}</span> or email{' '}
                <span className="text-primary-500 font-semibold">{siteSettings?.primaryEmail || 'N/A'}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Map container - always rendered so ref is available */}
      <div 
        ref={containerRef}
        className={`w-full max-w-full overflow-hidden ${isLoading || error ? 'hidden' : ''}`}
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

export default USMapInteractive;
