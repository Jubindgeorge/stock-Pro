import { format } from 'date-fns';

export const genId = () => 'id_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1000);

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');

export const fmtDate = (iso: string) => {
  if (!iso) return '-';
  try {
    return format(new Date(iso), 'dd/MM/yyyy');
  } catch (e) {
    return iso;
  }
};

export const fmtDateTime = (iso: string) => {
  if (!iso) return '-';
  try {
    return format(new Date(iso), 'dd/MM/yyyy HH:mm:ss');
  } catch (e) {
    return iso;
  }
};

export const normalizeGroup = (g: string) => {
  return String(g || '').trim().toUpperCase().replace(/\s+/g, '');
};

export const escapeHtml = (s: string) => {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c as keyof any] || c));
};
