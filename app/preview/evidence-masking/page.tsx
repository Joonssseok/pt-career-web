import { notFound } from "next/navigation";
import { EvidenceMaskingPreview } from "./EvidenceMaskingPreview";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <EvidenceMaskingPreview />;
}
