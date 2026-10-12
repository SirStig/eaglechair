import { Link } from 'react-router-dom';

const isPlainLeftClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * A real link to a row's editor, so right-click "Open in new tab" / "Copy link"
 * and Cmd/Ctrl/middle-click work. A plain click runs `onOpen` instead when
 * given (keeps the list's own open behaviour, e.g. history state).
 */
const RowLink = ({ to, onOpen, onClick, ...props }) => (
  <Link
    to={to}
    onClick={(e) => {
      onClick?.(e);
      if (onOpen && !e.defaultPrevented && isPlainLeftClick(e)) {
        e.preventDefault();
        onOpen();
      }
    }}
    {...props}
  />
);

export default RowLink;
