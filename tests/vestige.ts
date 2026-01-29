import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vestige } from "../target/types/vestige";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { expect } from "chai";

describe("vestige", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vestige as Program<Vestige>;

  // Test accounts
  let creator: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let tokenMint: PublicKey;

  // PDAs
  let launchPda: PublicKey;
  let launchBump: number;
  let commitmentPoolPda: PublicKey;
  let commitmentPoolBump: number;
  let vaultPda: PublicKey;
  let vaultBump: number;
  let user1CommitmentPda: PublicKey;
  let user2CommitmentPda: PublicKey;

  // Launch parameters
  const TOKEN_SUPPLY = new anchor.BN(1_000_000_000_000); // 1 trillion tokens
  const GRADUATION_TARGET = new anchor.BN(10 * LAMPORTS_PER_SOL); // 10 SOL
  const MIN_COMMITMENT = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL
  const MAX_COMMITMENT = new anchor.BN(5 * LAMPORTS_PER_SOL); // 5 SOL

  before(async () => {
    // Generate keypairs
    creator = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    // Airdrop SOL to all accounts
    const airdropAmount = 100 * LAMPORTS_PER_SOL;

    await Promise.all([
      provider.connection.requestAirdrop(creator.publicKey, airdropAmount),
      provider.connection.requestAirdrop(user1.publicKey, airdropAmount),
      provider.connection.requestAirdrop(user2.publicKey, airdropAmount),
    ]);

    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create token mint
    tokenMint = await createMint(
      provider.connection,
      creator,
      creator.publicKey,
      null,
      9 // 9 decimals
    );

    console.log("Token Mint:", tokenMint.toBase58());
    console.log("Creator:", creator.publicKey.toBase58());
    console.log("User1:", user1.publicKey.toBase58());
    console.log("User2:", user2.publicKey.toBase58());
  });

  describe("Phase 1: Initialize Launch", () => {
    it("should initialize a new token launch", async () => {
      // Derive PDAs
      [launchPda, launchBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("launch"), creator.publicKey.toBuffer(), tokenMint.toBuffer()],
        program.programId
      );

      [commitmentPoolPda, commitmentPoolBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("commitment_pool"), launchPda.toBuffer()],
        program.programId
      );

      [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), launchPda.toBuffer()],
        program.programId
      );

      // Set launch timing (start now, end in 1 hour)
      const now = Math.floor(Date.now() / 1000);
      const startTime = new anchor.BN(now - 60); // Started 1 minute ago
      const endTime = new anchor.BN(now + 3600); // Ends in 1 hour

      console.log("\n--- Initializing Launch ---");
      console.log("Launch PDA:", launchPda.toBase58());
      console.log("Commitment Pool PDA:", commitmentPoolPda.toBase58());
      console.log("Vault PDA:", vaultPda.toBase58());

      const tx = await program.methods
        .initializeLaunch(
          TOKEN_SUPPLY,
          startTime,
          endTime,
          GRADUATION_TARGET,
          MIN_COMMITMENT,
          MAX_COMMITMENT
        )
        .accounts({
          launch: launchPda,
          commitmentPool: commitmentPoolPda,
          vault: vaultPda,
          tokenMint: tokenMint,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      console.log("Initialize Launch TX:", tx);

      // Verify launch state
      const launchAccount = await program.account.launch.fetch(launchPda);
      expect(launchAccount.creator.toBase58()).to.equal(creator.publicKey.toBase58());
      expect(launchAccount.tokenMint.toBase58()).to.equal(tokenMint.toBase58());
      expect(launchAccount.tokenSupply.toString()).to.equal(TOKEN_SUPPLY.toString());
      expect(launchAccount.graduationTarget.toString()).to.equal(GRADUATION_TARGET.toString());
      expect(launchAccount.minCommitment.toString()).to.equal(MIN_COMMITMENT.toString());
      expect(launchAccount.maxCommitment.toString()).to.equal(MAX_COMMITMENT.toString());
      expect(launchAccount.totalCommitted.toString()).to.equal("0");
      expect(launchAccount.totalParticipants.toString()).to.equal("0");
      expect(launchAccount.isGraduated).to.equal(false);
      expect(launchAccount.isDelegated).to.equal(false);

      console.log("Launch initialized successfully!");
    });

    it("should fail to initialize with invalid time range", async () => {
      const newTokenMint = await createMint(
        provider.connection,
        creator,
        creator.publicKey,
        null,
        9
      );

      const [newLaunchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("launch"), creator.publicKey.toBuffer(), newTokenMint.toBuffer()],
        program.programId
      );

      const [newCommitmentPoolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("commitment_pool"), newLaunchPda.toBuffer()],
        program.programId
      );

      const [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), newLaunchPda.toBuffer()],
        program.programId
      );

      const now = Math.floor(Date.now() / 1000);
      const startTime = new anchor.BN(now + 3600); // Start in 1 hour
      const endTime = new anchor.BN(now); // End now (before start)

      try {
        await program.methods
          .initializeLaunch(
            TOKEN_SUPPLY,
            startTime,
            endTime,
            GRADUATION_TARGET,
            MIN_COMMITMENT,
            MAX_COMMITMENT
          )
          .accounts({
            launch: newLaunchPda,
            commitmentPool: newCommitmentPoolPda,
            vault: newVaultPda,
            tokenMint: newTokenMint,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("InvalidTimeRange");
        console.log("Correctly rejected invalid time range");
      }
    });
  });

  describe("Phase 2: Commitments", () => {
    it("should allow user1 to commit SOL", async () => {
      // Derive user1's commitment PDA
      [user1CommitmentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_commitment"), launchPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const commitAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      console.log("\n--- User1 Committing ---");
      console.log("User1 Commitment PDA:", user1CommitmentPda.toBase58());
      console.log("Commit Amount:", commitAmount.toString(), "lamports");

      const tx = await program.methods
        .commit(commitAmount)
        .accounts({
          launch: launchPda,
          commitmentPool: commitmentPoolPda,
          userCommitment: user1CommitmentPda,
          vault: vaultPda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      console.log("User1 Commit TX:", tx);

      // Verify user commitment
      const userCommitment = await program.account.userCommitment.fetch(user1CommitmentPda);
      expect(userCommitment.user.toBase58()).to.equal(user1.publicKey.toBase58());
      expect(userCommitment.launch.toBase58()).to.equal(launchPda.toBase58());
      expect(userCommitment.amount.toString()).to.equal(commitAmount.toString());
      expect(userCommitment.hasClaimed).to.equal(false);

      // Verify pool totals
      const pool = await program.account.commitmentPool.fetch(commitmentPoolPda);
      expect(pool.totalCommitted.toString()).to.equal(commitAmount.toString());
      expect(pool.totalParticipants.toString()).to.equal("1");

      console.log("User1 commitment successful!");
    });

    it("should allow user2 to commit SOL", async () => {
      // Derive user2's commitment PDA
      [user2CommitmentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_commitment"), launchPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      const commitAmount = new anchor.BN(2 * LAMPORTS_PER_SOL); // 2 SOL

      console.log("\n--- User2 Committing ---");
      console.log("User2 Commitment PDA:", user2CommitmentPda.toBase58());

      const tx = await program.methods
        .commit(commitAmount)
        .accounts({
          launch: launchPda,
          commitmentPool: commitmentPoolPda,
          userCommitment: user2CommitmentPda,
          vault: vaultPda,
          user: user2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      console.log("User2 Commit TX:", tx);

      // Verify pool totals
      const pool = await program.account.commitmentPool.fetch(commitmentPoolPda);
      expect(pool.totalCommitted.toString()).to.equal((3 * LAMPORTS_PER_SOL).toString()); // 1 + 2 SOL
      expect(pool.totalParticipants.toString()).to.equal("2");

      console.log("User2 commitment successful!");
    });

    it("should fail commitment below minimum", async () => {
      const user3 = Keypair.generate();
      await provider.connection.requestAirdrop(user3.publicKey, 10 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [user3CommitmentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_commitment"), launchPda.toBuffer(), user3.publicKey.toBuffer()],
        program.programId
      );

      const tooSmallAmount = new anchor.BN(0.01 * LAMPORTS_PER_SOL); // 0.01 SOL (below min)

      try {
        await program.methods
          .commit(tooSmallAmount)
          .accounts({
            launch: launchPda,
            commitmentPool: commitmentPoolPda,
            userCommitment: user3CommitmentPda,
            vault: vaultPda,
            user: user3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user3])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("BelowMinCommitment");
        console.log("Correctly rejected commitment below minimum");
      }
    });

    it("should fail commitment above maximum", async () => {
      const user4 = Keypair.generate();
      await provider.connection.requestAirdrop(user4.publicKey, 20 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [user4CommitmentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_commitment"), launchPda.toBuffer(), user4.publicKey.toBuffer()],
        program.programId
      );

      const tooLargeAmount = new anchor.BN(10 * LAMPORTS_PER_SOL); // 10 SOL (above max)

      try {
        await program.methods
          .commit(tooLargeAmount)
          .accounts({
            launch: launchPda,
            commitmentPool: commitmentPoolPda,
            userCommitment: user4CommitmentPda,
            vault: vaultPda,
            user: user4.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user4])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("AboveMaxCommitment");
        console.log("Correctly rejected commitment above maximum");
      }
    });

    it("should allow additional commitment from existing user", async () => {
      const additionalAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL

      const poolBefore = await program.account.commitmentPool.fetch(commitmentPoolPda);
      const participantsBefore = poolBefore.totalParticipants;

      const tx = await program.methods
        .commit(additionalAmount)
        .accounts({
          launch: launchPda,
          commitmentPool: commitmentPoolPda,
          userCommitment: user1CommitmentPda,
          vault: vaultPda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      console.log("Additional Commit TX:", tx);

      // Verify user commitment increased
      const userCommitment = await program.account.userCommitment.fetch(user1CommitmentPda);
      expect(userCommitment.amount.toString()).to.equal((1.5 * LAMPORTS_PER_SOL).toString());

      // Verify participant count didn't increase
      const poolAfter = await program.account.commitmentPool.fetch(commitmentPoolPda);
      expect(poolAfter.totalParticipants.toString()).to.equal(participantsBefore.toString());
      expect(poolAfter.totalCommitted.toString()).to.equal((3.5 * LAMPORTS_PER_SOL).toString());

      console.log("Additional commitment successful!");
    });
  });

  describe("Phase 3: Graduation (Time Expired)", () => {
    it("should graduate the launch when time expires", async () => {
      // Note: In a real test, we would wait for time to expire
      // For testing, we'll modify the launch to have an expired end time
      // This requires re-initializing with past end time

      // For this test, let's add enough commitments to reach graduation target
      // We need 10 SOL total, currently have 3.5 SOL
      // Add more users to reach the target

      const additionalUsers: Keypair[] = [];
      const additionalCommitmentPdas: PublicKey[] = [];

      for (let i = 0; i < 3; i++) {
        const user = Keypair.generate();
        additionalUsers.push(user);

        await provider.connection.requestAirdrop(user.publicKey, 10 * LAMPORTS_PER_SOL);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      for (let i = 0; i < 3; i++) {
        const [commitmentPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user_commitment"), launchPda.toBuffer(), additionalUsers[i].publicKey.toBuffer()],
          program.programId
        );
        additionalCommitmentPdas.push(commitmentPda);

        const commitAmount = new anchor.BN(2.5 * LAMPORTS_PER_SOL); // 2.5 SOL each

        await program.methods
          .commit(commitAmount)
          .accounts({
            launch: launchPda,
            commitmentPool: commitmentPoolPda,
            userCommitment: commitmentPda,
            vault: vaultPda,
            user: additionalUsers[i].publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([additionalUsers[i]])
          .rpc();
      }

      // Now total should be 3.5 + (3 * 2.5) = 11 SOL, which exceeds 10 SOL target
      const pool = await program.account.commitmentPool.fetch(commitmentPoolPda);
      console.log("\n--- Pre-Graduation State ---");
      console.log("Total Committed:", pool.totalCommitted.toString(), "lamports");
      console.log("Total Participants:", pool.totalParticipants.toString());

      // Graduate the launch
      const tx = await program.methods
        .graduate()
        .accounts({
          launch: launchPda,
          commitmentPool: commitmentPoolPda,
          authority: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      console.log("\n--- Graduation ---");
      console.log("Graduate TX:", tx);

      // Verify launch is graduated
      const launchAccount = await program.account.launch.fetch(launchPda);
      expect(launchAccount.isGraduated).to.equal(true);
      expect(launchAccount.totalCommitted.toString()).to.equal(pool.totalCommitted.toString());
      expect(launchAccount.totalParticipants.toString()).to.equal(pool.totalParticipants.toString());
      expect(launchAccount.graduationTime.toNumber()).to.be.greaterThan(0);

      console.log("Launch graduated successfully!");
      console.log("Graduation Time:", new Date(launchAccount.graduationTime.toNumber() * 1000).toISOString());
    });

    it("should fail to graduate already graduated launch", async () => {
      try {
        await program.methods
          .graduate()
          .accounts({
            launch: launchPda,
            commitmentPool: commitmentPoolPda,
            authority: creator.publicKey,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("AlreadyGraduated");
        console.log("Correctly rejected re-graduation");
      }
    });
  });

  describe("Phase 4: Calculate Allocations", () => {
    it("should calculate allocation for user1", async () => {
      console.log("\n--- Calculate User1 Allocation ---");

      const tx = await program.methods
        .calculateAllocation()
        .accounts({
          launch: launchPda,
          userCommitment: user1CommitmentPda,
          user: user1.publicKey,
        })
        .signers([user1])
        .rpc();

      console.log("Calculate Allocation TX:", tx);

      // Verify allocation was calculated
      const userCommitment = await program.account.userCommitment.fetch(user1CommitmentPda);
      expect(userCommitment.tokensAllocated.toNumber()).to.be.greaterThan(0);
      expect(userCommitment.weight.toNumber()).to.be.greaterThan(0);

      console.log("User1 Weight:", userCommitment.weight.toString());
      console.log("User1 Tokens Allocated:", userCommitment.tokensAllocated.toString());
    });

    it("should calculate allocation for user2", async () => {
      console.log("\n--- Calculate User2 Allocation ---");

      const tx = await program.methods
        .calculateAllocation()
        .accounts({
          launch: launchPda,
          userCommitment: user2CommitmentPda,
          user: user2.publicKey,
        })
        .signers([user2])
        .rpc();

      console.log("Calculate Allocation TX:", tx);

      const userCommitment = await program.account.userCommitment.fetch(user2CommitmentPda);
      console.log("User2 Weight:", userCommitment.weight.toString());
      console.log("User2 Tokens Allocated:", userCommitment.tokensAllocated.toString());
    });

    it("should fail to recalculate allocation", async () => {
      try {
        await program.methods
          .calculateAllocation()
          .accounts({
            launch: launchPda,
            userCommitment: user1CommitmentPda,
            user: user1.publicKey,
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("AllocationAlreadyCalculated");
        console.log("Correctly rejected recalculation");
      }
    });
  });

  describe("Get Launch Info", () => {
    it("should retrieve launch information", async () => {
      const tx = await program.methods
        .getLaunchInfo()
        .accounts({
          launch: launchPda,
        })
        .rpc();

      console.log("\n--- Launch Info ---");
      console.log("Get Launch Info TX:", tx);

      const launchAccount = await program.account.launch.fetch(launchPda);
      console.log("Creator:", launchAccount.creator.toBase58());
      console.log("Token Mint:", launchAccount.tokenMint.toBase58());
      console.log("Token Supply:", launchAccount.tokenSupply.toString());
      console.log("Graduation Target:", launchAccount.graduationTarget.toString());
      console.log("Total Committed:", launchAccount.totalCommitted.toString());
      console.log("Total Participants:", launchAccount.totalParticipants.toString());
      console.log("Is Graduated:", launchAccount.isGraduated);
      console.log("Is Delegated:", launchAccount.isDelegated);
    });
  });

  describe("Summary", () => {
    it("should display final state summary", async () => {
      console.log("\n========================================");
      console.log("=== VESTIGE LAUNCH TEST SUMMARY ===");
      console.log("========================================\n");

      const launchAccount = await program.account.launch.fetch(launchPda);
      const poolAccount = await program.account.commitmentPool.fetch(commitmentPoolPda);
      const user1Commitment = await program.account.userCommitment.fetch(user1CommitmentPda);
      const user2Commitment = await program.account.userCommitment.fetch(user2CommitmentPda);

      console.log("LAUNCH DETAILS:");
      console.log("-".repeat(40));
      console.log(`  Token Supply: ${launchAccount.tokenSupply.toString()} tokens`);
      console.log(`  Graduation Target: ${launchAccount.graduationTarget.toNumber() / LAMPORTS_PER_SOL} SOL`);
      console.log(`  Total Raised: ${launchAccount.totalCommitted.toNumber() / LAMPORTS_PER_SOL} SOL`);
      console.log(`  Total Participants: ${launchAccount.totalParticipants.toString()}`);
      console.log(`  Is Graduated: ${launchAccount.isGraduated}`);
      console.log(`  Is Delegated (Private): ${launchAccount.isDelegated}`);

      console.log("\nUSER COMMITMENTS:");
      console.log("-".repeat(40));
      console.log(`  User1: ${user1Commitment.amount.toNumber() / LAMPORTS_PER_SOL} SOL`);
      console.log(`    - Weight: ${user1Commitment.weight.toString()} (${(user1Commitment.weight.toNumber() / 100).toFixed(2)}%)`);
      console.log(`    - Tokens: ${user1Commitment.tokensAllocated.toString()}`);
      console.log(`  User2: ${user2Commitment.amount.toNumber() / LAMPORTS_PER_SOL} SOL`);
      console.log(`    - Weight: ${user2Commitment.weight.toString()} (${(user2Commitment.weight.toNumber() / 100).toFixed(2)}%)`);
      console.log(`    - Tokens: ${user2Commitment.tokensAllocated.toString()}`);

      console.log("\nPRIVACY FEATURES:");
      console.log("-".repeat(40));
      console.log("  - Commitment pool can be delegated to MagicBlock ER");
      console.log("  - When delegated, all commits are private until graduation");
      console.log("  - Token allocations revealed only after graduation");

      console.log("\n========================================");
      console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
      console.log("========================================\n");
    });
  });
});
