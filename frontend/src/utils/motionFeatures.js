// Loaded asynchronously by <LazyMotion> in App.jsx so the animation engine
// isn't part of the entry chunk. No component uses layout/drag animations,
// so domAnimation (animate, exit, variants, hover/tap/focus, inView) is enough.
import { domAnimation } from 'framer-motion';

export default domAnimation;
