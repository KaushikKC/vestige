# Vestige Frontend

Next.js app for **Vestige** — the privacy-preserving token launchpad on Solana. Discover launches, create launches, commit privately (MagicBlock TEE), graduate, and claim allocations.

---

## Links

| | |
|---|---|
| **Live app** | [**https://vestige-eight.vercel.app/**](https://vestige-eight.vercel.app/) |
| **Demo video** | [**https://youtu.be/aJsDFx8rhUM**](https://youtu.be/aJsDFx8rhUM) |

For full project docs, ideology, and architecture see the [root README](../README.md).

---

## Tech stack

- **Next.js** (App Router)
- **Solana** — `@solana/web3.js`, `@solana/wallet-adapter-react`, `@solana/spl-token`
- **Anchor** — `@coral-xyz/anchor` (via vestige client)
- **MagicBlock** — `@magicblock-labs/ephemeral-rollups-sdk` (routing: base RPC vs TEE RPC)
- **UI** — Tailwind CSS, Lucide icons, Recharts, `react-hot-toast`

---

## Getting started

```bash
npm install
cp .env.example .env   # optional: set NEXT_PUBLIC_* for RPC / cluster
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect a wallet (e.g. Phantom on Devnet). Use **Discover → Open a launch by PDA** or **Creator → Create Launch** to get a Launch PDA, then open the launch and run through the flow (Enable Private Mode, Commit, Graduate, Finalize, Sweep, Claim).

---

## Env (optional)

Create `.env` in `frontend/` if you need to override defaults:

- `NEXT_PUBLIC_SOLANA_RPC` — Solana RPC (default: devnet)
- `NEXT_PUBLIC_MAGICBLOCK_TEE_RPC` — MagicBlock TEE RPC for private commits

See `.env.example` if present.

---

## Project structure

| Path | Purpose |
|------|--------|
| `app/` | Pages: Discover, Creator, Launch Detail, Allocation (My Commitments) |
| `components/` | CreateLaunchForm, MagicBlockControls, Sidebar, StatusPanel, WalletButton, VestigeLogo |
| `lib/` | vestige-client (Anchor), magicblock-client (TEE/router), use-vestige hook, vestige.json IDL, wallet-provider |
| `constants.ts` | Colors, mock stats/chart data for demo UI |

---

## Build & deploy

```bash
npm run build
```

Deploy to [Vercel](https://vercel.com) (or any Node host). The live app is deployed at [vestige-eight.vercel.app](https://vestige-eight.vercel.app/).
