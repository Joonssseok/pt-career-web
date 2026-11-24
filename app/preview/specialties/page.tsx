import { notFound } from "next/navigation";
import { SpecialtyCategoriesPreview } from "./SpecialtyCategoriesPreview";

export default function SpecialtyPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SpecialtyCategoriesPreview />;
}
