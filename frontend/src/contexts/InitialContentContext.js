import { createContext } from 'react';

/**
 * contentData.json snapshot for server rendering.
 *
 * The SSR entry provides it per request so concurrent renders never share
 * module-level state. On the client it stays null: the same payload is
 * embedded as window.__INITIAL_CONTENT__ and adopted by contentDataLoader.
 */
const InitialContentContext = createContext(null);

export default InitialContentContext;
