const eastAfricaTimeZone = "Africa/Nairobi";

export function toEATDateTimeLocal(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: eastAfricaTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function eatDateTimeLocalToISOString(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid East Africa date and time.");

  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 3,
    Number(minute),
  ));

  if (toEATDateTimeLocal(date.toISOString()) !== value) {
    throw new Error("Enter a valid East Africa date and time.");
  }

  return date.toISOString();
}

export function formatEATDateTime(value: string) {
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: eastAfricaTimeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value))} EAT`;
}
