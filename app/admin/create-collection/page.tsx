import { CreateCollection } from "@/components/create-collection";

export const metadata = {
  title: "Create Astrochimps Collection",
};

export default function CreateCollectionPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-black">Astrochimps Collection Setup</h1>
        <p className="mt-1 text-sm text-muted">
          One-time. Must be signed by the Astro Corp wallet — it becomes the
          collection&apos;s update authority.
        </p>
      </div>
      <CreateCollection />
    </div>
  );
}
