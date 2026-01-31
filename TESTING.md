# Vestige – Testing Procedures (Private Ephemeral SOL Architecture)

This document describes the **architecture** and **step-by-step testing** for the fully private commitment flow using MagicBlock Ephemeral Rollups (TEE).

---

## Architecture Summary

### Data flow (what happens where)

1. **User wallet → Ephemeral PDA (Solana base layer)**  
   - **Visible but anonymous**: On-chain you see “user funded an ephemeral PDA”; you do **not** see which launch or how much they will commit.  
   - Implemented by: `fund_ephemeral(amount)` – transfers SOL from user wallet to their `EphemeralSol` PDA.

2. **Ephemeral SOL → Commitment data only (inside TEE)**  
   - **Fully private**: Runs on the MagicBlock TEE. **Vault is not delegated** (system-owned).  
   - Implemented by: `private_commit(amount)` – runs on ER RPC:  
     - Debits `ephemeral_sol` balance (tracking only); **SOL stays in ephemeral_sol**.  
     - Updates `commitment_pool` and `user_commitment`.  
   - No vault in this step so the ER does not need to write to vault.

3. **Ephemeral SOL → Vault (on Solana, later)**  
   - Implemented by: `sweep_ephemeral_to_vault()` – runs on **Solana** (not ER).  
   - Participant calls this after ephemeral_sol is undelegated (e.g. after graduation).  
   - Transfers `user_commitment.amount` from `ephemeral_sol` to `vault`.

So: **User → Ephemeral (public) → Private commit on TEE (record only) → Sweep to vault on Solana (when undelegated).**

### Account roles

| Account           | Created when              | Delegated? | Where used                    |
|------------------|---------------------------|------------|-------------------------------|
| `commitment_pool`| `initialize_launch`       | Yes (creator) | TEE: `private_commit`      |
| `vault`          | `initialize_launch`       | **No** (system-owned) | Solana: `sweep_ephemeral_to_vault`      |
| `user_commitment`| `init_user_commitment`    | Yes (user)    | TEE: `private_commit`      |
| `ephemeral_sol`  | `init_ephemeral_sol`       | Yes (user)    | Solana: `fund_ephemeral`; TEE: `private_commit` |

All **writable** accounts in a TEE transaction must be delegated; the program and frontend follow this.

---

## Prerequisites

1. **Build and deploy the program**
   ```bash
   anchor build
   anchor deploy
   # Or, if already deployed:
   anchor upgrade target/deploy/vestige.so --program-id 4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf
   ```
   Use `cluster = "devnet"` (or your target) in `Anchor.toml` / provider as needed.

2. **Frontend**
   - Copy the new IDL/type outputs into `frontend/lib/vestige.json` if the program changed.
   - In `frontend`: `npm install` (Anchor 0.30.x).
   - Run: `npm run dev` (or your Next dev command).

3. **Wallet & RPC**
   - Wallet with SOL on the same cluster (e.g. Devnet).
   - Base RPC: e.g. `https://api.devnet.solana.com` (see `frontend/lib/wallet-provider.tsx`).
   - MagicBlock ER RPC for TEE: `https://devnet.magicblock.app` (used in `frontend/lib/vestige-client.ts` for `erProgram`).

4. **MagicBlock**
   - Private mode requires MagicBlock Ephemeral Rollup (devnet) and TEE validator `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA`.
   - Ensure devnet ER is up; if you hit connection/timeout errors, the TEE/ER may be unavailable.

---

## Step-by-Step Testing

### 1. Create a launch (creator)

- In the app: **Create Launch** (set token supply, time window, graduation target, min/max commitment).
- **Verify**: Launch appears in discover/detail; `launch` and `commitment_pool`, `vault` PDAs exist on-chain (read via base RPC).

### 2. Enable private mode (creator)

- Open the **launch detail** for that launch.
- Use **“Enable Private Mode (TEE)”** (or equivalent in `MagicBlockControls`).
- **What it does** (see `vestige-client.ts` → `enablePrivateMode`):
  - Create permission + delegate **commitment_pool**.
  - Create permission + delegate **vault**.
  - Call **mark_delegated** so `launch.is_delegated == true`.
- **Verify**:
  - Console: “FULLY Private Mode Enabled”, “All accounts delegated to MagicBlock TEE”.
  - No error from permission/delegate/mark_delegated.
  - Optionally: fetch `launch` and confirm `isDelegated` is true.

### 3. Commit as a participant (private flow)

- Connect a **different wallet** (participant).
- On the **same launch detail**, enter SOL amount and **Commit**.
- **What the frontend does** when the pool is delegated (`vestige-client.ts` → `commit()`):
  1. **prepareUserForPrivateCommit(launchPda, user)** (on Solana, init only—no delegation yet):
     - `init_user_commitment` (if needed).
     - `init_ephemeral_sol` (if needed).
     - Ephemeral and user_commitment stay **owned by Vestige** so funding works.
  2. **fundEphemeral(launchPda, amount, user)** (on Solana):
     - Transfers SOL from user wallet → `ephemeral_sol` PDA (must still be Vestige-owned).
  3. **delegateUserAccountsForPrivateCommit(launchPda, user)** (on Solana):
     - Create permission + delegate **user_commitment** and **ephemeral_sol** to TEE.
  4. **privateCommit(launchPda, amount, user)** (on **MagicBlock ER**):
     - Updates `ephemeral_sol.balance`, `commitment_pool`, `user_commitment`. SOL stays in ephemeral_sol.
  5. **Later (on Solana):** Participant calls **sweepEphemeralToVault(launchPda, user)** after undelegating ephemeral_sol to move SOL to vault.
- **Verify**:
  - Console: “Pool is DELEGATED → Using FULLY PRIVATE flow!”, “PRIVATE COMMIT on TEE...”.
  - `fundEphemeral` tx on Solana (e.g. in Solana Explorer for base RPC).
  - `privateCommit` tx on MagicBlock ER (success, no “writable account not delegated”).
  - After commit: participant’s `user_commitment` and pool totals updated (you can check after graduation or via any read that uses ER if you have one).

### 4. Graduate and undelegate (creator)

- When the launch is ready (time or target met), use **Graduate** (and undelegate).
- **What it does**: `graduate_and_undelegate` is sent via **erProgram** (ER RPC), so it runs in the ER context and can undelegate the pool/vault.
- **Verify**: Tx succeeds; launch is graduated; you can proceed to allocation/claim.

### 5. Calculate allocation & claim (participant)

- Participant: **Calculate allocation** then **Claim tokens**.
- **Verify**: Allocation is computed from committed amount/weights; claim mints tokens to the participant.

---

## What to check at each step

| Step              | Where it runs | What to check |
|-------------------|---------------|----------------|
| Create launch     | Solana        | Launch + pool + vault exist; no errors. |
| Enable private    | Solana        | Permissions + delegation + mark_delegated succeed; console says “Private Mode Enabled”. |
| Prepare user      | Solana        | init_user_commitment, init_ephemeral_sol only (no delegation yet); no errors. |
| Fund ephemeral    | Solana        | Tx: user → ephemeral_sol; ephemeral_sol still Vestige-owned. |
| Delegate user     | Solana        | user_commitment + ephemeral_sol delegated to TEE after funding. |
| Private commit    | **MagicBlock ER** | Tx on ER; no “writable account not delegated”; vault and pool/user_commitment updated in TEE. |
| Graduate          | **MagicBlock ER** | graduate_and_undelegate succeeds. |
| Allocate / claim  | Solana (or as per your impl) | Allocations and claim succeed. |

---

## Running existing Anchor tests

- `tests/vestige.ts` currently tests the **non-delegated** (public) path: `commit()` on Solana, graduate, calculate allocation, etc.
- Run: `anchor test` (or `npm run test` if wired in).
- These tests do **not** use MagicBlock ER; they validate the classic flow and constraints (min/max commitment, time range, graduation, allocation).
- To test the **private** flow end-to-end you need either:
  - A separate test suite that uses MagicBlock devnet ER (and possibly mock or real TEE), or
  - Manual / E2E tests via the frontend as above.

---

## Quick checklist

- [ ] `anchor build` and program deployed/upgraded.
- [ ] Frontend uses correct IDL and ER RPC (`https://devnet.magicblock.app`).
- [ ] Create launch → Enable private mode (creator).
- [ ] Commit as participant → see “FULLY PRIVATE flow”, fund_ephemeral on Solana, private_commit on ER.
- [ ] Graduate (and undelegate) on ER.
- [ ] Calculate allocation and claim tokens.

If anything fails, check: (1) RPC (base vs ER), (2) that all writable accounts in `private_commit` are delegated, (3) MagicBlock devnet/TEE status.
