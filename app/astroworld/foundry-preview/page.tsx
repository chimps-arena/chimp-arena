import { notFound } from "next/navigation";
import { FoundryInteriorPreview } from "../../../components/astroworld/foundry-interior-preview";

export default function FoundryPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main><FoundryInteriorPreview /></main>;
}
