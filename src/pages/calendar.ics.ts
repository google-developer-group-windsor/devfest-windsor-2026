
import type { APIRoute } from "astro";

// This endpoint must run dynamically to read event query parameters.


function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function isValidUtcDate(value: string): boolean {
  if (!/^\d{8}T\d{6}Z$/.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(9, 11));
  const minute = Number(value.slice(11, 13));
  const second = Number(value.slice(13, 15));

  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function formatUtcDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function createEventUid(title: string, start: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `${slug || "session"}-${start}@wedevfest.com`;
}

export const GET: APIRoute = ({ url }) => {
  const params = url.searchParams;

  const title = (params.get("title") || "").trim();
  const speaker = (params.get("speaker") || "").trim();
  const description = (params.get("description") || "").trim();
  const location = (params.get("location") || "").trim();
  const start = (params.get("start") || "").trim();
  const end = (params.get("end") || "").trim();

  if (!title || !isValidUtcDate(start) || !isValidUtcDate(end)) {
    return new Response("Invalid calendar event", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const startDate = Date.parse(
    `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T${start.slice(9, 11)}:${start.slice(11, 13)}:${start.slice(13, 15)}Z`,
  );

  const endDate = Date.parse(
    `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}T${end.slice(9, 11)}:${end.slice(11, 13)}:${end.slice(13, 15)}Z`,
  );

  if (endDate <= startDate) {
    return new Response("Event end time must be after start time", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const details = [
    speaker ? `Speaker: ${speaker}` : "",
    description,
    "Google DevFest Windsor 2026",
    "https://wedevfest.com/",
  ]
    .filter(Boolean)
    .join("\n\n");

  const event = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DevFest Windsor 2026//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:DevFest Windsor 2026",
    "BEGIN:VEVENT",
    `UID:${createEventUid(title, start)}`,
    `DTSTAMP:${formatUtcDate(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(details)}`,
    `LOCATION:${escapeIcsText(location)}`,
    "URL:https://wedevfest.com/",
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(event, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="devfest-session.ics"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
