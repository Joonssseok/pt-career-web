import { notFound } from "next/navigation";
import WireframePreview from "./WireframePreview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <WireframePreview />;
}
