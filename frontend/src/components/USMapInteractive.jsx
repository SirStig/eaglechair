import { useEffect, useRef, useState } from 'react';
import logger from '../utils/logger';
import { useSiteSettings } from '../hooks/useContent';
import { getStateName } from '../utils/usStates';
import LoadingSpinner from './ui/LoadingSpinner';

const CONTEXT = 'USMapInteractive';
const SVG_NS = 'http://www.w3.org/2000/svg';
const LABEL_ID = 'selected-state-label';

// Stroke matches the card background so borders read as clean gaps between states
const MAP_COLORS = {
  house: { fill: '#4a4a4a', stroke: '#2d2d2d', strokeWidth: '1' },
  houseHover: { fill: '#6b6b6b', stroke: '#2d2d2d', strokeWidth: '1' },
  rep: { fill: '#9a7426', stroke: '#2d2d2d', strokeWidth: '1' },
  territory: { fill: '#c99a33', stroke: '#2d2d2d', strokeWidth: '1' },
  repHover: { fill: '#fbbf24', stroke: '#2d2d2d', strokeWidth: '1' },
  selected: { fill: '#f4a52d', stroke: '#fde68a', strokeWidth: '2' },
};

// Where to anchor the name label inside a state's bounding box (fraction of width, height)
// for shapes whose box centre falls outside the state itself
const LABEL_ANCHORS = {
  FL: [0.78, 0.55],
  MI: [0.72, 0.72],
  LA: [0.3, 0.4],
  MD: [0.35, 0.3],
  ID: [0.4, 0.7],
  OK: [0.55, 0.6],
  TX: [0.55, 0.4],
  KY: [0.55, 0.45],
  VA: [0.6, 0.55],
};

const USMapInteractive = ({
  selectedState,
  hoveredState,
  onStateClick,
  onStateHover,
  getRep
}) => {
  const containerRef = useRef(null);
  const selectedStateRef = useRef(selectedState);
  const hoveredStateRef = useRef(hoveredState);
  selectedStateRef.current = selectedState;
  hoveredStateRef.current = hoveredState;
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
      const hasDedicatedRep = !!rep && !rep.isHouse;
      const stateName = getStateName(stateCode);

      elements.forEach(element => {
        element.style.cursor = 'pointer';
        element.style.transition = 'fill 0.2s ease-out, stroke 0.2s ease-out';
        element.style.strokeLinejoin = 'round';

        const updateStyle = () => {
          const currentSelected = selectedStateRef.current;
          const currentHovered = hoveredStateRef.current;
          const isSelected = currentSelected === stateCode;
          const isHovered = currentHovered === stateCode;
          // Hovering or selecting one state lights up the rest of that rep's territory
          const inActiveTerritory = hasDedicatedRep && [currentHovered, currentSelected].some(code => {
            const activeRep = code && getRep(code);
            return activeRep && !activeRep.isHouse && activeRep.id === rep.id;
          });

          let style;
          if (isSelected) style = MAP_COLORS.selected;
          else if (isHovered) style = hasDedicatedRep ? MAP_COLORS.repHover : MAP_COLORS.houseHover;
          else if (inActiveTerritory) style = MAP_COLORS.territory;
          else style = hasDedicatedRep ? MAP_COLORS.rep : MAP_COLORS.house;

          element.style.fill = style.fill;
          element.style.stroke = style.stroke;
          element.style.strokeWidth = style.strokeWidth;
        };

        updateStyle();

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

        element.addEventListener('click', clickHandler);
        element.addEventListener('mouseenter', mouseEnterHandler);
        element.addEventListener('mouseleave', mouseLeaveHandler);

        const titleEl = element.querySelector('title');
        if (titleEl) {
          titleEl.textContent = hasDedicatedRep
            ? `${stateName} – ${rep.name}`
            : `${stateName} – Served by our main office`;
        }
      });
    });

    const statesWithReps = Array.from(stateElementsMap.keys())
      .filter(code => !getRep(code)?.isHouse)
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

  // Draw the selected state's full name as a pill on the map itself
  useEffect(() => {
    const container = containerRef.current;
    const svg = container?.querySelector('svg');
    if (!svg || !stateElementsMap) return;

    const draw = () => {
      svg.querySelector(`#${LABEL_ID}`)?.remove();
      const elements = selectedState && stateElementsMap.get(selectedState);
      const viewBox = svg.viewBox.baseVal;
      const renderedWidth = svg.getBoundingClientRect().width;
      if (!elements?.length || !viewBox?.width || !renderedWidth) return;

      const box = elements
        .map(el => el.getBBox())
        .reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
      const [fx, fy] = LABEL_ANCHORS[selectedState] || [0.5, 0.5];
      const cx = box.x + box.width * fx;
      const cy = box.y + box.height * fy;

      // Keep the text ~13px on screen regardless of how small the map renders
      const fontSize = Math.max(13, 13 * (viewBox.width / renderedWidth));
      const height = fontSize * 1.9;
      const padX = fontSize * 0.75;

      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('id', LABEL_ID);
      group.style.pointerEvents = 'none';

      const pill = document.createElementNS(SVG_NS, 'rect');
      const text = document.createElementNS(SVG_NS, 'text');
      const dot = document.createElementNS(SVG_NS, 'circle');

      text.textContent = getStateName(selectedState);
      text.setAttribute('font-size', fontSize);
      text.setAttribute('font-weight', '700');
      text.setAttribute('fill', '#fde68a');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.style.fontFamily = 'inherit';
      text.style.letterSpacing = '0.02em';

      group.append(pill, text, dot);
      svg.append(group);

      const width = text.getComputedTextLength() + padX * 2;
      const x = Math.min(Math.max(cx - width / 2, 4), viewBox.width - width - 4);
      const gap = fontSize * 0.7;
      const y = cy - height - gap >= 4 ? cy - height - gap : cy + gap;

      pill.setAttribute('x', x);
      pill.setAttribute('y', y);
      pill.setAttribute('width', width);
      pill.setAttribute('height', height);
      pill.setAttribute('rx', height / 2);
      pill.setAttribute('fill', '#121212');
      pill.setAttribute('fill-opacity', '0.92');
      pill.setAttribute('stroke', '#f4a52d');
      pill.setAttribute('stroke-width', fontSize * 0.1);

      text.setAttribute('x', x + width / 2);
      text.setAttribute('y', y + height / 2);

      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', cy);
      dot.setAttribute('r', fontSize * 0.28);
      dot.setAttribute('fill', '#121212');
      dot.setAttribute('stroke', '#fde68a');
      dot.setAttribute('stroke-width', fontSize * 0.12);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => {
      observer.disconnect();
      svg.querySelector(`#${LABEL_ID}`)?.remove();
    };
  }, [selectedState, stateElementsMap]);

  return (
    <div className="relative w-full">
      {/* Loading overlay */}
      {isLoading && (
        <div className="flex items-center justify-center h-96 bg-dark-700 rounded-lg border border-dark-500">
          <LoadingSpinner tone="dark" label="Loading interactive map..." />
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
        style={{ minHeight: '200px' }}
      />
    </div>
  );
};

export default USMapInteractive;
