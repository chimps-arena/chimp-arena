import { CollectionAuthority } from "@/components/collection-authority";

export const metadata = {
  title: "Astrochimps Collection Authority",
};

export default function CollectionAuthorityPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-black">Collection Authority Setup</h1>
        <p className="mt-1 text-sm text-muted">
          Two one-time steps, both signed by Astro Corp. Do them in order.
        </p>
      </div>
      <CollectionAuthority />
    </div>
  );
}
