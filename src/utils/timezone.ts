const IST_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 5 * 60 + 30; // +05:30

const IST_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIMEZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateToIST(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date provided to formatDateToIST");
  }
  return IST_FORMATTER.format(date);
}

const TZ_MARKER_REGEX = /(Z|[+-]\d{2}:\d{2})$/i;
const NAIVE_ISO_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

export function parseDateAssumingIST(input: Date | string | number): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new Error("Invalid date provided to parseDateAssumingIST");
    }
    return input;
  }

  const raw = String(input).trim();
  if (!raw) throw new Error("Empty date provided to parseDateAssumingIST");

  if (TZ_MARKER_REGEX.test(raw)) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Invalid date provided to parseDateAssumingIST");
    }
    return parsed;
  }

  const match = raw.match(NAIVE_ISO_REGEX);
  if (!match) {
    throw new Error(
      "Invalid date format; expected ISO string optionally ending with timezone"
    );
  }

  const [, y, m, d, hh, mm, ss = "0", ms = "0"] = match;
  const utcMillis = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
    Number(ms.padEnd(3, "0"))
  );

  return new Date(utcMillis - IST_OFFSET_MINUTES * 60 * 1000);
}
