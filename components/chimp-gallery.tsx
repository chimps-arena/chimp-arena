import { SectionHeader, tint } from "@/components/hud";
import { fastImage } from "@/lib/nft-image";
import { supabaseAdmin } from "@/lib/supabase/server";

interface Style {
  id: string;
  tier: "standard" | "rare";
  name: string;
  image_url: string;
}

const TIERS = [
  { tier: "rare", label: "Rare", odds: "15%", color: "var(--accent-3)" },
  { tier: "standard", label: "Standard", odds: "85%", color: "var(--hud-cyan)" },
] as const;

/** The Astrochimps a mint can actually draw - every live art style, by tier. */
export async function ChimpGallery() {
  const { data } = await supabaseAdmin()
    .from("chimp_style_variants")
    .select("id, tier, name, image_url")
    .eq("retired", false)
    .not("image_url", "is", null)
    .order("name");
  const styles = (data ?? []) as Style[];
  if (styles.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="What you can mint" aside={`${styles.length} styles`} />
      {TIERS.map(({ tier, label, odds, color }) => {
        const list = styles.filter((s) => s.tier === tier);
        if (list.length === 0) return null;
        return (
          <div key={tier} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="hud-tag" style={tint(color)}>{label} · {odds}</span>
              <span className="text-xs text-muted">{list.length} styles</span>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((s) => (
                <figure key={s.id} className="hud-panel flex flex-col gap-2 p-2" style={tint(color)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fastImage(s.image_url)}
                    alt={`${s.name} Astrochimp`}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <figcaption className="truncate text-center text-xs text-muted">
                    {s.name.replace(/^(Standard|Rare)\s+/, "")}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
