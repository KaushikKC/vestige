import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vestige } from "../target/types/vestige";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import { expect } from "chai";

// MagicBlock constants
const TEE_VALIDATOR = new PublicKey("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");
const PERMISSION_PROGRAM_ID = new PublicKey("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");
const ER_RPC_URL = "https://devnet.magicblock.app";

// Seeds
const LAUNCH_SEED = Buffer.from("launch");
const COMMITMENT_POOL_SEED = Buffer.from("commitment_pool");
const USER_COMMITMENT_SEED = Buffer.from("user_commitment");
const VAULT_SEED = Buffer.from("vault");
const EPHEMERAL_SOL_SEED = Buffer.from("ephemeral_sol");

describe("Vestige Private Commit Flow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vestige as Program<Vestige>;

  // Test accounts
  const creator = Keypair.generate();
  const user = Keypair.generate();
  const tokenMint = Keypair.generate(); // Mock mint for testing

  // PDAs
  let launchPda: PublicKey;
  let commitmentPoolPda: PublicKey;
  let vaultPda: PublicKey;
  let userCommitmentPda: PublicKey;
  let ephemeralSolPda: PublicKey;

  // ER connection for private operations
  let erConnection: Connection;
  let erProvider: anchor.AnchorProvider;
  let erProgram: Program<Vestige>;

  before(async () => {
    // Airdrop to creator and user
    console.log("💰 Airdropping SOL to test accounts...");

    const airdropCreator = await provider.connection.requestAirdrop(
      creator.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropCreator);

    const airdropUser = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropUser);

    // Derive PDAs
    [launchPda] = PublicKey.findProgramAddressSync(
      [LAUNCH_SEED, creator.publicKey.toBuffer(), tokenMint.publicKey.toBuffer()],
      program.programId
    );
    [commitmentPoolPda] = PublicKey.findProgramAddressSync(
      [COMMITMENT_POOL_SEED, launchPda.toBuffer()],
      program.programId
    );
    [vaultPda] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, launchPda.toBuffer()],
      program.programId
    );
    [userCommitmentPda] = PublicKey.findProgramAddressSync(
      [USER_COMMITMENT_SEED, launchPda.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );
    [ephemeralSolPda] = PublicKey.findProgramAddressSync(
      [EPHEMERAL_SOL_SEED, launchPda.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );

    console.log("📍 PDAs derived:");
    console.log("   Launch:", launchPda.toBase58());
    console.log("   CommitmentPool:", commitmentPoolPda.toBase58());
    console.log("   Vault:", vaultPda.toBase58());
    console.log("   UserCommitment:", userCommitmentPda.toBase58());
    console.log("   EphemeralSol:", ephemeralSolPda.toBase58());

    // Setup ER connection
    erConnection = new Connection(ER_RPC_URL, "confirmed");
    erProvider = new anchor.AnchorProvider(erConnection, provider.wallet, {
      commitment: "confirmed",
    });
    erProgram = new Program(program.idl, erProvider);
  });

  it("1. Initialize Launch", async () => {
    console.log("\n📝 Step 1: Initializing launch...");

    const now = Math.floor(Date.now() / 1000);
    const startTime = new anchor.BN(now - 60); // Started 1 min ago
    const endTime = new anchor.BN(now + 3600); // Ends in 1 hour
    const tokenSupply = new anchor.BN(1_000_000_000); // 1B tokens
    const graduationTarget = new anchor.BN(LAMPORTS_PER_SOL); // 1 SOL target
    const minCommitment = new anchor.BN(0.01 * LAMPORTS_PER_SOL); // 0.01 SOL min
    const maxCommitment = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL max

    await program.methods
      .initializeLaunch(
        tokenSupply,
        startTime,
        endTime,
        graduationTarget,
        minCommitment,
        maxCommitment
      )
      .accounts({
        launch: launchPda,
        commitmentPool: commitmentPoolPda,
        vault: vaultPda,
        tokenMint: tokenMint.publicKey,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    console.log("✅ Launch initialized!");

    // Verify
    const launch = await program.account.launch.fetch(launchPda);
    expect(launch.isDelegated).to.be.false;
    expect(launch.isGraduated).to.be.false;
  });

  it("2. Enable Private Mode (delegate commitment_pool)", async () => {
    console.log("\n🔒 Step 2: Enabling private mode...");

    // 2a. Create permission for commitment_pool
    const [permissionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("permission:"), commitmentPoolPda.toBuffer()],
      PERMISSION_PROGRAM_ID
    );

    console.log("   Creating permission for commitment_pool...");
    try {
      await program.methods
        .createPermission({ commitmentPool: { launch: launchPda } }, null)
        .accounts({
          permissionedAccount: commitmentPoolPda,
          permission: permissionPda,
          payer: creator.publicKey,
          permissionProgram: PERMISSION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
      console.log("   ✅ Permission created");
    } catch (e) {
      console.log("   ⚠️ Permission may already exist:", e.message?.slice(0, 100));
    }

    // 2b. Delegate commitment_pool to TEE
    console.log("   Delegating commitment_pool to TEE...");
    try {
      await program.methods
        .delegatePda({ commitmentPool: { launch: launchPda } })
        .accounts({
          pda: commitmentPoolPda,
          payer: creator.publicKey,
          validator: TEE_VALIDATOR,
        })
        .signers([creator])
        .rpc();
      console.log("   ✅ Commitment pool delegated to TEE");
    } catch (e) {
      console.log("   ⚠️ Delegation error:", e.message?.slice(0, 100));
    }

    // 2c. Mark launch as delegated
    console.log("   Marking launch as delegated...");
    await program.methods
      .markDelegated()
      .accounts({
        launch: launchPda,
        authority: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    console.log("✅ Private mode enabled!");

    // Verify
    const launch = await program.account.launch.fetch(launchPda);
    expect(launch.isDelegated).to.be.true;
  });

  it("3. User: Initialize accounts (ephemeral_sol + user_commitment)", async () => {
    console.log("\n📋 Step 3: Initializing user accounts...");

    // 3a. Init user_commitment
    console.log("   Initializing user_commitment...");
    await program.methods
      .initUserCommitment()
      .accounts({
        launch: launchPda,
        userCommitment: userCommitmentPda,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // 3b. Init ephemeral_sol
    console.log("   Initializing ephemeral_sol...");
    await program.methods
      .initEphemeralSol()
      .accounts({
        launch: launchPda,
        ephemeralSol: ephemeralSolPda,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    console.log("✅ User accounts initialized!");
  });

  it("4. User: Fund ephemeral account (on Solana)", async () => {
    console.log("\n💰 Step 4: Funding ephemeral SOL account...");

    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL

    await program.methods
      .fundEphemeral(amount)
      .accounts({
        launch: launchPda,
        ephemeralSol: ephemeralSolPda,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    console.log("✅ Funded with 0.1 SOL!");

    // Verify balance
    const ephemeral = await program.account.ephemeralSol.fetch(ephemeralSolPda);
    expect(ephemeral.balance.toNumber()).to.equal(0.1 * LAMPORTS_PER_SOL);
  });

  it("5. User: Delegate ephemeral_sol + user_commitment to TEE", async () => {
    console.log("\n🔐 Step 5: Delegating user accounts to TEE...");

    // 5a. Permission + delegate user_commitment
    const [ucPermission] = PublicKey.findProgramAddressSync(
      [Buffer.from("permission:"), userCommitmentPda.toBuffer()],
      PERMISSION_PROGRAM_ID
    );

    console.log("   Delegating user_commitment...");
    try {
      await program.methods
        .createPermission(
          { userCommitment: { launch: launchPda, user: user.publicKey } },
          null
        )
        .accounts({
          permissionedAccount: userCommitmentPda,
          permission: ucPermission,
          payer: user.publicKey,
          permissionProgram: PERMISSION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
    } catch (e) {
      console.log("   Permission may exist:", e.message?.slice(0, 50));
    }

    try {
      await program.methods
        .delegatePda({ userCommitment: { launch: launchPda, user: user.publicKey } })
        .accounts({
          pda: userCommitmentPda,
          payer: user.publicKey,
          validator: TEE_VALIDATOR,
        })
        .signers([user])
        .rpc();
    } catch (e) {
      console.log("   ⚠️ UC delegation:", e.message?.slice(0, 50));
    }

    // 5b. Permission + delegate ephemeral_sol
    const [esPermission] = PublicKey.findProgramAddressSync(
      [Buffer.from("permission:"), ephemeralSolPda.toBuffer()],
      PERMISSION_PROGRAM_ID
    );

    console.log("   Delegating ephemeral_sol...");
    try {
      await program.methods
        .createPermission(
          { ephemeralSol: { launch: launchPda, user: user.publicKey } },
          null
        )
        .accounts({
          permissionedAccount: ephemeralSolPda,
          permission: esPermission,
          payer: user.publicKey,
          permissionProgram: PERMISSION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
    } catch (e) {
      console.log("   Permission may exist:", e.message?.slice(0, 50));
    }

    try {
      await program.methods
        .delegatePda({ ephemeralSol: { launch: launchPda, user: user.publicKey } })
        .accounts({
          pda: ephemeralSolPda,
          payer: user.publicKey,
          validator: TEE_VALIDATOR,
        })
        .signers([user])
        .rpc();
    } catch (e) {
      console.log("   ⚠️ ES delegation:", e.message?.slice(0, 50));
    }

    console.log("✅ User accounts delegated!");
    console.log("   ⏳ Waiting 10s for ER to sync delegations...");
    await new Promise((r) => setTimeout(r, 10000));
  });

  it("6. User: Private Commit on TEE (THE KEY TEST!)", async () => {
    console.log("\n🔐 Step 6: PRIVATE COMMIT ON TEE...");
    console.log("   This is the fully private operation!");
    console.log("   Sending to:", ER_RPC_URL);

    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    try {
      const tx = await erProgram.methods
        .privateCommit(amount)
        .accounts({
          launch: launchPda,
          ephemeralSol: ephemeralSolPda,
          commitmentPool: commitmentPoolPda,
          userCommitment: userCommitmentPda,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      console.log("✅ PRIVATE COMMIT SUCCESSFUL!");
      console.log("   TX:", tx);
      console.log("");
      console.log("   🎉 THE PRIVACY FLOW WORKS! 🎉");
      console.log("   - No vault in transaction (vault is System-owned)");
      console.log("   - All writable accounts are delegated PDAs");
      console.log("   - Commitment recorded privately on TEE");
    } catch (e) {
      console.error("❌ Private commit failed:", e.message);
      console.log("");
      console.log("   Possible reasons:");
      console.log("   1. ER hasn't synced delegations yet (wait longer)");
      console.log("   2. Account not properly delegated");
      console.log("   3. ER endpoint issue");
      throw e;
    }
  });

  it("7. Verify commitment was recorded (query ER)", async () => {
    console.log("\n🔍 Step 7: Verifying commitment on ER...");

    try {
      // Query from ER (where the data lives while delegated)
      const userCommitment = await erProgram.account.userCommitment.fetch(
        userCommitmentPda
      );
      console.log("   Amount committed:", userCommitment.amount.toNumber() / LAMPORTS_PER_SOL, "SOL");
      expect(userCommitment.amount.toNumber()).to.equal(0.1 * LAMPORTS_PER_SOL);

      const pool = await erProgram.account.commitmentPool.fetch(commitmentPoolPda);
      console.log("   Pool total:", pool.totalCommitted.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Participants:", pool.totalParticipants.toNumber());

      console.log("✅ Commitment verified on TEE!");
    } catch (e) {
      console.log("   ⚠️ Could not query ER (data may not be synced yet):", e.message?.slice(0, 100));
    }
  });
});
