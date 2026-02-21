# Vestige

**Inverted bonding-curve token launchpad on Solana.** Time-based price and risk-weight curves reward participation toward graduation; base tokens on buy, bonus tokens and creator-fee vesting unlock at graduation.

---

## Links

| | |
|---|---|
| **Live app** | [**https://vestige-eight.vercel.app/**](https://vestige-eight.vercel.app/) |
| **Demo video** | [**https://youtu.be/aJsDFx8rhUM**](https://youtu.be/aJsDFx8rhUM) |

---

## Ideology: Inverted pump.fun

Vestige inverts the usual token-launch risk/reward so the best time to act is **toward graduation**, not only early.

| | **Traditional (e.g. pump.fun)** | **Vestige (inverted)** |
|---|---|---|
| **Reward** | High for early entry, decreases toward graduation | Low early, **increases** toward graduation |
| **Risk** | Low early, **increases** toward graduation | High early, **decreases** toward graduation |
| **Optimal strategy** | Front-run early (reveals intent) | **Buy toward graduation** — max reward, min risk |

Price decreases linearly over the launch window (`p_max` → `p_min`, fixed 10:1 ratio); risk weight decreases from `r_best` to `r_min`. Base tokens are delivered immediately; bonus tokens are earned from the current risk weight and claimed after graduation.

---

## What we built

### Program (Anchor, Solana)

- **Program ID:** `4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf`
- **PDAs:** Launch (creator + token_mint), Vault (SOL), CreatorFeeVault, UserPosition (launch + user)
- **Instructions:**
  - **initialize_launch** — Creator sets token supply, bonus pool, start/end time, curve bounds (`p_max`/`p_min`, `r_best`/`r_min`), graduation target. Creates Launch + vault PDAs. Creator must create the SPL mint and mint full supply into a token vault (Launch PDA as authority) before or in the same flow.
  - **buy** — User sends SOL. 1% fee (0.5% protocol, 0.5% creator). Net SOL goes to vault; **base tokens** transfer immediately from token vault to user. **Bonus** = base × (risk_weight − 1) when weight > 1, recorded on UserPosition and claimed later. Creator must do the **first buy** (min 0.01 SOL) to activate the launch.
  - **graduate** — Permissionless when `total_sol_collected >= graduation_target` OR `clock > end_time`. Sets `is_graduated`, unlocks first creator-fee milestone (30%).
  - **claim_bonus** — After graduation, user claims bonus tokens from token vault.
  - **creator_claim_fees** — Creator withdraws from CreatorFeeVault; vesting 30% → 50% → 70% → 100% via four milestones.
  - **advance_milestone** — Authority-gated; unlocks next creator-fee tier (used after graduation).

### Frontend (Next.js)

- **VestigeClient** (`lib/vestige-client.ts`) — Anchor Program + PDA derivation, curve/risk math (`getCurrentCurvePrice`, `getCurrentRiskWeight`), fee-aware **estimateBuy**, and all RPC/tx methods: `getAllLaunches`, `getLaunch`, `getUserPosition`, `initializeLaunch`, `buy`, `graduate`, `claimBonus`, `creatorClaimFees`, `advanceMilestone`.
- **useVestige** (`lib/use-vestige.ts`) — React hook that provides the client (read-only when wallet disconnected), balance, and all actions; re-exports VestigeClient statics (e.g. `lamportsToSol`, `getTimeRemaining`, `getProgress`).
- **CreateLaunchForm** — Creates SPL mint (Keypair), mints full supply to token vault ATA (authority derived for Launch PDA), then calls **initialize_launch**. Shows Launch PDA and “Open launch page”.
- **Launch detail page** — Fetches launch + user position; live curve price and risk weight; buy form with estimates and validation (creator-only initial buy ≥ 0.01 SOL); actions: Graduate, Claim bonus, Creator claim fees, Advance milestone.

### Mobile (React Native)

- Shared **vestige-client** and **use-vestige**-style hook; **PortfolioScreen** lists user positions across all launches (getAllLaunches + getUserPosition per launch).

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
npm install
npx expo start
```

---

## Tech summary (one paragraph)

Vestige is a Solana token launchpad built on an **Anchor program** that uses an **inverted, time-based bonding curve**: price decreases linearly from `p_max` to `p_min` (10:1 ratio) and a risk weight from `r_best` to `r_min` over a configurable launch window. Creators **initialize_launch** with an SPL mint (supply + bonus pool), curve and weight bounds, and a graduation target; the program derives PDAs for the launch, SOL vault, creator-fee vault, and per-user positions. Users **buy** with SOL: 1% is split (0.5% protocol, 0.5% creator); net SOL goes to the vault and base tokens are delivered immediately; bonus tokens are computed from the current risk weight and **claimed after graduation**. Graduation is **permissionless** when total SOL collected reaches the target or the launch end time passes; it unlocks the first **creator-fee milestone** (30%). Creator fees vest in four milestones (30% → 50% → 70% → 100%) via **creator_claim_fees** and **advance_milestone**. The **frontend** (Next.js) and **mobile** (React Native) share a TypeScript **VestigeClient** (PDA derivation, curve/risk math, fee-aware buy estimates) and a **useVestige** hook; the web app handles mint creation, full supply mint-to-vault, and **initialize_launch**, and the launch-detail page exposes live curve price and all on-chain actions with client-side validation (e.g. creator-only initial buy ≥ 0.01 SOL).

---

© 2026 Vestige Labs.
