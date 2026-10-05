import { useFitText } from '../../../hooks/useFitText';

/**
 * Button label that shrinks (down to `min` px, over up to `maxLines` lines)
 * so long action names fit buttons of a fixed width.
 */
export default function FitLabel({ text, min = 10.5, max = 14, maxLines = 2, className = '' }) {
  const { ref, lineHeight } = useFitText(text, { min, max, maxLines, lineHeight: 1.15 });
  return (
    <span ref={ref} className={`block w-full min-w-0 break-words ${className}`} style={{ lineHeight }}>
      {text}
    </span>
  );
}
