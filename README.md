# Enku — Proof of Solvency that expires

> In Sumerian administration, the *enku* was the collector-inspector: the official who
> verified what was declared. Five thousand years later, the role is a ZK circuit.

**Enku lets an entity (exchange, fintech, treasury) prove that its assets cover its
liabilities without revealing a single number — and the certificate it produces
*expires on-chain*.** A cryptographically perfect proof, presented after its validity
window, is rejected by the chain itself. Solvency is not a trophy; it is a state that
must be renewed.

Built on [Midnight](https://midnight.network) during **Hack Buenos Aires 2026**
(Beginner Track). Every proof-of-reserves in production today is born stale — a
snapshot that can be shown months later as if it were fresh. Enku's verdict carries
its own expiry, enforced by circuit, not by promise.

---

## The four moments

1. **Privacy** — the entity attests. The auditor sees `SOLVENT`, verified on-chain.
   Pressing *reveal data* shows an empty record: the balances never left the
   entity's machine. The proof traveled; the numbers, never.
2. **Integrity** — edit one hidden client balance and re-attest: the math breaks,
   `NOT SOLVENT`, and the public commitments visibly change. The proof is bound to
   the real books — lie and it shatters.
3. **Freshness** — wait out the window: the same valid certificate is now
   **rejected by the chain** (`failed assert: certificate has expired`). No oracle,
   no trusted clock — the block time comparison lives inside the circuit.
4. **Completeness** — every client of the entity can verify, in the client portal,
   that *their own* balance is included in the declared liabilities: a Merkle
   inclusion proof checked against the on-chain root. Hide an account — or lie
   about its balance — and that client's verification fails.

## Architecture

Midnight separates public state (on-chain ledger) from private state (*witnesses*,
which live on the prover's machine). [Compact](https://docs.midnight.network/compact)
compiles the contract into ZK circuits; proofs are generated locally against a proof
server and verified on-chain.

```mermaid
flowchart LR
    subgraph entity ["Entity's machine (private)"]
        book["Books (JSON)<br/>8 assets + nonce<br/>16 client accounts (id, balance, salt)"]
        ps["Proof server<br/>(Docker, local)"]
        api["Enku API + dashboard"]
    end
    subgraph chain ["Midnight (public)"]
        ledger["Contract ledger<br/>verdict : Boolean<br/>attestedAt : Uint64<br/>validUntil : Uint64<br/>assetsCommitment : Bytes32<br/>liabilitiesRoot : Bytes32"]
    end
    auditor["Auditor / counterparty<br/>(certificate view)"]
    client["Entity's client<br/>(portal view)"]

    book -- "witnesses (never leave)" --> api
    api -- "ZK proof" --> ps
    ps -- "attest tx (proof only)" --> ledger
    ledger -- "public state" --> auditor
    auditor -- "settle() — accepted only if solvent AND fresh" --> ledger
    api -- "own leaf + sibling hashes" --> client
    ledger -- "Merkle root" --> client
```

### What the circuit guarantees (`contracts/enku.compact`)

- **Sums inside the circuit.** `attest` receives the full asset list and all 16
  client accounts as witnesses and aggregates them in-circuit — the guarantee covers
  every item, not an aggregate the prover could fabricate. Accumulator is `Uint<68>`
  (16 × 64-bit terms fit in 68 bits): no silent overflow is possible.
- **Witness–commitment binding.** Witnesses are *not* cryptographically verified by
  themselves — the prover supplies them. That is why the circuit never trusts a raw
  value: assets are bound to a `persistentCommit` (with a 32-byte nonce) published
  on-chain. Edit one cent and the commitment changes.
- **Merkle tree of liabilities, built in-circuit.** Each client account is a leaf
  `persistentHash(id, balance, salt)` — the salt blinds the balance from tree
  siblings. The circuit computes the 16-leaf root *inside* and publishes it: the
  liability total used for the verdict and the published root come from the same
  leaves, so no account can be hidden from one without breaking the other. The
  server reuses the contract's own exported pure circuits (`leafHash`, `pairHash`)
  for inclusion proofs — hashes match by construction, not by convention.
- **Time anchoring without an oracle.** The prover declares `now`; the circuit
  requires `blockTimeGte(now) && blockTimeLt(now + tolerance)` — the declared
  timestamp must sit inside a window around the actual block time, so attestations
  can be neither backdated nor postdated. Block time is epoch **seconds**.
- **Expiry as circuit law.** `attest` records `validUntil = now + validitySecs`.
  The `settle` circuit — the counterparty accepting the certificate — asserts
  `verdict && blockTimeLt(validUntil)`. Past the window, the transaction fails at
  the assert. Rejection is consensus, not UI.

### What is public, what is private

| | |
|---|---|
| **Public (ledger)** | verdict (boolean) · attest timestamp · validity deadline · assets commitment · liabilities Merkle root |
| **Private (witnesses)** | every balance, every account, every aggregate — they never touch the ledger, the logs, or the network |
| **Per-client (portal)** | their own balance and a path of sibling *hashes* — never another client's balance |

## Running it

Requirements: Node 22+, Docker (Compose v2), Compact compiler 0.31.1
(`curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh && compact update`).

```bash
npm install
npm run compile          # Compact -> ZK circuits + prover/verifier keys
docker compose up -d     # local devnet: node + indexer + proof server
npm run setup            # deploy (genesis-funded wallet, no faucet needed)
npm test                 # 19-case circuit suite (simulator, no proof server)
npm run attest           # one-shot: real ZK proof -> verdict on-chain
npm run dashboard        # build UI + serve API on http://localhost:3300
```

Deploying to the public **preview** testnet is one flag: `npm run setup -- --network preview`
(the deploy script generates a wallet, prints the faucet URL and waits for funding).

The dashboard has three views:

- **Treasury (entity)** — the private books (8 assets, 16 client accounts),
  editable, with live coverage; a *Generate attestation* button runs the real proof.
- **Certificate (auditor)** — the public record: stamped verdict, on-chain validity
  window with countdown, assets commitment, liabilities root, last transaction.
  *Accept certificate* submits `settle()` — the chain accepts or rejects it.
  *Reveal data* shows, by design, nothing.
- **Portal (client)** — pick an account and verify its Merkle inclusion against the
  on-chain root: the answer comes from the tree, not from the entity's word.

## Tests

`npm test` runs a 19-case suite against the circuit simulator, covering the verdict
(including the exact-equality edge and the one-cent-over case), zero balance leakage
into public state, circuit-root/server-root equality, real inclusion proofs, the
hidden-account and lied-balance failure paths, commitment determinism and
sensitivity, timestamp anchoring, and `settle` accepting fresh certificates while
rejecting insolvent and expired ones. A lied number breaks exactly the test that
should break.

## Honest limits

The proof guarantees that the *committed* numbers satisfy solvency — no system can
cryptographically guarantee the numbers are real without attested sources. On-chain
assets can be proven with wallet signatures; off-chain assets still need an auditor
attesting sources. Liability completeness is covered by the Merkle layer — a client
whose account is hidden or understated will catch it — but only for clients who
check. Enku replaces the recalculation and the exposure, not the auditor: it turns
a quarterly snapshot into continuous, private verification.

## License

[Apache 2.0](LICENSE)
