import { formatInTimeZone } from 'date-fns-tz';

export type EventDateLabels = {
  dateLabel: string;
  timeLabel: string;
  timezoneLabel: string;
};

const toSafeTimezone = (timezone: string): string => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
};

export function formatEventDates(startsAt: string, endsAt: string, timezone: string): EventDateLabels {
  const zone = toSafeTimezone(timezone);
  const sameDay =
    formatInTimeZone(new Date(startsAt), zone, 'yyyy-MM-dd') ===
    formatInTimeZone(new Date(endsAt), zone, 'yyyy-MM-dd');

  if (sameDay) {
    return {
      dateLabel: formatInTimeZone(new Date(startsAt), zone, 'EEE, d MMM yyyy'),
      timeLabel: `${formatInTimeZone(new Date(startsAt), zone, 'h:mm a')} – ${formatInTimeZone(
        new Date(endsAt),
        zone,
        'h:mm a',
      )}`,
      timezoneLabel: timezone,
    };
  }

  return {
    dateLabel: `${formatInTimeZone(new Date(startsAt), zone, 'EEE, d MMM')} – ${formatInTimeZone(
      new Date(endsAt),
      zone,
      'EEE, d MMM yyyy',
    )}`,
    timeLabel: `${formatInTimeZone(new Date(startsAt), zone, 'h:mm a')} (${formatInTimeZone(
      new Date(endsAt),
      zone,
      'h:mm a',
    )})`,
    timezoneLabel: timezone,
  };
}

export function formatEventStart(startsAt: string, timezone: string): string {
  const zone = toSafeTimezone(timezone);
  return formatInTimeZone(new Date(startsAt), zone, 'EEE, d MMM · h:mm a');
}
