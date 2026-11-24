import { notFound } from "next/navigation";
import { InputStylePreview } from "./InputStylePreview";

export default function InputStylesPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InputStylePreview />;
}
