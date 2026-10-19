import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const TIME_ZONE = 'America/Bogota';
const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const calendarDate = (timestamp: string): string => {
  const date = parseISO(timestamp);
  if (!isValid(date)) return '';
  const parts = calendar.formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export const today = () => calendarDate(new Date().toISOString());
export const isPast = (date: string, now = today()) => Boolean(date) && date < now;
export const displayDate = (date: string) => {
  const parsed = parseISO(date.includes('T') ? calendarDate(date) : date);
  return isValid(parsed) ? format(parsed, 'dd MMM yyyy', { locale: es }) : 'Sin fecha';
};
