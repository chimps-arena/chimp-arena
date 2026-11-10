import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { PageHeader, SectionHeader, tint } from "@/components/hud";
import { DEVLOG_COOKIE, devlogPosts, devlogTasks, devlogToken, tokenValid, type DevlogTask } from "@/lib/devlog";
import shipped from "@/lib/devlog.json";
import { addTask, completeTask, lockDevlog, reopenTask, unlockDevlog } from "./actions";

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

const field = "border border-border bg-surface-2/50 px-3 py-2 text-sm";
/** Side by side on wide screens, each column scrolls on its own. */
const column = "flex min-w-0 flex-col gap-4 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-2";

function TodoList({ tasks, name }: { tasks: DevlogTask[] | null; name: string }) {
  const open = tasks?.filter((t) => !t.doneAt) ?? [];
  const done = tasks?.filter((t) => t.doneAt) ?? [];
  return (
    <section id="todo" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
      <SectionHeader title="To-do" aside={tasks ? `${open.length} open` : undefined} />
      <div className={column}>

      <form action={addTask} className="hud-panel flex flex-col gap-3 p-5">
        <input name="title" required maxLength={300} placeholder="What needs fixing or doing?" className={field} />
        <textarea name="details" maxLength={2000} rows={2} placeholder="Details, links, where it happens (optional)" className={field} />
        <div className="flex flex-wrap items-center gap-3">
          <input name="addedBy" maxLength={40} defaultValue={name} placeholder="Your name" className={`${field} w-40`} />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="urgent" /> Urgent
          </label>
          <button className="hud-btn ml-auto !py-2 !text-[0.7rem]">Add task</button>
        </div>
      </form>

      {tasks === null && <div className="hud-panel p-5 text-sm text-bad">The to-do list couldn&apos;t load. Try again shortly.</div>}
      {tasks && open.length === 0 && <div className="hud-panel p-5 text-sm text-muted">Nothing open.</div>}
      {open.map((t) => (
        <div key={t.id} className="hud-panel flex flex-col gap-3 p-5" style={t.urgent ? tint("var(--bad)") : undefined}>
          <div className="flex flex-wrap items-baseline gap-2">
            {t.urgent && <span className="hud-tag" style={tint("var(--bad)")}>Urgent</span>}
            <span className="font-semibold">{t.title}</span>
          </div>
          {t.details && <p className="whitespace-pre-line text-sm text-muted">{t.details}</p>}
          <div className="text-xs text-muted">
            #{t.id} · added {day(t.createdAt)}{t.addedBy && ` by ${t.addedBy}`}
          </div>
          <form action={completeTask.bind(null, t.id)} className="flex flex-wrap gap-2">
            <input name="note" maxLength={500} placeholder="What was done (optional)" className={`${field} min-w-0 flex-1`} />
            <button className="hud-btn hud-btn-ghost !py-2 !text-[0.7rem]">Mark done</button>
          </form>
        </div>
      ))}

      {done.length > 0 && (
        <details className="hud-panel p-5">
          <summary className="hud-label cursor-pointer">Done ({done.length})</summary>
          <ul className="mt-3 flex flex-col gap-3">
            {done.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-muted line-through">{t.title}</span>
                {t.doneNote && <span className="text-good">{t.doneNote}</span>}
                <span className="text-xs text-muted">{day(t.doneAt!)}</span>
                <form action={reopenTask.bind(null, t.id)} className="ml-auto">
                  <button className="text-xs text-muted underline hover:text-foreground">Reopen</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
      </div>
    </section>
  );
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
  const jar = await cookies();
  if (!tokenValid(jar.get(DEVLOG_COOKIE)?.value)) {
    return <Locked wrong={(await searchParams).wrong === "1"} configured={devlogToken() !== null} />;
  }

  const [posts, tasks] = await Promise.all([devlogPosts(), devlogTasks()]);
  const byDate = new Map<string, typeof shipped>();
  for (const e of shipped) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return (
    <div className="hud mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader kicker="Team only · progress" title="Dev log" blurb="The team's to-do list, written updates on what's happening and what's needed, then everything that has shipped.">
        <form action={lockDevlog}>
          <button className="hud-btn hud-btn-ghost !py-2 !text-[0.7rem]">Lock</button>
        </form>
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-6">
        <TodoList tasks={tasks} name={jar.get("devlog_name")?.value ?? ""} />

        <section className="flex min-w-0 flex-col gap-4">
          <SectionHeader title="Updates" aside={posts ? `${posts.length} posts` : undefined} />
          <div className={column}>
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
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Shipped" aside={`${shipped.length} changes`} />
        <div className="hud-panel flex max-h-[32rem] flex-col gap-5 overflow-y-auto p-5">
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
