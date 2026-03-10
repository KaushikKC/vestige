# Vestige

**Inverted bonding-curve token launchpad on Solana.** Fair-launch token trading with a time-based price and risk-weight curve — built natively for Solana Mobile. Price decreases from `p_max` to `p_min` over the launch window; base tokens on buy, bonus tokens and creator-fee vesting unlock at graduation. Tokens graduate automatically to **Raydium CPMM** when the SOL target is reached.

---

## Links

| | |
|---|---|
| **Live web app** | [**https://vestige-eight.vercel.app/**](https://vestige-eight.vercel.app/) |
| **Live APK** | _[https://drive.google.com/drive/folders/1L701ixpTgw5cnC2PY3pULcgcyg_8B8Yo?usp=sharing](https://drive.google.com/drive/folders/1L701ixpTgw5cnC2PY3pULcgcyg_8B8Yo?usp=sharing)_ |
| **App video demo** | _[https://youtu.be/i2NOh9wczHU](https://youtu.be/i2NOh9wczHU)_ |

---

## Ideology: Inverted pump.fun

Vestige inverts the usual token-launch risk/reward so the best time to act is **toward graduation**, not only early.

| | **Traditional (e.g. pump.fun)** | **Vestige (inverted)** |
|---|---|---|
| **Reward** | High for early entry, decreases toward graduation | Low early, **increases** toward graduation |
| **Risk** | Low early, **increases** toward graduation | High early, **decreases** toward graduation |
| **Optimal strategy** | Front-run early (reveals intent) | **Buy toward graduation** — max reward, min risk |

Price decreases linearly over the launch window (`p_max` → `p_min`, fixed 10:1 ratio); risk weight decreases from `r_best` to `r_min`. Base tokens are delivered immediately; bonus tokens are earned from the current risk weight and claimed after graduation. Once the graduation SOL target is hit, the token **graduates automatically to Raydium CPMM** — liquidity is seeded on-chain and the token gets real DEX liquidity.

---

## Implementation highlights

- **Inverted bonding curve** — Price formula: `price = p_max − (p_max − p_min) × (totalBaseSold / supply)`. Every buy pushes cost down for the next buyer; optimal strategy is to participate toward graduation.
- **Bonding curve chart** — Real-time SVG visualization of the curve with a live position dot (web + mobile).
- **Candlestick charts** — Custom OHLC candles aggregated from on-chain transaction logs; parsed and rendered as SVG on mobile.
- **Live trade feed** — Buy/sell events streamed from Solana logs in real time; parsed on the client for trade history and chart data.
- **Raydium CPMM graduation** — CPI integration: when `totalSolCollected ≥ graduationTarget`, liquidity is seeded into Raydium CPMM automatically.
- **One-tap launch** — Create SPL mint, mint full supply to token vault, and call `initialize_launch` from the mobile app in one flow.
- **Mobile-native** — React Native + Solana Mobile SDK (MWA); hardware wallet signing on-device, no browser extension required.
- **On-chain log emission** — Program emits structured logs for trades; clients use them for real-time candle aggregation and trade feed without indexing services.

---

## What we built

### Program (Anchor, Solana)

- **Program ID:** `4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf`
- **Stack:** Anchor (Rust), custom inverted bonding-curve math, **Raydium CPMM graduation CPI**, on-chain log emission for trade events, BN/big-number arithmetic for lamport precision.
- **PDAs:** Launch (creator + token_mint), Vault (SOL), CreatorFeeVault, UserPosition (launch + user)
- **Instructions:**
  - **initialize_launch** — Creator sets token supply, bonus pool, start/end time, curve bounds (`p_max`/`p_min`, `r_best`/`r_min`), graduation target. Creates Launch + vault PDAs. Creator must create the SPL mint and mint full supply into a token vault (Launch PDA as authority) before or in the same flow.
  - **buy** — User sends SOL. 1% fee (0.5% protocol, 0.5% creator). Net SOL goes to vault; **base tokens** transfer immediately from token vault to user. **Bonus** = base × (risk_weight − 1) when weight > 1, recorded on UserPosition and claimed later. Creator must do the **first buy** (min 0.01 SOL) to activate the launch. Program emits logs for trade feed / candle aggregation.
  - **graduate** — Permissionless when `total_sol_collected >= graduation_target` OR `clock > end_time`. Sets `is_graduated`, seeds liquidity into **Raydium CPMM** via CPI, unlocks first creator-fee milestone (30%).
  - **claim_bonus** — After graduation, user claims bonus tokens from token vault.
  - **creator_claim_fees** — Creator withdraws from CreatorFeeVault; vesting 30% → 50% → 70% → 100% via four milestones.
  - **advance_milestone** — Authority-gated; unlocks next creator-fee tier (used after graduation).

### Frontend (Next.js)

- **VestigeClient** (`lib/vestige-client.ts`) — Anchor Program + PDA derivation, curve/risk math (`getCurrentCurvePrice`, `getCurrentRiskWeight`), fee-aware **estimateBuy**, and all RPC/tx methods: `getAllLaunches`, `getLaunch`, `getUserPosition`, `initializeLaunch`, `buy`, `graduate`, `claimBonus`, `creatorClaimFees`, `advanceMilestone`.
- **useVestige** (`lib/use-vestige.ts`) — React hook that provides the client (read-only when wallet disconnected), balance, and all actions; re-exports VestigeClient statics (e.g. `lamportsToSol`, `getTimeRemaining`, `getProgress`).
- **CreateLaunchForm** — Creates SPL mint (Keypair), mints full supply to token vault ATA (authority derived for Launch PDA), then calls **initialize_launch**. Shows Launch PDA and “Open launch page”.
- **Launch detail page** — Fetches launch + user position; live curve price and risk weight; buy form with estimates and validation (creator-only initial buy ≥ 0.01 SOL); actions: Graduate, Claim bonus, Creator claim fees, Advance milestone.

### Mobile (React Native)

- **Solana Mobile SDK (MWA)** — DApp connection and hardware wallet signing on-device; no browser extension.
- Shared **vestige-client** and **use-vestige**-style hook for program calls and PDA/curve math.
- **PortfolioScreen** — User positions across all launches (getAllLaunches + getUserPosition per launch).
- **Charts** — Custom SVG bonding-curve visualization and OHLC candlestick charts; data from on-chain log parsing and client-side aggregation.
- **Live trade feed** — Parsed buy/sell events from Solana logs; optional auto-refresh (e.g. 15–30s) for price and activity.
- **Create launch** — One-flow create (mint + initialize_launch) from the device.
- **Supabase** — Per-launch comments and realtime updates (see Run locally).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User (Creator / Participant)                                           │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js) / Mobile (React Native)                             │
│  Wallet adapter, VestigeClient (Anchor), useVestige hook                │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Solana — Vestige program (Anchor)                                       │
│  PDAs: launch, vault, creator_fee_vault, user_position                   │
│  Flow: initialize_launch → buy (base + bonus entitlement)               │
│        → graduate → claim_bonus / creator_claim_fees / advance_milestone│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Repo structure

```
Vestige/
├── programs/vestige/    # Anchor program (inverted curve, fees, vesting)
├── frontend/            # Next.js (Discover, Creator, Launch Detail)
├── mobile/              # React Native (portfolio, shared vestige client)
├── migrations/
├── tests/
└── docs/                # ideology-diagram.png (optional)
```

---

## Run locally

**Program (Solana)**

```bash
anchor build
anchor deploy --provider.cluster devnet   # or localnet
```

**Frontend**

```bash
cd frontend
cp .env.example .env   # set NEXT_PUBLIC_* if needed
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Creator → Create Launch** to create a mint + launch and get the Launch PDA, then open the launch page to buy, graduate, and claim.

**Devnet: fund protocol treasury once.** The protocol fee (0.5%) is sent to the treasury account. On devnet that account must exist and be rent-exempt before the first buy. Send ~0.001 SOL to `GZctHpWXmsZC1YHACTGGcHhYxjdRqQvTpYkb3Jy9N2Ce` (e.g. from your wallet or `solana transfer GZctHpWXmsZC1YHACTGGcHhYxjdRqQvTpYkb3Jy9N2Ce 0.001 --allow-unfunded-recipient --url devnet`).

**Mobile**

```bash
cd mobile
cp .env.example .env   # set EXPO_PUBLIC_* (Privy, Solana RPC, Supabase)
npm install
npx expo start
```

**Supabase (mobile comments)** — The app uses Supabase for per-launch comments and realtime updates.

1. Create a project at [app.supabase.com](https://app.supabase.com).
2. In **Project Settings → API**, copy **Project URL** and **anon public** key.
3. In `mobile/.env`, set:
   - `EXPO_PUBLIC_SUPABASE_URL=<your Project URL>`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon key>`
4. In the Supabase **SQL Editor**, run:

```sql
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  launch_pda text not null,
  wallet_address text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Allow read comments"
  on public.comments for select using (true);

create policy "Allow insert comments"
  on public.comments for insert with check (true);
```

5. In **Database → Replication**, enable replication for the `comments` table so realtime works.

---

## Tech summary (one paragraph)

Vestige is a Solana token launchpad built on an **Anchor program** (Rust) with an **inverted, time-based bonding curve**: price decreases linearly from `p_max` to `p_min` (10:1 ratio) and a risk weight from `r_best` to `r_min` over a configurable launch window. The program uses BN arithmetic for lamport precision and **emits on-chain logs** for trade events; clients parse these for live trade feed and candlestick aggregation. Creators **initialize_launch** with an SPL mint (supply + bonus pool), curve and weight bounds, and a graduation target; the program derives PDAs for the launch, SOL vault, creator-fee vault, and per-user positions. Users **buy** with SOL: 1% fee (0.5% protocol, 0.5% creator); base tokens are delivered immediately and bonus tokens are **claimed after graduation**. **Graduation** is permissionless when total SOL reaches the target or end time; it **seeds liquidity into Raydium CPMM** via CPI and unlocks the first creator-fee milestone (30%). Creator fees vest in four milestones via **creator_claim_fees** and **advance_milestone**. The **frontend** (Next.js) and **mobile** (React Native + **Solana Mobile SDK / MWA**) share a TypeScript **VestigeClient** (PDA derivation, curve/risk math, fee-aware buy estimates) and a **useVestige** hook. The web app handles mint creation and **initialize_launch**; the mobile app adds custom SVG bonding-curve and candlestick charts, live trade feed, one-tap launch, and portfolio view, with hardware wallet signing on-device.

---

© 2026 Vestige Labs.
