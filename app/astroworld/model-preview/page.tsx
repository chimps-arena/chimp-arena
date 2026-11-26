import { notFound } from "next/navigation";
import { ModelPreview } from "../../../components/astroworld/model-preview";

// Dev-only: a property model front-on with a 1 m grid, for placing signs and
// for side-by-side checks against the NFT art.
export default function ModelPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main><ModelPreview /></main>;
}
