import { createHmac, timingSafeEqual } from "node:crypto";
export const PERSONAL_TICKET_SECONDS = 600;
export function signPersonalTicket(
  userId: string,
  session: string,
  secret: string,
  now = Date.now(),
) {
  const expires = Math.floor(now / 1000) + PERSONAL_TICKET_SECONDS;
  const signature = createHmac("sha256", secret)
    .update(`${userId}:${session}:${expires}`)
    .digest("hex");
  return `${expires}.${signature}`;
}
export function verifyPersonalTicket(
  ticket: string | undefined,
  userId: string,
  session: string,
  secret: string,
  now = Date.now(),
) {
  if (!ticket) return false;
  const [raw, signature, ...extra] = ticket.split(".");
  const expires = Number(raw);
  const time = Math.floor(now / 1000);
  if (
    extra.length ||
    !Number.isInteger(expires) ||
    expires <= time ||
    expires > time + PERSONAL_TICKET_SECONDS ||
    !/^[a-f0-9]{64}$/.test(signature || "")
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${userId}:${session}:${expires}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
