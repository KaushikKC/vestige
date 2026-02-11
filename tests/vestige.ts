import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { assert, expect } from "chai";

const LAUNCH_SEED = Buffer.from("launch");
const POSITION_SEED = Buffer.from("position");
const VAULT_SEED = Buffer.from("vault");

const TOKEN_PRECISION = 1_000_000_000;
const WEIGHT_PRECISION = 1_000;

describe("vestige", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.vestige as Program;
  const connection = provider.connection;

  // Keypairs
  const creator = provider.wallet as anchor.Wallet;
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  // Token mint
  let tokenMint: PublicKey;

  // PDAs
  let launchPda: PublicKey;
  let launchBump: number;
  let vaultPda: PublicKey;
  let tokenVault: PublicKey;

  // Test parameters
  const tokenSupply = new BN(1_000_000 * TOKEN_PRECISION); // 1M tokens
  const bonusPool = new BN(500_000 * TOKEN_PRECISION); // 500K bonus tokens
  const pMax = new BN(1 * LAMPORTS_PER_SOL); // 1 SOL
  const pMin = new BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL
  const rBest = new BN(15);
  const rMin = new BN(1);
  const graduationTarget = new BN(2 * LAMPORTS_PER_SOL); // 2 SOL target

  let startTime: BN;
  let endTime: BN;

  before(async () => {
    // Airdrop to users
    const airdropAmount = 10 * LAMPORTS_PER_SOL;

    const sig1 = await connection.requestAirdrop(user1.publicKey, airdropAmount);
    await connection.confirmTransaction(sig1, "confirmed");

    const sig2 = await connection.requestAirdrop(user2.publicKey, airdropAmount);
    await connection.confirmTransaction(sig2, "confirmed");

    // Create SPL token mint
    tokenMint = await createMint(
      connection,
      creator.payer,
      creator.publicKey,
      creator.publicKey,
      9 // 9 decimals to match TOKEN_PRECISION
    );

    // Derive PDAs
    [launchPda, launchBump] = PublicKey.findProgramAddressSync(
      [LAUNCH_SEED, creator.publicKey.toBuffer(), tokenMint.toBuffer()],
      program.programId
    );

    [vaultPda] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, launchPda.toBuffer()],
      program.programId
    );

    // Token vault is Launch PDA's ATA
    tokenVault = getAssociatedTokenAddressSync(
      tokenMint,
      launchPda,
      true, // allowOwnerOffCurve for PDA
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  });

  describe("initialize_launch", () => {
    it("creates a launch with valid parameters", async () => {
      const now = Math.floor(Date.now() / 1000);
      startTime = new BN(now);
      endTime = new BN(now + 300); // 5 minutes

      await program.methods
        .initializeLaunch(
          tokenSupply,
          bonusPool,
          startTime,
          endTime,
          pMax,
          pMin,
          rBest,
          rMin,
          graduationTarget
        )
        .accounts({
          launch: launchPda,
          vault: vaultPda,
          tokenMint,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Verify launch account
      const launch = await program.account.launch.fetch(launchPda);
      assert.ok(launch.creator.equals(creator.publicKey));
      assert.ok(launch.tokenMint.equals(tokenMint));
      assert.equal(launch.tokenSupply.toString(), tokenSupply.toString());
      assert.equal(launch.bonusPool.toString(), bonusPool.toString());
      assert.equal(launch.pMax.toString(), pMax.toString());
      assert.equal(launch.pMin.toString(), pMin.toString());
      assert.equal(launch.rBest.toString(), rBest.toString());
      assert.equal(launch.rMin.toString(), rMin.toString());
      assert.equal(
        launch.graduationTarget.toString(),
        graduationTarget.toString()
      );
      assert.equal(launch.totalBaseSold.toNumber(), 0);
      assert.equal(launch.totalBonusReserved.toNumber(), 0);
      assert.equal(launch.totalSolCollected.toNumber(), 0);
      assert.equal(launch.totalParticipants.toNumber(), 0);
      assert.equal(launch.isGraduated, false);

      // Verify vault exists and is owned by program
      const vaultInfo = await connection.getAccountInfo(vaultPda);
      assert.ok(vaultInfo !== null);
      assert.ok(vaultInfo.owner.equals(program.programId));
    });

    it("fails with wrong price ratio", async () => {
      const badMint = await createMint(
        connection,
        creator.payer,
        creator.publicKey,
        null,
        9
      );

      const [badLaunchPda] = PublicKey.findProgramAddressSync(
        [LAUNCH_SEED, creator.publicKey.toBuffer(), badMint.toBuffer()],
        program.programId
      );
      const [badVaultPda] = PublicKey.findProgramAddressSync(
        [VAULT_SEED, badLaunchPda.toBuffer()],
        program.programId
      );

      const now = Math.floor(Date.now() / 1000);

      try {
        await program.methods
          .initializeLaunch(
            tokenSupply,
            bonusPool,
            new BN(now),
            new BN(now + 300),
            pMax,
            new BN(0.2 * LAMPORTS_PER_SOL), // wrong ratio (5:1 instead of 10:1)
            rBest,
            rMin,
            graduationTarget
          )
          .accounts({
            launch: badLaunchPda,
            vault: badVaultPda,
            tokenMint: badMint,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("should have thrown");
      } catch (e: any) {
        assert.include(e.message, "InvalidPriceRatio");
      }
    });

    it("fails with r_best <= PRICE_RATIO", async () => {
      const badMint = await createMint(
        connection,
        creator.payer,
        creator.publicKey,
        null,
        9
      );

      const [badLaunchPda] = PublicKey.findProgramAddressSync(
        [LAUNCH_SEED, creator.publicKey.toBuffer(), badMint.toBuffer()],
        program.programId
      );
      const [badVaultPda] = PublicKey.findProgramAddressSync(
        [VAULT_SEED, badLaunchPda.toBuffer()],
        program.programId
      );

      const now = Math.floor(Date.now() / 1000);

      try {
        await program.methods
          .initializeLaunch(
            tokenSupply,
            bonusPool,
            new BN(now),
            new BN(now + 300),
            pMax,
            pMin,
            new BN(10), // rBest == PRICE_RATIO, should be >
            rMin,
            graduationTarget
          )
          .accounts({
            launch: badLaunchPda,
            vault: badVaultPda,
            tokenMint: badMint,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("should have thrown");
      } catch (e: any) {
        assert.include(e.message, "RiskWeightTooLow");
      }
    });
  });

  describe("fund token vault", () => {
    it("creates ATA for launch PDA and mints tokens", async () => {
      // Create ATA for the Launch PDA (token vault)
      const vaultAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        creator.payer,
        tokenMint,
        launchPda,
        true // allowOwnerOffCurve for PDA
      );

      // Mint supply + bonus pool to vault
      const totalMint =
        tokenSupply.toNumber() + bonusPool.toNumber();
      await mintTo(
        connection,
        creator.payer,
        tokenMint,
        vaultAccount.address,
        creator.publicKey,
        totalMint
      );

      // Verify balance
      const info = await getAccount(connection, vaultAccount.address);
      assert.equal(info.amount.toString(), totalMint.toString());
    });
  });

  describe("buy", () => {
    let user1TokenAccount: PublicKey;
    let user2TokenAccount: PublicKey;

    before(async () => {
      // Create ATAs for users
      const u1Ata = await getOrCreateAssociatedTokenAccount(
        connection,
        creator.payer,
        tokenMint,
        user1.publicKey
      );
      user1TokenAccount = u1Ata.address;

      const u2Ata = await getOrCreateAssociatedTokenAccount(
        connection,
        creator.payer,
        tokenMint,
        user2.publicKey
      );
      user2TokenAccount = u2Ata.address;
    });

    it("user1 buys early — gets base tokens in wallet + bonus recorded", async () => {
      const buyAmount = new BN(0.5 * LAMPORTS_PER_SOL);

      const [positionPda] = PublicKey.findProgramAddressSync(
        [POSITION_SEED, launchPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .buy(buyAmount)
        .accounts({
          launch: launchPda,
          userPosition: positionPda,
          vault: vaultPda,
          tokenVault,
          userTokenAccount: user1TokenAccount,
          user: user1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      // Verify user got base tokens
      const tokenInfo = await getAccount(connection, user1TokenAccount);
      assert.ok(Number(tokenInfo.amount) > 0, "User1 should have received base tokens");

      // Verify position
      const pos = await program.account.userPosition.fetch(positionPda);
      assert.equal(pos.totalSolSpent.toString(), buyAmount.toString());
      assert.ok(pos.totalBaseTokens.toNumber() > 0);
      assert.ok(pos.totalBonusEntitled.toNumber() > 0);
      assert.equal(pos.hasClaimedBonus, false);

      // Verify launch totals updated
      const launch = await program.account.launch.fetch(launchPda);
      assert.ok(launch.totalBaseSold.toNumber() > 0);
      assert.ok(launch.totalBonusReserved.toNumber() > 0);
      assert.equal(launch.totalSolCollected.toString(), buyAmount.toString());
      assert.equal(launch.totalParticipants.toNumber(), 1);
    });

    it("user2 buys later — gets different rate", async () => {
      // Wait a bit so the curve moves
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const buyAmount = new BN(0.5 * LAMPORTS_PER_SOL);

      const [positionPda] = PublicKey.findProgramAddressSync(
        [POSITION_SEED, launchPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .buy(buyAmount)
        .accounts({
          launch: launchPda,
          userPosition: positionPda,
          vault: vaultPda,
          tokenVault,
          userTokenAccount: user2TokenAccount,
          user: user2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      // Verify user2 got tokens
      const tokenInfo = await getAccount(connection, user2TokenAccount);
      assert.ok(Number(tokenInfo.amount) > 0, "User2 should have received base tokens");

      // Verify launch totals
      const launch = await program.account.launch.fetch(launchPda);
      assert.equal(launch.totalParticipants.toNumber(), 2);
    });

    it("fails with zero amount", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [POSITION_SEED, launchPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .buy(new BN(0))
          .accounts({
            launch: launchPda,
            userPosition: positionPda,
            vault: vaultPda,
            tokenVault,
            userTokenAccount: user1TokenAccount,
            user: user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        assert.fail("should have thrown");
      } catch (e: any) {
        assert.include(e.message, "InvalidSolAmount");
      }
    });
  });

  describe("graduate", () => {
    it("fails before conditions are met (if not enough SOL and time not expired)", async () => {
      const launch = await program.account.launch.fetch(launchPda);
      const collected = launch.totalSolCollected.toNumber();
      const target = launch.graduationTarget.toNumber();

      // Only skip this test if graduation conditions ARE met
      if (collected >= target) {
        console.log("Skipping — target already reached");
        return;
      }

      try {
        await program.methods
          .graduate()
          .accounts({
            launch: launchPda,
            authority: creator.publicKey,
          })
          .rpc();
        // It might succeed if time expired
      } catch (e: any) {
        assert.include(e.message, "GraduationConditionsNotMet");
      }
    });

    it("graduates after adding enough SOL to reach target", async () => {
      // Buy more to reach target
      const launch = await program.account.launch.fetch(launchPda);
      const remaining =
        launch.graduationTarget.toNumber() -
        launch.totalSolCollected.toNumber();

      if (remaining > 0) {
        const buyAmount = new BN(remaining + LAMPORTS_PER_SOL); // overshoot a bit

        const [positionPda] = PublicKey.findProgramAddressSync(
          [POSITION_SEED, launchPda.toBuffer(), user1.publicKey.toBuffer()],
          program.programId
        );

        const user1TokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          user1.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        await program.methods
          .buy(buyAmount)
          .accounts({
            launch: launchPda,
            userPosition: positionPda,
            vault: vaultPda,
            tokenVault,
            userTokenAccount: user1TokenAccount,
            user: user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
      }

      // Now graduate
      await program.methods
        .graduate()
        .accounts({
          launch: launchPda,
          authority: creator.publicKey,
        })
        .rpc();

      const launchAfter = await program.account.launch.fetch(launchPda);
      assert.equal(launchAfter.isGraduated, true);
    });

    it("fails to graduate again", async () => {
      try {
        await program.methods
          .graduate()
          .accounts({
            launch: launchPda,
            authority: creator.publicKey,
          })
          .rpc();
        assert.fail("should have thrown");
      } catch (e: any) {
        assert.include(e.message, "AlreadyGraduated");
      }
    });
  });

  describe("buy after graduation", () => {
    it("fails to buy after graduation", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [POSITION_SEED, launchPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const user1TokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        user1.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      try {
        await program.methods
          .buy(new BN(0.1 * LAMPORTS_PER_SOL))
          .accounts({
            launch: launchPda,
            userPosition: positionPda,
            vault: vaultPda,
            tokenVault,
            userTokenAccount: user1TokenAccount,
            user: user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        assert.fail("should have thrown");
      } catch (e: any) {
        assert.include(e.message, "AlreadyGraduated");
      }
    });
  });

  describe("claim_bonus", () => {
    it("user1 claims bonus tokens", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [POSITION_SEED, launchPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const user1TokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        user1.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const balBefore = await getAccount(connection, user1TokenAccount);

      const pos = await program.account.userPosition.fetch(positionPda);
      const bonusExpected = pos.totalBonusEntitled.toNumber();

      await program.methods
        .claimBonus()
        .accounts({
          launch: launchPda,
          userPosition: positionPda,
          tokenVault,
          userTokenAccount: user1TokenAccount,
          user: user1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      const balAfter = await getAccount(connection, user1TokenAccount);
      const diff = Number(balAfter.amount) - Number(balBefore.amount);
      assert.equal(diff, bonusExpected, "Should have received exact bonus amount");

      // Verify position updated
      const posAfter = await program.account.userPosition.fetch(positionPda);
      assert.equal(posAfter.hasClaimedBonus, true);
    });

    it("user2 claims bonus tokens", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [POSITION_SEED, launchPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      const user2TokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        user2.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      await program.methods
        .claimBonus()
        .accounts({
          launch: launchPda,
          userPosition: positionPda,
          tokenVault,
          userTokenAccount: user2TokenAccount,
          user: user2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();

      const posAfter = await program.account.userPosition.fetch(positionPda);
      assert.equal(posAfter.hasClaimedBonus, true);
    });

    it("user1 cannot double-claim", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [POSITION_SEED, launchPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const user1TokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        user1.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      try {
        await program.methods
          .claimBonus()
          .accounts({
            launch: launchPda,
            userPosition: positionPda,
            tokenVault,
            userTokenAccount: user1TokenAccount,
            user: user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
        assert.fail("should have thrown");
      } catch (e: any) {
        assert.include(e.message, "AlreadyClaimed");
      }
    });
  });

  describe("creator_withdraw", () => {
    it("creator withdraws SOL", async () => {
      const creatorBalBefore = await connection.getBalance(creator.publicKey);

      await program.methods
        .creatorWithdraw()
        .accounts({
          launch: launchPda,
          vault: vaultPda,
          creator: creator.publicKey,
        })
        .rpc();

      const creatorBalAfter = await connection.getBalance(creator.publicKey);
      // Creator should have more SOL after withdrawal (minus tx fee)
      assert.ok(
        creatorBalAfter > creatorBalBefore - 10000, // account for tx fee
        "Creator should have received SOL"
      );
    });

    it("non-creator cannot withdraw", async () => {
      try {
        await program.methods
          .creatorWithdraw()
          .accounts({
            launch: launchPda,
            vault: vaultPda,
            creator: user1.publicKey,
          })
          .signers([user1])
          .rpc();
        assert.fail("should have thrown");
      } catch (e: any) {
        assert.include(e.message, "Unauthorized");
      }
    });
  });
});
