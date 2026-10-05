/**
 * Tap-to-call / tap-to-email links and the contact details customers see.
 */

/** tel: link for a display number ("(555) 123-4567 ext 2" -> tel:5551234567,2) */
export const telHref = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  const [main, ext] = phone.split(/\s*(?:ext\.?|x|#)\s*/i);
  const digits = main.replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length < 7) return null;
  const extDigits = ext ? ext.replace(/\D/g, '') : '';
  return `tel:${digits}${extDigits ? `,${extDigits}` : ''}`;
};

export const mailtoHref = (email) =>
  email && typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? `mailto:${email.trim()}` : null;

/**
 * The phone and email shown to customers: the sales line, falling back to the
 * main office when a sales value isn't set.
 */
export const salesContact = (settings) => ({
  phone: settings?.salesPhone || settings?.primaryPhone || '',
  email: settings?.salesEmail || settings?.primaryEmail || '',
});
