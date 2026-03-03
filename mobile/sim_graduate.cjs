const { Connection, PublicKey, Transaction, ComputeBudgetProgram, Keypair, SYSVAR_RENT_PUBKEY, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } = require('@solana/spl-token');
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
  // has 0.6 SOL collected, graduation target 0.5 SOL, not graduated
  const LAUNCH_PDA = new PublicKey('AZJTj58zjCmUQPDsqC47t1H2EZWUigYzfNdiNVzd9JJi');

  const launchAccInfo = await conn.getAccountInfo(LAUNCH_PDA);
  const launch = coder.accounts.decode('Launch', launchAccInfo.data);

  const payer = launch.creator;
  const tokenMint = launch.token_mint;
  const [vaultPda] = deriveVaultPda(LAUNCH_PDA);
  const vaultInfo = await conn.getAccountInfo(vaultPda);

  console.log('Launch:', LAUNCH_PDA.toBase58());
  console.log('Creator (payer):', payer.toBase58());
  console.log('Token mint:', tokenMint.toBase58());
  console.log('Vault:', vaultPda.toBase58(), 'lamports:', vaultInfo ? vaultInfo.lamports : 'NOT FOUND');
  console.log('is_graduated:', launch.is_graduated, '| pool_created:', launch.pool_created);
  console.log('total_sol_collected:', typeof launch.total_sol_collected === 'object' ? launch.total_sol_collected.toNumber() : launch.total_sol_collected);

  const tokenVault = getAssociatedTokenAddressSync(tokenMint, LAUNCH_PDA, true);
  const tokenVaultInfo = await conn.getAccountInfo(tokenVault);
  console.log('Token vault:', tokenVault.toBase58(), 'exists:', !!tokenVaultInfo);

  const { authority, poolState, lpMint, token0Vault, token1Vault, observationState } =
    deriveRaydiumCpmmAccounts(tokenMint, RAYDIUM_DEVNET_AMM_CONFIG);

  const payerWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, payer, false);
  const payerTokenAta = getAssociatedTokenAddressSync(tokenMint, payer, false);
  const payerLpAta = getAssociatedTokenAddressSync(lpMint, payer, false);

  console.log('\n--- Account addresses ---');
  console.log('AMM Config:', RAYDIUM_DEVNET_AMM_CONFIG.toBase58());
  console.log('CPMM Authority:', authority.toBase58());
  console.log('Pool State:', poolState.toBase58());
  console.log('LP Mint:', lpMint.toBase58());
  console.log('Token0 Vault:', token0Vault.toBase58());
  console.log('Token1 Vault:', token1Vault.toBase58());
  console.log('Observation State:', observationState.toBase58());
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
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, payerWsolAta, payer, WSOL_MINT));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, payerTokenAta, payer, tokenMint));

  const ix = await program.methods
    .graduateToDex()
    .accounts({
      launch: LAUNCH_PDA,
      vault: vaultPda,
      tokenVault,
      tokenMint,
      payer,
      payerWsolAccount: payerWsolAta,
      payerTokenAccount: payerTokenAta,
      cpmmProgram: RAYDIUM_CPMM_PROGRAM_ID,
      ammConfig: RAYDIUM_DEVNET_AMM_CONFIG,
      cpmmAuthority: authority,
      poolState,
      wsolMint: WSOL_MINT,
      lpMint,
      payerLpAccount: payerLpAta,
      token0Vault,
      token1Vault,
      createPoolFee: RAYDIUM_DEVNET_CREATE_POOL_FEE,
      observationState,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  tx.add(ix);

  const { blockhash } = await conn.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  console.log('\n=== Simulating graduate_to_dex ===');
  const result = await conn.simulateTransaction(tx, undefined, true);
  const logs = result.value.logs ?? [];

  console.log('Error:', JSON.stringify(result.value.err, null, 2));
  console.log('\n=== ALL Logs ===');
  logs.forEach((l, i) => console.log(i, l));
}

main().catch(console.error);
