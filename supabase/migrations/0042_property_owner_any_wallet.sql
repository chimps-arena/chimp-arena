-- ==========================================================================
-- CHIMP Arena - migration 0042: a property's owner can be any wallet
-- Run in the Supabase SQL editor BEFORE deploying. Safe to re-run.
--
-- properties.owner_wallet referenced players(wallet), so a sale could only
-- be recorded for a wallet that had signed in to the site. Buying doesn't
-- need a sign-in, and Ledger wallets can't do the sign-in signature at all
-- (0x6a81), so on Nov 26 a Ledger buyer paid for The Coupling Yard, got the
-- NFT, and the sale failed to record - leaving it listed as for sale.
-- The owner is simply the Solana wallet holding the NFT; drop the link.
-- ==========================================================================

do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.properties'::regclass
      and con.contype = 'f'
      and att.attname = 'owner_wallet'
  loop
    execute format('alter table public.properties drop constraint %I', c.conname);
  end loop;
end $$;
