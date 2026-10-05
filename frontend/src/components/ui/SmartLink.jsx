import { Link } from 'react-router-dom';

/**
 * Link for admin-entered URLs: pages on this site go through the router,
 * outside sites (social profiles, suppliers, ...) open in a new tab, and
 * mailto: / tel: open the mail or phone app.
 */
export default function SmartLink({ to, children, ...rest }) {
  const href = typeof to === 'string' ? to.trim() : '';
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  if (/^(mailto|tel):/i.test(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href || '#'} {...rest}>
      {children}
    </Link>
  );
}
