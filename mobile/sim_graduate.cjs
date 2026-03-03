const { Connection, PublicKey, Transaction, ComputeBudgetProgram, Keypair, SYSVAR_RENT_PUBKEY, SystemProgram, TransactionInstruction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction } = require('@solana/spl-token');
const anchor = require('@coral-xyz/anchor');
const { AnchorProvider, Program, BorshCoder } = anchor;
const fs = require('fs');

const RPC = 'https://api.devnet.solana.com';
const conn = new Connection(RPC, { commitment: 'confirmed', disableRetryOnRateLimit: true });

const IDL = JSON.parse(fs.readFileSync('./src/lib/vestige.json', 'utf8'));
const PROGRAM_ID = new PublicKey('4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf');
const coder = new BorshCoder(IDL);

const RAYDIUM_CPMM_PROGRAM_ID = new PublicKey('DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const RAYDIUM_DEVNET_CREATE_POOL_FEE = new PublicKey('3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy');

const indexBuf = Buffer.alloc(2);
indexBuf.writeUInt16LE(0);
const [RAYDIUM_DEVNET_AMM_CONFIG] = PublicKey.findProgramAddressSync(
  [Buffer.from('amm_config'), indexBuf],
  RAYDIUM_CPMM_PROGRAM_ID
);

function deriveRaydiumCpmmAccounts(tokenMint, ammConfig) {
  const [token0Mint, token1Mint] = Buffer.compare(WSOL_MINT.toBuffer(), tokenMint.toBuffer()) < 0
    ? [WSOL_MINT, tokenMint]
    : [tokenMint, WSOL_MINT];

  const [authority] = PublicKey.findProgramAddressSync([Buffer.from('vault_and_lp_mint_auth_seed')], RAYDIUM_CPMM_PROGRAM_ID);
  const [poolState] = PublicKey.findProgramAddressSync([Buffer.from('pool'), ammConfig.toBuffer(), token0Mint.toBuffer(), token1Mint.toBuffer()], RAYDIUM_CPMM_PROGRAM_ID);
  const [lpMint] = PublicKey.findProgramAddressSync([Buffer.from('pool_lp_mint'), poolState.toBuffer()], RAYDIUM_CPMM_PROGRAM_ID);
  const [token0Vault] = PublicKey.findProgramAddressSync([Buffer.from('pool_vault'), poolState.toBuffer(), token0Mint.toBuffer()], RAYDIUM_CPMM_PROGRAM_ID);
  const [token1Vault] = PublicKey.findProgramAddressSync([Buffer.from('pool_vault'), poolState.toBuffer(), token1Mint.toBuffer()], RAYDIUM_CPMM_PROGRAM_ID);
  const [observationState] = PublicKey.findProgramAddressSync([Buffer.from('observation'), poolState.toBuffer()], RAYDIUM_CPMM_PROGRAM_ID);
  return { token0Mint, token1Mint, authority, poolState, lpMint, token0Vault, token1Vault, observationState };
}

function deriveVaultPda(launchPda) {
  return PublicKey.findProgramAddressSync([Buffer.from('vault'), launchPda.toBuffer()], PROGRAM_ID);
}

// sha256("global:initialize")[0..8]
const RAYDIUM_CPMM_INIT_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

function buildRaydiumCpmmInitializeIx(
  payer, ammConfig, authority, poolState,
  token0Mint, token1Mint, lpMint,
  creatorToken0, creatorToken1, creatorLpToken,
  token0Vault, token1Vault, createPoolFee, observationState,
  initAmount0, initAmount1,
) {
  const data = Buffer.alloc(8 + 8 + 8 + 8);
  RAYDIUM_CPMM_INIT_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(BigInt(initAmount0), 8);
  data.writeBigUInt64LE(BigInt(initAmount1), 16);
  data.writeBigUInt64LE(0n, 24); // open_time = 0

  return new TransactionInstruction({
    programId: RAYDIUM_CPMM_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ammConfig, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: false, isWritable: false },
      { pubkey: poolState, isSigner: false, isWritable: true },
      { pubkey: token0Mint, isSigner: false, isWritable: false },
      { pubkey: token1Mint, isSigner: false, isWritable: false },
      { pubkey: lpMint, isSigner: false, isWritable: true },
      { pubkey: creatorToken0, isSigner: false, isWritable: true },
      { pubkey: creatorToken1, isSigner: false, isWritable: true },
      { pubkey: creatorLpToken, isSigner: false, isWritable: true },
      { pubkey: token0Vault, isSigner: false, isWritable: true },
      { pubkey: token1Vault, isSigner: false, isWritable: true },
      { pubkey: createPoolFee, isSigner: false, isWritable: true },
      { pubkey: observationState, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    data,
  });
}

async function main() {
  const dummyKeypair = Keypair.generate();
  const dummyWallet = {
    publicKey: dummyKeypair.publicKey,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
  const provider = new AnchorProvider(conn, dummyWallet, { commitment: 'confirmed' });
  const program = new Program(IDL, provider);

  // Use the best known launch: AZJTj58zjCmUQPDsqC47t1H2EZWUigYzfNdiNVzd9JJi
  const LAUNCH_PDA = new PublicKey('AZJTj58zjCmUQPDsqC47t1H2EZWUigYzfNdiNVzd9JJi');

  const launchAccInfo = await conn.getAccountInfo(LAUNCH_PDA);
  const launch = coder.accounts.decode('Launch', launchAccInfo.data);

  const payer = launch.creator;
  const tokenMint = launch.token_mint;
  const totalBonusReserved = typeof launch.total_bonus_reserved === 'object'
    ? BigInt(launch.total_bonus_reserved.toString())
    : BigInt(launch.total_bonus_reserved);

  const [vaultPda] = deriveVaultPda(LAUNCH_PDA);
  const vaultInfo = await conn.getAccountInfo(vaultPda);
  const tokenVault = getAssociatedTokenAddressSync(tokenMint, LAUNCH_PDA, true);
  const tokenVaultBalance = await conn.getTokenAccountBalance(tokenVault);

  console.log('Launch:', LAUNCH_PDA.toBase58());
  console.log('Creator (payer):', payer.toBase58());
  console.log('Token mint:', tokenMint.toBase58());
  console.log('Vault:', vaultPda.toBase58(), 'lamports:', vaultInfo ? vaultInfo.lamports : 'NOT FOUND');
  console.log('is_graduated:', launch.is_graduated, '| pool_created:', launch.pool_created);
  console.log('total_bonus_reserved:', totalBonusReserved.toString());
  console.log('Token vault balance:', tokenVaultBalance.value.amount);

  const rentExemptMin = await conn.getMinimumBalanceForRentExemption(0);
  const vaultLamports = BigInt(vaultInfo.lamports);
  const solForPool = vaultLamports - BigInt(rentExemptMin);
  const tokensForPool = BigInt(tokenVaultBalance.value.amount) - totalBonusReserved;

  console.log('\nsolForPool:', solForPool.toString(), 'lamports');
  console.log('tokensForPool:', tokensForPool.toString());

  const { token0Mint, token1Mint, authority, poolState, lpMint, token0Vault, token1Vault, observationState } =
    deriveRaydiumCpmmAccounts(tokenMint, RAYDIUM_DEVNET_AMM_CONFIG);

  const payerWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, payer, false);
  const payerTokenAta = getAssociatedTokenAddressSync(tokenMint, payer, false);
  const payerLpAta = getAssociatedTokenAddressSync(lpMint, payer, false);

  console.log('\n--- Account addresses ---');
  console.log('AMM Config:', RAYDIUM_DEVNET_AMM_CONFIG.toBase58());
  console.log('CPMM Authority:', authority.toBase58());
  console.log('Pool State:', poolState.toBase58());
  console.log('LP Mint:', lpMint.toBase58());
  console.log('Token0 Mint:', token0Mint.toBase58(), '(wSOL?', token0Mint.equals(WSOL_MINT), ')');
  console.log('Token1 Mint:', token1Mint.toBase58());
  console.log('Token0 Vault:', token0Vault.toBase58());
  console.log('Token1 Vault:', token1Vault.toBase58());
  console.log('Payer wSOL ATA:', payerWsolAta.toBase58());
  console.log('Payer Token ATA:', payerTokenAta.toBase58());
  console.log('Payer LP ATA:', payerLpAta.toBase58());

  // Check if pool already exists
  const poolInfo = await conn.getAccountInfo(poolState);
  console.log('\nPool already exists:', !!poolInfo);
  if (poolInfo) {
    console.log('Pool state lamports:', poolInfo.lamports);
    return;
  }

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }));

  // Pre-create ATAs idempotently
  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, payerWsolAta, payer, WSOL_MINT));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, payerTokenAta, payer, tokenMint));

  // Instruction 1: graduate_to_dex (simplified — releases SOL + tokens)
  const graduateIx = await program.methods
    .graduateToDex()
    .accounts({
      launch: LAUNCH_PDA,
      vault: vaultPda,
      tokenVault,
      payer,
      payerTokenAccount: payerTokenAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  tx.add(graduateIx);

  // Instruction 2: SystemProgram.transfer — wrap SOL to wSOL ATA
  tx.add(SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: payerWsolAta,
    lamports: solForPool,
  }));

  // Instruction 3: SyncNative — convert lamports to wSOL token balance
  tx.add(createSyncNativeInstruction(payerWsolAta));

  // Instruction 4: Raydium CPMM initialize
  const wsolIsToken0 = token0Mint.equals(WSOL_MINT);
  const initAmount0 = wsolIsToken0 ? solForPool : tokensForPool;
  const initAmount1 = wsolIsToken0 ? tokensForPool : solForPool;
  const creatorToken0 = wsolIsToken0 ? payerWsolAta : payerTokenAta;
  const creatorToken1 = wsolIsToken0 ? payerTokenAta : payerWsolAta;

  tx.add(buildRaydiumCpmmInitializeIx(
    payer, RAYDIUM_DEVNET_AMM_CONFIG, authority, poolState,
    token0Mint, token1Mint, lpMint,
    creatorToken0, creatorToken1, payerLpAta,
    token0Vault, token1Vault, RAYDIUM_DEVNET_CREATE_POOL_FEE, observationState,
    initAmount0, initAmount1,
  ));

  const { blockhash } = await conn.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  console.log('\n=== Simulating full graduation transaction ===');
  const result = await conn.simulateTransaction(tx, undefined, true);
  const logs = result.value.logs ?? [];

  console.log('Error:', JSON.stringify(result.value.err, null, 2));
  console.log('\n=== ALL Logs ===');
  logs.forEach((l, i) => console.log(i, l));
}

main().catch(console.error);
