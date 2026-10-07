/** Small shared formatters for the planner UI. */

export const titleCase = (value: string): string =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

/** `weight_management` → `Weight Management`. */
export const formatGoal = (goal: string): string => titleCase(goal);

/** `monday` → `Monday`. */
export const formatDay = (dayName: string): string => titleCase(dayName);

export const formatMinutes = (minutes: number): string =>
  `${Math.max(0, Math.round(minutes))} min`;

export const formatSeconds = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
};

/** ISO string or Date → human date; degrades gracefully on unexpected values. */
export const formatDate = (input: Date | string | undefined): string => {
  if (input == null) return 'Unknown date';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

export const pluralise = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;
