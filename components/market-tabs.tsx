import Link from "next/link";

/** Property NFTs / Resources switch shared by the two market pages. */
export function MarketTabs({ active }: { active: "properties" | "resources" }) {
  return (
    <nav className="hud-switch" aria-label="Market">
      <Link href="/market" aria-current={active === "properties" ? "page" : undefined}>
        Property NFTs
      </Link>
      <Link href="/market/resources" aria-current={active === "resources" ? "page" : undefined}>
        Resources
      </Link>
    </nav>
  );
}
