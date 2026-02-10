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
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("inverted-launch", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vestige as Program<Vestige>;

  // Test accounts
  let creator: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let user3: Keypair;
  let tokenMint: PublicKey;

  // PDAs
  let invertedLaunchPda: PublicKey;
  let bondedPoolPda: PublicKey;
  let invertedVaultPda: PublicKey;
  let user1BondPda: PublicKey;
  let user2BondPda: PublicKey;

  // Launch parameters
  const BONDED_SUPPLY = new anchor.BN(1_000_000_000_000); // 1T with 6 decimals
  const P_MAX = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL
  const P_MIN = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL
  const R_BEST = new anchor.BN(150_000); // 15x weight
  const R_MIN = new anchor.BN(10_000); // 1x weight (WEIGHT_SCALE)
  const GRADUATION_TARGET = new anchor.BN(5 * LAMPORTS_PER_SOL); // 5 SOL
  const WEIGHT_SCALE = 10_000;
  const BONDED_PRECISION = 1_000_000_000;

  let startTime: anchor.BN;
  let endTime: anchor.BN;

  before(async () => {
    creator = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    user3 = Keypair.generate();

    const airdropAmount = 100 * LAMPORTS_PER_SOL;
    await Promise.all([
      provider.connection.requestAirdrop(creator.publicKey, airdropAmount),
      provider.connection.requestAirdrop(user1.publicKey, airdropAmount),
      provider.connection.requestAirdrop(user2.publicKey, airdropAmount),
      provider.connection.requestAirdrop(user3.publicKey, airdropAmount),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create token mint
    tokenMint = await createMint(
      provider.connection,
      creator,
      creator.publicKey,
      null,
      6, // 6 decimals
    );

    console.log("Token Mint:", tokenMint.toBase58());
    console.log("Creator:", creator.publicKey.toBase58());
    console.log("User1:", user1.publicKey.toBase58());
    console.log("User2:", user2.publicKey.toBase58());

    // Derive PDAs
    [invertedLaunchPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("inverted_launch"),
        creator.publicKey.toBuffer(),
        tokenMint.toBuffer(),
      ],
      program.programId,
    );

    [bondedPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonded_pool"), invertedLaunchPda.toBuffer()],
      program.programId,
    );

    [invertedVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("inverted_vault"), invertedLaunchPda.toBuffer()],
      program.programId,
    );

    [user1BondPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_bond"),
        invertedLaunchPda.toBuffer(),
        user1.publicKey.toBuffer(),
      ],
      program.programId,
    );

    [user2BondPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_bond"),
        invertedLaunchPda.toBuffer(),
        user2.publicKey.toBuffer(),
      ],
      program.programId,
    );
  });

  describe("Phase 1: Initialize Inverted Launch", () => {
    it("should initialize a new inverted launch", async () => {
      const now = Math.floor(Date.now() / 1000);
      startTime = new anchor.BN(now - 10); // Started 10 seconds ago
      endTime = new anchor.BN(now + 600); // Ends in 10 minutes

      console.log("\n--- Initializing Inverted Launch ---");
      console.log("Inverted Launch PDA:", invertedLaunchPda.toBase58());
      console.log("Bonded Pool PDA:", bondedPoolPda.toBase58());
      console.log("Inverted Vault PDA:", invertedVaultPda.toBase58());

      const tx = await program.methods
        .initializeInvertedLaunch(
          BONDED_SUPPLY,
          startTime,
          endTime,
          P_MAX,
          P_MIN,
          R_BEST,
          R_MIN,
          GRADUATION_TARGET,
        )
        .accounts({
          invertedLaunch: invertedLaunchPda,
          bondedPool: bondedPoolPda,
          invertedVault: invertedVaultPda,
          tokenMint: tokenMint,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      console.log("Initialize TX:", tx);

      // Verify launch state
      const launch = await program.account.invertedLaunch.fetch(
        invertedLaunchPda,
      );
      expect(launch.creator.toBase58()).to.equal(
        creator.publicKey.toBase58(),
      );
      expect(launch.tokenMint.toBase58()).to.equal(tokenMint.toBase58());
      expect(launch.bondedSupply.toString()).to.equal(
        BONDED_SUPPLY.toString(),
      );
      expect(launch.pMax.toString()).to.equal(P_MAX.toString());
      expect(launch.pMin.toString()).to.equal(P_MIN.toString());
      expect(launch.rBest.toString()).to.equal(R_BEST.toString());
      expect(launch.rMin.toString()).to.equal(R_MIN.toString());
      expect(launch.graduationTarget.toString()).to.equal(
        GRADUATION_TARGET.toString(),
      );
      expect(launch.totalBondedSold.toString()).to.equal("0");
      expect(launch.totalSolCollected.toString()).to.equal("0");
      expect(launch.isGraduated).to.equal(false);

      // Verify bonded pool
      const pool = await program.account.bondedPool.fetch(bondedPoolPda);
      expect(pool.inverted_launch || pool.invertedLaunch).to.exist;
      expect(pool.totalBondedSold.toString()).to.equal("0");
      expect(pool.totalSolCollected.toString()).to.equal("0");
      expect(pool.totalWeightedUnits.toString()).to.equal("0");
      expect(pool.totalParticipants.toString()).to.equal("0");

      console.log("Inverted launch initialized successfully!");
    });

    it("should fail with wrong price ratio", async () => {
      const newMint = await createMint(
        provider.connection,
        creator,
        creator.publicKey,
        null,
        6,
      );

      const [newLaunchPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("inverted_launch"),
          creator.publicKey.toBuffer(),
          newMint.toBuffer(),
        ],
        program.programId,
      );
      const [newPoolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonded_pool"), newLaunchPda.toBuffer()],
        program.programId,
      );
      const [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("inverted_vault"), newLaunchPda.toBuffer()],
        program.programId,
      );

      const now = Math.floor(Date.now() / 1000);

      try {
        await program.methods
          .initializeInvertedLaunch(
            BONDED_SUPPLY,
            new anchor.BN(now),
            new anchor.BN(now + 3600),
            P_MAX,
            new anchor.BN(0.2 * LAMPORTS_PER_SOL), // Wrong ratio (should be 0.1)
            R_BEST,
            R_MIN,
            GRADUATION_TARGET,
          )
          .accounts({
            invertedLaunch: newLaunchPda,
            bondedPool: newPoolPda,
            invertedVault: newVaultPda,
            tokenMint: newMint,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("InvalidPriceRatio");
        console.log("Correctly rejected wrong price ratio");
      }
    });

    it("should fail with r_min below WEIGHT_SCALE", async () => {
      const newMint = await createMint(
        provider.connection,
        creator,
        creator.publicKey,
        null,
        6,
      );

      const [newLaunchPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("inverted_launch"),
          creator.publicKey.toBuffer(),
          newMint.toBuffer(),
        ],
        program.programId,
      );
      const [newPoolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonded_pool"), newLaunchPda.toBuffer()],
        program.programId,
      );
      const [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("inverted_vault"), newLaunchPda.toBuffer()],
        program.programId,
      );

      const now = Math.floor(Date.now() / 1000);

      try {
        await program.methods
          .initializeInvertedLaunch(
            BONDED_SUPPLY,
            new anchor.BN(now),
            new anchor.BN(now + 3600),
            P_MAX,
            P_MIN,
            R_BEST,
            new anchor.BN(5000), // Below WEIGHT_SCALE (10000)
            GRADUATION_TARGET,
          )
          .accounts({
            invertedLaunch: newLaunchPda,
            bondedPool: newPoolPda,
            invertedVault: newVaultPda,
            tokenMint: newMint,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("WeightBelowMinimum");
        console.log("Correctly rejected r_min below WEIGHT_SCALE");
      }
    });
  });

  describe("Phase 2: Buy Bonded Units", () => {
    it("should allow user1 to buy bonded units (early buyer)", async () => {
      const buyAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      console.log("\n--- User1 Buying Bonded (Early) ---");

      const vaultBalanceBefore = await provider.connection.getBalance(
        invertedVaultPda,
      );

      const tx = await program.methods
        .buyBonded(buyAmount)
        .accounts({
          invertedLaunch: invertedLaunchPda,
          bondedPool: bondedPoolPda,
          userBond: user1BondPda,
          invertedVault: invertedVaultPda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      console.log("User1 Buy TX:", tx);

      // Verify user bond
      const bond = await program.account.userBond.fetch(user1BondPda);
      expect(bond.user.toBase58()).to.equal(user1.publicKey.toBase58());
      expect(bond.totalSolSpent.toNumber()).to.equal(LAMPORTS_PER_SOL);
      expect(bond.totalBondedUnits.toNumber()).to.be.greaterThan(0);
      expect(bond.weightedBondedUnits.toNumber()).to.be.greaterThan(0);

      // Verify vault received SOL
      const vaultBalanceAfter = await provider.connection.getBalance(
        invertedVaultPda,
      );
      expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(LAMPORTS_PER_SOL);

      // Verify pool totals
      const pool = await program.account.bondedPool.fetch(bondedPoolPda);
      expect(pool.totalParticipants.toString()).to.equal("1");
      expect(pool.totalSolCollected.toNumber()).to.equal(LAMPORTS_PER_SOL);

      console.log("User1 bonded units:", bond.totalBondedUnits.toString());
      console.log(
        "User1 weighted units:",
        bond.weightedBondedUnits.toString(),
      );
      console.log("User1 buy successful!");
    });

    it("should allow user2 to buy bonded units", async () => {
      // Wait a bit so price/weight has changed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const buyAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      console.log("\n--- User2 Buying Bonded (Later) ---");

      const tx = await program.methods
        .buyBonded(buyAmount)
        .accounts({
          invertedLaunch: invertedLaunchPda,
          bondedPool: bondedPoolPda,
          userBond: user2BondPda,
          invertedVault: invertedVaultPda,
          user: user2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      console.log("User2 Buy TX:", tx);

      const bond2 = await program.account.userBond.fetch(user2BondPda);
      const bond1 = await program.account.userBond.fetch(user1BondPda);

      console.log("User2 bonded units:", bond2.totalBondedUnits.toString());
      console.log(
        "User2 weighted units:",
        bond2.weightedBondedUnits.toString(),
      );

      // User2 bought at a lower price, so should get more bonded units
      // But user1 bought earlier with higher weight
      // Both spent 1 SOL
      console.log(
        "User1 weighted/bonded ratio:",
        bond1.weightedBondedUnits.toNumber() /
          bond1.totalBondedUnits.toNumber(),
      );
      console.log(
        "User2 weighted/bonded ratio:",
        bond2.weightedBondedUnits.toNumber() /
          bond2.totalBondedUnits.toNumber(),
      );

      // Verify pool
      const pool = await program.account.bondedPool.fetch(bondedPoolPda);
      expect(pool.totalParticipants.toString()).to.equal("2");
      expect(pool.totalSolCollected.toNumber()).to.equal(2 * LAMPORTS_PER_SOL);

      console.log("User2 buy successful!");
    });

    it("should allow additional buy from same user", async () => {
      const additionalAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

      const bondBefore = await program.account.userBond.fetch(user1BondPda);
      const poolBefore = await program.account.bondedPool.fetch(bondedPoolPda);

      const tx = await program.methods
        .buyBonded(additionalAmount)
        .accounts({
          invertedLaunch: invertedLaunchPda,
          bondedPool: bondedPoolPda,
          userBond: user1BondPda,
          invertedVault: invertedVaultPda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      console.log("Additional Buy TX:", tx);

      const bondAfter = await program.account.userBond.fetch(user1BondPda);
      expect(bondAfter.totalSolSpent.toNumber()).to.equal(
        1.5 * LAMPORTS_PER_SOL,
      );
      expect(bondAfter.totalBondedUnits.toNumber()).to.be.greaterThan(
        bondBefore.totalBondedUnits.toNumber(),
      );

      // Participant count should NOT increase
      const poolAfter = await program.account.bondedPool.fetch(bondedPoolPda);
      expect(poolAfter.totalParticipants.toString()).to.equal(
        poolBefore.totalParticipants.toString(),
      );

      console.log("Additional buy successful!");
    });

    it("should fail with zero SOL amount", async () => {
      const [user3BondPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_bond"),
          invertedLaunchPda.toBuffer(),
          user3.publicKey.toBuffer(),
        ],
        program.programId,
      );

      try {
        await program.methods
          .buyBonded(new anchor.BN(0))
          .accounts({
            invertedLaunch: invertedLaunchPda,
            bondedPool: bondedPoolPda,
            userBond: user3BondPda,
            invertedVault: invertedVaultPda,
            user: user3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user3])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("InvalidSolAmount");
        console.log("Correctly rejected zero amount");
      }
    });
  });

  describe("Phase 3: Graduate", () => {
    it("should add more SOL to reach graduation target then graduate", async () => {
      // Need to reach 5 SOL. Currently have 2.5 SOL. Add 3 more users.
      const extraUsers: Keypair[] = [];
      for (let i = 0; i < 2; i++) {
        const u = Keypair.generate();
        extraUsers.push(u);
        await provider.connection.requestAirdrop(
          u.publicKey,
          10 * LAMPORTS_PER_SOL,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));

      for (const u of extraUsers) {
        const [bondPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("user_bond"),
            invertedLaunchPda.toBuffer(),
            u.publicKey.toBuffer(),
          ],
          program.programId,
        );

        await program.methods
          .buyBonded(new anchor.BN(2 * LAMPORTS_PER_SOL))
          .accounts({
            invertedLaunch: invertedLaunchPda,
            bondedPool: bondedPoolPda,
            userBond: bondPda,
            invertedVault: invertedVaultPda,
            user: u.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([u])
          .rpc();
      }

      // Verify target reached
      const pool = await program.account.bondedPool.fetch(bondedPoolPda);
      console.log(
        "\nTotal SOL collected:",
        pool.totalSolCollected.toNumber() / LAMPORTS_PER_SOL,
        "SOL",
      );
      expect(pool.totalSolCollected.toNumber()).to.be.greaterThanOrEqual(
        GRADUATION_TARGET.toNumber(),
      );

      // Graduate
      const tx = await program.methods
        .graduateInverted()
        .accounts({
          invertedLaunch: invertedLaunchPda,
          bondedPool: bondedPoolPda,
          authority: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      console.log("Graduate TX:", tx);

      const launch = await program.account.invertedLaunch.fetch(
        invertedLaunchPda,
      );
      expect(launch.isGraduated).to.equal(true);
      expect(launch.totalSolCollected.toNumber()).to.equal(
        pool.totalSolCollected.toNumber(),
      );
      expect(launch.totalBondedSold.toNumber()).to.equal(
        pool.totalBondedSold.toNumber(),
      );

      console.log("Inverted launch graduated successfully!");
    });

    it("should fail to re-graduate", async () => {
      try {
        await program.methods
          .graduateInverted()
          .accounts({
            invertedLaunch: invertedLaunchPda,
            bondedPool: bondedPoolPda,
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

  describe("Phase 4: Calculate Rebase", () => {
    it("should calculate rebase for user1", async () => {
      console.log("\n--- Calculate Rebase for User1 ---");

      const tx = await program.methods
        .calculateRebase()
        .accounts({
          invertedLaunch: invertedLaunchPda,
          userBond: user1BondPda,
          user: user1.publicKey,
        })
        .signers([user1])
        .rpc();

      console.log("Calculate Rebase TX:", tx);

      const bond = await program.account.userBond.fetch(user1BondPda);
      const expectedFinalTokens = Math.floor(
        bond.weightedBondedUnits.toNumber() / WEIGHT_SCALE,
      );
      expect(bond.finalTokens.toNumber()).to.equal(expectedFinalTokens);
      expect(bond.finalTokens.toNumber()).to.be.greaterThan(0);

      console.log("User1 final tokens:", bond.finalTokens.toString());
      console.log(
        "User1 effective price per token:",
        bond.totalSolSpent.toNumber() / bond.finalTokens.toNumber(),
        "lamports",
      );
    });

    it("should calculate rebase for user2", async () => {
      console.log("\n--- Calculate Rebase for User2 ---");

      const tx = await program.methods
        .calculateRebase()
        .accounts({
          invertedLaunch: invertedLaunchPda,
          userBond: user2BondPda,
          user: user2.publicKey,
        })
        .signers([user2])
        .rpc();

      console.log("Calculate Rebase TX:", tx);

      const bond = await program.account.userBond.fetch(user2BondPda);
      expect(bond.finalTokens.toNumber()).to.be.greaterThan(0);

      console.log("User2 final tokens:", bond.finalTokens.toString());
      console.log(
        "User2 effective price per token:",
        bond.totalSolSpent.toNumber() / bond.finalTokens.toNumber(),
        "lamports",
      );
    });

    it("early buyer (user1) should get more final tokens per SOL than late buyer (user2)", async () => {
      const bond1 = await program.account.userBond.fetch(user1BondPda);
      const bond2 = await program.account.userBond.fetch(user2BondPda);

      // User1 spent 1.5 SOL, User2 spent 1 SOL
      // Calculate tokens per SOL
      const user1TokensPerSol =
        bond1.finalTokens.toNumber() / bond1.totalSolSpent.toNumber();
      const user2TokensPerSol =
        bond2.finalTokens.toNumber() / bond2.totalSolSpent.toNumber();

      console.log(
        "\nUser1 tokens per lamport:",
        user1TokensPerSol.toFixed(6),
      );
      console.log(
        "User2 tokens per lamport:",
        user2TokensPerSol.toFixed(6),
      );

      // Early buyer should get better rate (higher risk weight)
      expect(user1TokensPerSol).to.be.greaterThan(user2TokensPerSol);
      console.log("Early buyer advantage confirmed!");
    });

    it("should fail to recalculate rebase", async () => {
      try {
        await program.methods
          .calculateRebase()
          .accounts({
            invertedLaunch: invertedLaunchPda,
            userBond: user1BondPda,
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

  describe("Phase 5: Claim Tokens", () => {
    let tokenVault: PublicKey;
    let user1TokenAccount: PublicKey;
    let user2TokenAccount: PublicKey;

    before(async () => {
      // Create ATA for the inverted launch PDA (token vault)
      tokenVault = await createAssociatedTokenAccount(
        provider.connection,
        creator,
        tokenMint,
        invertedLaunchPda,
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID,
      );

      // Mint tokens to the vault
      const bond1 = await program.account.userBond.fetch(user1BondPda);
      const bond2 = await program.account.userBond.fetch(user2BondPda);
      const totalNeeded =
        bond1.finalTokens.toNumber() + bond2.finalTokens.toNumber() + 1000000; // extra buffer

      await mintTo(
        provider.connection,
        creator,
        tokenMint,
        tokenVault,
        creator.publicKey,
        totalNeeded,
      );

      // Create user token accounts
      user1TokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        user1,
        tokenMint,
        user1.publicKey,
      );

      user2TokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        user2,
        tokenMint,
        user2.publicKey,
      );
    });

    it("should allow user1 to claim tokens", async () => {
      const bond = await program.account.userBond.fetch(user1BondPda);
      const expectedTokens = bond.finalTokens.toNumber();

      console.log("\n--- User1 Claiming Tokens ---");
      console.log("Expected tokens:", expectedTokens);

      const tx = await program.methods
        .claimRebase()
        .accounts({
          invertedLaunch: invertedLaunchPda,
          userBond: user1BondPda,
          tokenVault: tokenVault,
          userTokenAccount: user1TokenAccount,
          user: user1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      console.log("Claim TX:", tx);

      // Verify token balance
      const tokenAccount = await getAccount(
        provider.connection,
        user1TokenAccount,
      );
      expect(Number(tokenAccount.amount)).to.equal(expectedTokens);

      // Verify has_claimed flag
      const bondAfter = await program.account.userBond.fetch(user1BondPda);
      expect(bondAfter.hasClaimed).to.equal(true);

      console.log("User1 claimed", expectedTokens, "tokens");
    });

    it("should allow user2 to claim tokens", async () => {
      const bond = await program.account.userBond.fetch(user2BondPda);

      const tx = await program.methods
        .claimRebase()
        .accounts({
          invertedLaunch: invertedLaunchPda,
          userBond: user2BondPda,
          tokenVault: tokenVault,
          userTokenAccount: user2TokenAccount,
          user: user2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();

      console.log("User2 Claim TX:", tx);

      const tokenAccount = await getAccount(
        provider.connection,
        user2TokenAccount,
      );
      expect(Number(tokenAccount.amount)).to.equal(
        bond.finalTokens.toNumber(),
      );
      console.log("User2 claimed", bond.finalTokens.toString(), "tokens");
    });

    it("should fail double claim", async () => {
      try {
        await program.methods
          .claimRebase()
          .accounts({
            invertedLaunch: invertedLaunchPda,
            userBond: user1BondPda,
            tokenVault: tokenVault,
            userTokenAccount: user1TokenAccount,
            user: user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("AlreadyClaimed");
        console.log("Correctly rejected double claim");
      }
    });
  });

  describe("Phase 6: Creator Withdraw", () => {
    it("should allow creator to withdraw SOL", async () => {
      const creatorBalanceBefore = await provider.connection.getBalance(
        creator.publicKey,
      );
      const vaultBalance = await provider.connection.getBalance(
        invertedVaultPda,
      );

      console.log(
        "\n--- Creator Withdrawing ---",
      );
      console.log("Vault balance:", vaultBalance / LAMPORTS_PER_SOL, "SOL");

      const tx = await program.methods
        .creatorWithdrawInverted()
        .accounts({
          invertedLaunch: invertedLaunchPda,
          invertedVault: invertedVaultPda,
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      console.log("Withdraw TX:", tx);

      const creatorBalanceAfter = await provider.connection.getBalance(
        creator.publicKey,
      );
      expect(creatorBalanceAfter).to.be.greaterThan(creatorBalanceBefore);

      console.log(
        "Creator received:",
        (creatorBalanceAfter - creatorBalanceBefore) / LAMPORTS_PER_SOL,
        "SOL (minus tx fees)",
      );
    });

    it("should fail non-creator withdrawal", async () => {
      try {
        await program.methods
          .creatorWithdrawInverted()
          .accounts({
            invertedLaunch: invertedLaunchPda,
            invertedVault: invertedVaultPda,
            creator: user1.publicKey,
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("Unauthorized");
        console.log("Correctly rejected non-creator withdrawal");
      }
    });
  });

  describe("Summary", () => {
    it("should display final state summary", async () => {
      console.log("\n============================================");
      console.log("=== INVERTED LAUNCH TEST SUMMARY ===");
      console.log("============================================\n");

      const launch = await program.account.invertedLaunch.fetch(
        invertedLaunchPda,
      );
      const pool = await program.account.bondedPool.fetch(bondedPoolPda);
      const bond1 = await program.account.userBond.fetch(user1BondPda);
      const bond2 = await program.account.userBond.fetch(user2BondPda);

      console.log("LAUNCH DETAILS:");
      console.log("-".repeat(40));
      console.log(
        `  Bonded Supply: ${launch.bondedSupply.toString()}`,
      );
      console.log(
        `  Price Range: ${launch.pMax.toNumber() / LAMPORTS_PER_SOL} -> ${launch.pMin.toNumber() / LAMPORTS_PER_SOL} SOL`,
      );
      console.log(
        `  Weight Range: ${launch.rBest.toNumber() / WEIGHT_SCALE}x -> ${launch.rMin.toNumber() / WEIGHT_SCALE}x`,
      );
      console.log(
        `  Graduation Target: ${launch.graduationTarget.toNumber() / LAMPORTS_PER_SOL} SOL`,
      );
      console.log(
        `  Total SOL Collected: ${launch.totalSolCollected.toNumber() / LAMPORTS_PER_SOL} SOL`,
      );
      console.log(
        `  Total Bonded Sold: ${launch.totalBondedSold.toString()}`,
      );
      console.log(`  Is Graduated: ${launch.isGraduated}`);
      console.log(
        `  Total Participants: ${pool.totalParticipants.toString()}`,
      );

      console.log("\nUSER BONDS:");
      console.log("-".repeat(40));
      console.log(
        `  User1: ${bond1.totalSolSpent.toNumber() / LAMPORTS_PER_SOL} SOL spent`,
      );
      console.log(
        `    - Bonded Units: ${bond1.totalBondedUnits.toString()}`,
      );
      console.log(
        `    - Weighted Units: ${bond1.weightedBondedUnits.toString()}`,
      );
      console.log(`    - Final Tokens: ${bond1.finalTokens.toString()}`);
      console.log(`    - Claimed: ${bond1.hasClaimed}`);
      console.log(
        `  User2: ${bond2.totalSolSpent.toNumber() / LAMPORTS_PER_SOL} SOL spent`,
      );
      console.log(
        `    - Bonded Units: ${bond2.totalBondedUnits.toString()}`,
      );
      console.log(
        `    - Weighted Units: ${bond2.weightedBondedUnits.toString()}`,
      );
      console.log(`    - Final Tokens: ${bond2.finalTokens.toString()}`);
      console.log(`    - Claimed: ${bond2.hasClaimed}`);

      console.log("\nKEY INSIGHT:");
      console.log("-".repeat(40));
      const u1rate =
        bond1.finalTokens.toNumber() /
        (bond1.totalSolSpent.toNumber() / LAMPORTS_PER_SOL);
      const u2rate =
        bond2.finalTokens.toNumber() /
        (bond2.totalSolSpent.toNumber() / LAMPORTS_PER_SOL);
      console.log(
        `  User1 (early) tokens per SOL: ${u1rate.toFixed(2)}`,
      );
      console.log(
        `  User2 (later) tokens per SOL: ${u2rate.toFixed(2)}`,
      );
      console.log(
        `  Early buyer advantage: ${((u1rate / u2rate - 1) * 100).toFixed(1)}%`,
      );

      console.log("\n============================================");
      console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
      console.log("============================================\n");
    });
  });
});
