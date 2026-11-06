/** Keep unknown legacy text intact; normalize only complete, valid dates/ranges. */
export function formatActivityPeriod(value: string): string {
  const text = value.trim();
  const parts = text.split(/\s*(?:~|～|–|—)\s*|\s+-\s+|(?<=^\d{4})-(?=\d{4}$)/);
  if (parts.length > 2) return text;
  const formatted = parts.map(formatDate);
  return formatted.every((part) => part !== null)
    ? formatted.join(" ~ ")
    : text;
}

function formatDate(text: string): string | null {
  if (text === "현재" || text === "진행 중" || text === "진행중") return "현재";
  const compact = /^(\d{4})(\d{2})(\d{2})?$/.exec(text);
  const match =
    compact ??
    /^(\d{4}|\d{2})(?:\s*년(?:\s*(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일)?)?|\s*[./-]\s*(\d{1,2})(?:\s*[./-]\s*(\d{1,2}))?\s*\.?)?$/.exec(
      text,
    );
  if (!match) return null;
  const year = Number(match[1].length === 2 ? "20" + match[1] : match[1]);
  const month = Number(compact ? match[2] : (match[2] ?? match[4]));
  const day = Number(compact ? match[3] : (match[3] ?? match[5]));
  if (year < 1000 || year > 9999) return null;
  if (Number.isNaN(month)) return `${year}년`;
  if (month < 1 || month > 12) return null;
  if (Number.isNaN(day)) return `${year}년 ${month}월`;
  if (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())
    return null;
  return `${year}년 ${month}월 ${day}일`;
}
