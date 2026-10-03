import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal — CHIMP Arena",
  description: "Terms, Privacy & Disclaimer for Astrochimpz ($CHIMP).",
};

/**
 * Ported verbatim from the astrochimpz.com marketing site (the one being
 * replaced by this app) ahead of the domain migration - this is live,
 * founder-published legal text (dated 2026-10-03 on the source site), not
 * a draft. Wording is intentionally unchanged from the source.
 */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="font-display text-2xl font-black md:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 font-display text-xl font-bold">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 leading-relaxed text-muted">{children}</p>;
}

export default function LegalPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mono mb-2 text-xs uppercase tracking-widest text-accent">Legal</div>
      <h1 className="font-display text-5xl font-black md:text-6xl">
        Terms, Privacy &amp; Disclaimer
      </h1>
      <p className="mt-3 text-muted">Last updated: {lastUpdated}</p>

      <nav className="card mt-8 flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm">
        <a href="#disclaimer" className="text-accent hover:underline">Risk Disclaimer</a>
        <a href="#tos" className="text-accent hover:underline">Terms of Service</a>
        <a href="#privacy" className="text-accent hover:underline">Privacy Policy</a>
        <a href="#game" className="text-accent hover:underline">Game Terms</a>
        <a href="#contact" className="text-accent hover:underline">Contact</a>
      </nav>

      <div className="card mt-12 flex gap-4 border-bad/40 bg-bad/5 p-5">
        <div className="text-sm text-foreground/90">
          <b>You use Astrochimpz entirely at your own risk.</b> Cryptocurrency is
          volatile. You may lose all funds. Nothing on this site is investment,
          legal, tax, or financial advice.
        </div>
      </div>

      <Section id="disclaimer" title="1. Risk Disclaimer & Waiver of Liability">
        <P>
          Astrochimpz ($CHIMP) is an experimental, community-driven
          cryptocurrency project deployed on the Solana blockchain.
          Participation involves substantial risk. By accessing this website,
          connecting a wallet, acquiring, holding, transferring, or otherwise
          interacting with $CHIMP, related NFT collections, the Moon Rock Run
          game, the Astroworld, or any other Astrochimpz product or service
          (collectively, the &ldquo;Services&rdquo;), you acknowledge, accept,
          and assume all such risk in full.
        </P>
        <P>
          The Services are provided on an &ldquo;AS IS&rdquo; and &ldquo;AS
          AVAILABLE&rdquo; basis, without warranties of any kind, whether
          express, implied, statutory, or otherwise, including (without
          limitation) warranties of merchantability, fitness for a particular
          purpose, non-infringement, availability, uptime, accuracy, or
          continuous operation.
        </P>
        <SubHeading>Full waiver of liability.</SubHeading>
        <P>
          To the maximum extent permitted by applicable law, Astrochimpz, its
          founders, contributors, contractors, agents, affiliates, and any
          related entities (collectively, the &ldquo;Astrochimpz
          Parties&rdquo;) shall have <b>no liability whatsoever</b> for any
          loss, damage, cost, or expense - including without limitation the
          loss of tokens, coins, NFTs, in-game assets, digital collectibles,
          profits, revenue, data, goodwill, or wallet access - arising out of
          or in connection with your use of the Services. This waiver applies
          to direct, indirect, incidental, consequential, special, exemplary,
          and punitive damages, and it applies even in the event of failure,
          bug, exploit, downtime, hack, third-party attack, smart-contract
          flaw, negligence, error, or other fault attributable in whole or in
          part to any of the Astrochimpz Parties.
        </P>
        <SubHeading>Not securities; not advice.</SubHeading>
        <P>
          $CHIMP is a utility and community token intended for use inside the
          Astrochimpz ecosystem. It is not a share, equity interest, debt
          instrument, or claim on the assets, profits, or revenues of any
          entity. Nothing on this site is an offer to sell, a solicitation to
          buy, or a recommendation to trade any asset, and nothing here is
          investment, legal, tax, or financial advice.
        </P>
        <P>
          Astrochimpz never holds your private keys. You are solely
          responsible for the security of your wallet, seed phrase, and
          devices, and for verifying any transaction before signing.
        </P>
        <SubHeading>Jurisdictional access.</SubHeading>
        <P>
          It is your responsibility to determine whether your use of the
          Services is lawful in your jurisdiction. If it is not, you must not
          use them.
        </P>
      </Section>

      <Section id="tos" title="2. Terms of Service">
        <SubHeading>2.1 Eligibility</SubHeading>
        <P>
          You must be of legal age in your jurisdiction to enter binding
          contracts, and you must not be located in, or a national or
          resident of, any jurisdiction where use of the Services is
          prohibited. You must not be on any applicable sanctions list.
        </P>
        <SubHeading>2.2 Acceptable Use</SubHeading>
        <P>You agree not to:</P>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-muted">
          <li>use the Services for any unlawful purpose, including money laundering or terrorist financing;</li>
          <li>attempt to gain unauthorised access to systems, data, or other users&apos; accounts;</li>
          <li>exploit bugs, cheat, botsystems, or otherwise manipulate the Moon Rock Run game or leaderboards;</li>
          <li>impersonate the Astrochimpz Parties or misrepresent affiliation;</li>
          <li>scrape, mass-download, or overload the Services or their supporting infrastructure.</li>
        </ul>
        <SubHeading>2.3 Intellectual Property</SubHeading>
        <P>
          The Astrochimpz name, logo, branding, code, artwork, and content are
          the property of the Astrochimpz Parties or their licensors. NFTs
          you mint or purchase confer only the on-chain ownership rights and
          licences expressly published at the time of mint.
        </P>
        <SubHeading>2.4 Third-Party Services</SubHeading>
        <P>
          The Services integrate with third parties such as Phantom, Raydium,
          Solana RPCs, Dexscreener, Jupiter, Solscan, and Telegram. The
          Astrochimpz Parties do not control those services and accept no
          liability for their acts, omissions, downtime, fees, or errors.
        </P>
        <SubHeading>2.5 Changes; Termination</SubHeading>
        <P>
          We may modify, suspend, or terminate any part of the Services at
          any time, without notice or liability. Continued use after changes
          constitutes acceptance of the revised terms.
        </P>
        <SubHeading>2.6 Indemnity</SubHeading>
        <P>
          You agree to indemnify and hold harmless the Astrochimpz Parties
          from any claim, loss, damage, or expense (including reasonable
          legal fees) arising from your breach of these terms or your use of
          the Services.
        </P>
        <SubHeading>2.7 Governing Law & Dispute Resolution</SubHeading>
        <P>
          These terms are governed by the laws applicable to the Astrochimpz
          Parties&apos; primary operating jurisdiction, without regard to
          conflict-of-laws principles. Disputes are to be resolved by binding
          individual arbitration; class actions are waived to the maximum
          extent permitted by law.
        </P>
      </Section>

      <Section id="privacy" title="3. Privacy Policy">
        <SubHeading>3.1 Information We Process</SubHeading>
        <P>We aim to collect the minimum necessary:</P>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-muted">
          <li>
            <b>Wallet address</b> - when you connect a wallet, your public
            Solana address is visible to us to display balances and gate
            features.
          </li>
          <li>
            <b>Public on-chain data</b> - token balances, transactions, and
            NFT ownership are read from public Solana infrastructure.
          </li>
          <li>
            <b>Technical data</b> - server logs, error reports, IP addresses,
            browser and device metadata for security and reliability.
          </li>
          <li>
            <b>Gameplay data</b> - Moon Rock Run scores and inputs you submit
            to the site.
          </li>
        </ul>
        <P>
          We never ask for, receive, or store your private keys, seed
          phrase, or wallet passwords. Never share these with anyone.
        </P>
        <SubHeading>3.2 How We Use It</SubHeading>
        <P>
          To operate and secure the Services, prevent abuse, display
          balances, gate token-holder features, publish anonymous or
          aggregated analytics, and communicate about the project.
        </P>
        <SubHeading>3.3 Sharing</SubHeading>
        <P>
          We share information with service providers that host, index,
          monitor, or protect the Services (e.g. RPC providers, hosting
          providers, analytics processors). We may disclose information when
          required by law, subpoena, or to protect the rights, safety, or
          property of any person.
        </P>
        <SubHeading>3.4 Cookies</SubHeading>
        <P>
          We use functional local storage and cookies to keep you connected
          and to remember settings. Third-party tools we integrate may set
          their own cookies subject to their own policies.
        </P>
        <SubHeading>3.5 Your Rights</SubHeading>
        <P>
          Depending on your jurisdiction, you may have the right to access,
          correct, or delete personal data we hold about you, or to object to
          certain processing. Contact us using the details below to make a
          request.
        </P>
        <SubHeading>3.6 Blockchain Data is Permanent</SubHeading>
        <P>
          Transactions on Solana are public and immutable. We cannot delete
          or alter them.
        </P>
      </Section>

      <Section id="game" title="4. Game Terms (Moon Rock Run)">
        <P>
          Moon Rock Run is provided for entertainment. Access may be gated by
          a minimum $CHIMP balance in the connected wallet. Scores are
          advisory. Leaderboards, rewards, and any economic features are
          experimental and may be reset, modified, or removed at any time.
          The Astrochimpz Parties are not liable for any loss of score,
          ranking, reward, or associated value, whether caused by bug,
          exploit, downtime, or otherwise.
        </P>
      </Section>

      <Section id="contact" title="5. Contact">
        <P>
          For legal or privacy requests, reach us through the official
          Astrochimpz Telegram channel or via published social channels. We
          will respond as promptly as practicable.
        </P>
      </Section>

      <p className="mt-12 text-xs text-muted">
        By using Astrochimpz you confirm that you have read, understood, and
        agreed to this Legal document in full, including the waiver of
        liability above.
      </p>
    </div>
  );
}
