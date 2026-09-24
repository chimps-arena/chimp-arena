import { CreatePropertyCollection } from "@/components/create-property-collection";

export const metadata = {
  title: "Create Astrochimps Properties Collection",
};

export default function CreatePropertyCollectionPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-black">Properties Collection Setup</h1>
        <p className="mt-1 text-sm text-muted">
          One-time. Any funded wallet can connect and pay for this — it
          doesn&apos;t need to be the Astro Corp wallet. Astro Corp becomes
          the collection&apos;s update authority regardless of who signs.
        </p>
      </div>
      <CreatePropertyCollection />
    </div>
  );
}
