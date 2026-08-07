# The case for expiry — answering the hard questions

Research notes, Aug 7 2026. Written to survive Q&A. Sources at the end.

## The facts on the ground

**Circle (USDC)** publishes a **monthly** reserve report attested by Deloitte & Touche.
It is an *agreed-upon-procedures* attestation, not a full audit: the accountant runs
exactly the checks the client asked for, **on a stated date**, and reports what came
back. Composition: mostly a BlackRock-managed government money market fund custodied
at BNY Mellon.

**Tether (USDT)** publishes **quarterly** BDO attestations.

**The GENIUS Act (US, 2025)** now *requires* permitted stablecoin issuers to publish
**monthly** reserve composition, examined monthly by a registered public accounting
firm, with the report's accuracy **personally certified by the CEO and CFO under
criminal liability** (Sarbanes-Oxley-style).

**Exchanges already use ZK for reserves**: OKX publishes a monthly zk-STARK proof of
reserves (40+ editions), Binance wraps its PoR in a zk-SNARK, Backpack refreshes a
recursive proof daily. The math is not the missing piece.

## Q1 — "Why don't they do it continuously? Is it missing technology?"

Partly, but not where people think. Three real barriers, in order of hardness:

1. **The attestation process is manual and expensive.** An accountant's attestation
   takes weeks and serious money per cycle. You cannot run that loop daily. The
   bottleneck is the *process around the proof*, not the proof.
2. **Off-chain assets have no cryptographic feed.** T-bills at a custodian and bank
   deposits do not live on a chain. Any continuous proof needs an attested data
   source — the auditor moves from re-doing arithmetic to attesting sources.
   (This is Asfalia's stated honest limit, and it is everyone's limit.)
3. **Nothing on the consumer side rejects a stale proof.** This is the gap nobody
   ships. OKX's proof is monthly; between snapshots you are on faith. The classic
   attack is *window dressing*: borrow reserves for the snapshot day, return them
   after. A monthly snapshot equals 29 days of trust.

So the answer to the engineer is: **they half-do it already** (ZK snapshots exist,
monthly cadence is now law in the US), and the reason it is not continuous is cost
of the attestation loop plus the oracle gap — *and* the fact that no verifier-side
mechanism forces renewal. Two of those three are exactly what Asfalia builds:

- Re-attestation costs ~90 seconds of compute instead of an audit cycle → the
  entity *can* prove as often as anyone wants to check.
- The certificate **expires by circuit** and the settlement layer rejects it when
  old → the entity *must* renew. Window dressing dies economically: to always have
  a fresh certificate you must essentially always hold the reserves, which is the
  same as being solvent.

What does not exist in the market and Asfalia is: an **open** instrument (OKX's and
Binance's systems are internal to OKX and Binance), with **composition privacy**,
**per-client completeness** (Merkle inclusion), and **consensus-enforced freshness**.

## Q2 — "Why would a person NOT want to check at any moment?"

They would. Everyone would. That is precisely the argument **for** expiry, not
against it:

- Continuous *checking* requires continuous *proving*. No entity proves
  continuously if nothing forces it — proving is work and exposure, and the
  incentive is to prove as rarely as possible. The expiring certificate is the
  forcing function: it converts "trust me between reports" into "the system
  refuses stale claims."
- The verifier's desire (check every moment) and the prover's incentive (prove
  rarely) were irreconcilable while each attestation cost an audit cycle. ZK
  collapses the cost of *renewal*; expiry collapses the incentive to *skip* it.
  Freshness becomes an economic equilibrium instead of a promise.

One-line answer for the stage: *"Everyone wants to check at every moment — but
checking continuously requires proving continuously, and nobody proves continuously
unless something forces them. Expiry is the forcing function. We didn't add an
expiry to the certificate; we added the missing half of the market."*

## The regulatory tailwind (use in pitch)

The GENIUS Act just created **mandatory monthly cadence with personal criminal
liability for the CFO**. A CFO signing under criminal exposure is the natural buyer
of a cryptographic instrument that (a) proves the numbers they sign, (b) does not
leak portfolio composition, and (c) renews automatically inside the mandated window.
The 30-day regulatory cycle *is* an expiry window — regulation invented Asfalia's
parameter before we did.

## Sources

- [Circle — New levels of detail in the monthly USDC attestation](https://www.circle.com/blog/new-levels-of-detail-in-the-monthly-usdc-attestation)
- [Eco — USDC reserves and how to verify them (2026)](https://eco.com/support/en/articles/15182152-usdc-reserves-and-how-to-verify-them-in-2026)
- [Eco — Tether vs Circle 2026: companies, reserves, regulation](https://eco.com/support/en/articles/15183712-tether-vs-circle-2026-companies-reserves-regulation)
- [Coinlaw — Stablecoin reserves transparency statistics 2026](https://coinlaw.io/stablecoin-reserves-transparency-statistics/)
- [Congress.gov — S.1582 GENIUS Act (text)](https://www.congress.gov/bill/119th-congress/senate-bill/1582/text)
- [Federal Register — GENIUS Act requirements for FDIC-supervised issuers](https://www.federalregister.gov/documents/2026/04/10/2026-06974/genius-act-requirements-and-standards-for-fdic-supervised-permitted-payment-stablecoin-issuers-and)
- [Paul Hastings — The GENIUS Act: comprehensive guide](https://www.paulhastings.com/insights/crypto-policy-tracker/the-genius-act-a-comprehensive-guide-to-us-stablecoin-regulation)
- [OKX — zk-STARK proof of reserves, monthly snapshot](https://www.okx.com/en-us/learn/okx-introduces-zk-stark-technology-to-proof-of-reserves-monthly-snapshot)
- [PwC — Does proof of reserves provide meaningful trust?](https://www.pwc.ch/en/insights/digital/does-proof-of-reserves-provide-meaningful-trust-and-transparency.html)
- [Banxa — What PoR proves and what it leaves out](https://banxa.com/learn/security-and-self-custody/what-is-proof-of-reserves)
- [Space and Time — Why crypto institutions need more than a snapshot](https://www.spaceandtime.io/blog/trustless-proof-of-reserves-why-crypto-institutions-need-more-than-a-snapshot)
- [BitGo — PoR for stablecoins: attestations, audits, onchain transparency](https://www.bitgo.com/resources/blog/proof-of-reserves-stablecoins/)

## Q3 — "Attested on day 1 with a 30-day window; funds move on day 5. What happens?"

Nothing: the certificate stays valid until it expires. Three layers to that answer:

1. **Every attestation system has this problem, worse.** Deloitte's day-1 report
   also misses the day-5 move — and it *never* expires: the stale PDF circulates as
   "proof" forever. Today's real exposure is 30 days *plus infinity*. Asfalia's lie
   has an on-chain death date.
2. **Expiry bounds the lie, and the verifier prices the window.** Maximum exposure
   equals the window. Renewal costs ~90 seconds of compute, not an audit cycle, so
   windows can be hours. A large settlement demands a 24h window; a small one
   accepts 30 days. Risk becomes a visible on-chain parameter. And at expiry the
   entity must re-prove with the moved funds — and fails. Equilibrium: keeping a
   fresh short-window certificate is economically equivalent to being solvent.
3. **The TLS analogy.** A stolen key on day 5 leaves the SSL certificate valid
   until expiry. The industry's answer was not to abandon certificates — it was to
   shorten them (Let's Encrypt: years → 90 days → 6-day certs). Same thesis,
   applied to solvency.

Future design (out of 27h scope, architecture supports it): a **challenge
circuit** — anyone demands re-attestation; no response within X ⇒ early expiry.

Stage line: *"The certificate doesn't promise the future — it promises a past with
an expiry date. Everyone else promises the same thing, without the date."*
