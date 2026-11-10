import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { PageHeader, SectionHeader, tint } from "@/components/hud";
import { DEVLOG_COOKIE, devlogPosts, devlogToken, tokenValid } from "@/lib/devlog";
import shipped from "@/lib/devlog.json";
import { lockDevlog, unlockDevlog } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dev log",
  robots: { index: false, follow: false },
};

const KIND_COLOR: Record<string, string> = {
  New: "var(--hud-cyan)",
  Fix: "var(--hud-amber)",
  Faster: "var(--good)",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "## heading", "- bullet" and blank-line paragraphs, with **bold**. */
function Body({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong> : part,
    );
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={out.length} className="ml-5 list-disc space-y-1">
          {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("- ")) {
      bullets.push(t.slice(2));
      continue;
    }
    flush();
    if (!t) continue;
    if (t.startsWith("## ")) {
      out.push(<h3 key={out.length} className="hud-label mt-2 text-[color:var(--hud-cyan)]">{t.slice(3)}</h3>);
    } else {
      out.push(<p key={out.length}>{inline(t)}</p>);
    }
  }
  flush();
  return <div className="flex flex-col gap-2 text-sm text-muted">{out}</div>;
}

function Locked({ wrong, configured }: { wrong: boolean; configured: boolean }) {
  return (
    <div className="hud">
      <form action={unlockDevlog} className="hud-panel mx-auto mt-10 flex max-w-sm flex-col gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold uppercase">Dev log</h1>
        <p className="text-sm text-muted">Team only. Enter the PIN.</p>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={12}
          aria-label="PIN"
          className="mono border border-border bg-surface-2/50 px-3 py-2 text-center text-xl tracking-[0.5em]"
        />
        {wrong && <p className="text-sm text-bad">Wrong PIN.</p>}
        {!configured && <p className="text-sm text-bad">No PIN is set up yet (DEVLOG_PIN).</p>}
        <button className="hud-btn">Open</button>
      </form>
    </div>
  );
}

export default async function DevlogPage({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  const cookie = (await cookies()).get(DEVLOG_COOKIE)?.value;
  if (!tokenValid(cookie)) {
    return <Locked wrong={(await searchParams).wrong === "1"} configured={devlogToken() !== null} />;
  }

  const posts = await devlogPosts();
  const byDate = new Map<string, typeof shipped>();
  for (const e of shipped) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return (
    <div className="hud mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader kicker="Team only · progress" title="Dev log" blurb="Written updates on what's happening and what's needed, then everything that has shipped, newest first.">
        <form action={lockDevlog}>
          <button className="hud-btn hud-btn-ghost !py-2 !text-[0.7rem]">Lock</button>
        </form>
      </PageHeader>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Updates" aside={posts ? `${posts.length} posts` : undefined} />
        {posts === null && <div className="hud-panel p-5 text-sm text-bad">Updates couldn&apos;t load. Try again shortly.</div>}
        {posts?.length === 0 && <div className="hud-panel p-5 text-sm text-muted">No updates posted yet.</div>}
        {posts?.map((p) => (
          <article key={p.id} className="hud-panel flex flex-col gap-3 p-5">
            <div>
              <div className="hud-label">{day(p.postedAt)}</div>
              <h2 className="mt-1 text-xl font-bold">{p.title}</h2>
            </div>
            <Body text={p.body} />
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Shipped" aside={`${shipped.length} changes`} />
        <div className="hud-panel flex flex-col gap-5 p-5">
          {[...byDate].map(([date, items]) => (
            <div key={date}>
              <div className="hud-label">{day(date)}</div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {items.map((e) => (
                  <li key={e.hash} className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="hud-tag" style={tint(KIND_COLOR[e.kind] ?? "var(--hud-cyan)")}>{e.kind}</span>
                    {e.area && <span className="text-xs text-muted">{e.area}</span>}
                    <span>{e.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
