import { useCallback } from 'react';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from './use-wallet';
import {
  VestigeClient,
  LaunchData,
  UserPositionData,
} from './vestige-client';
import {
  buildBuyTx,
  buildSellTx,
  buildGraduateTx,
  buildClaimBonusTx,
  buildCreatorClaimFeesTx,
  buildAdvanceMilestoneTx,
  buildInitializeLaunchTx,
} from './vestige-transactions';
import { RPC_ENDPOINT, CONNECTION_CONFIG } from '../constants/solana';

// ============== Shared singleton (module-level) ==============

let _sharedConnection: Connection | null = null;
let _sharedClient: VestigeClient | null = null;

function getSharedConnection(): Connection {
  if (!_sharedConnection) {
    _sharedConnection = new Connection(RPC_ENDPOINT, CONNECTION_CONFIG);
  }
  return _sharedConnection;
}

function getSharedClient(): VestigeClient {
  if (!_sharedClient) {
    _sharedClient = new VestigeClient(getSharedConnection());
  }
  return _sharedClient;
}

// ============== Launch PDA persistence ==============
// Stores known launch PDAs in AsyncStorage so we don't need getProgramAccounts
// to display launches. Individual getAccountInfo calls are much cheaper.

const STORAGE_KEY = 'vestige_known_launch_pdas';

async function loadKnownPdas(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveKnownPdas(pdas: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pdas));
  } catch {
    // ignore storage errors
  }
}

async function addKnownPda(pda: string): Promise<void> {
  const existing = await loadKnownPdas();
  if (!existing.includes(pda)) {
    existing.push(pda);
    await saveKnownPdas(existing);
  }
}

// ============== Cache ==============

const CACHE_TTL = 30_000; // 30 seconds

let _launchCache: LaunchData[] = [];
let _launchCacheTime = 0;
let _launchInflight: Promise<LaunchData[]> | null = null;

/**
 * Fetches launches using a two-tier strategy:
 *
 * 1. FAST PATH (always): Fetch known PDAs from AsyncStorage, then fetch each
 *    individually via getAccountInfo (cheap, ~1 RPC call per account, batched).
 *
 * 2. SLOW PATH (background, when forced): Also run getProgramAccounts to
 *    discover new launches from other users. Merge results and save new PDAs.
 */
async function cachedGetAllLaunches(force = false): Promise<LaunchData[]> {
  const now = Date.now();

  // Return cache if fresh
  if (!force && _launchCache.length > 0 && now - _launchCacheTime < CACHE_TTL) {
    return _launchCache;
  }

  // Deduplicate in-flight requests
  if (_launchInflight) {
    return _launchInflight;
  }

  _launchInflight = (async () => {
    const client = getSharedClient();
    const knownPdas = await loadKnownPdas();
    console.log(`[Vestige] Known PDAs in storage: ${knownPdas.length}`);

    // FAST PATH: fetch known launches individually (cheap getAccountInfo calls)
    const knownLaunches: LaunchData[] = [];
    if (knownPdas.length > 0) {
      // Fetch in parallel batches of 5
      const BATCH = 5;
      for (let i = 0; i < knownPdas.length; i += BATCH) {
        const batch = knownPdas.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((pda) => client.getLaunch(new PublicKey(pda)))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            knownLaunches.push(r.value);
          }
        }
      }
      console.log(`[Vestige] Fetched ${knownLaunches.length}/${knownPdas.length} known launches`);
    }

    // If we have known launches, update cache immediately so screens can display
    if (knownLaunches.length > 0) {
      _launchCache = knownLaunches;
      _launchCacheTime = Date.now();
    }

    // SLOW PATH: try getProgramAccounts to discover new launches
    // Only do this if forced (pull-to-refresh) or we have no known PDAs
    if (force || knownPdas.length === 0) {
      try {
        const allLaunches = await client.getAllLaunches();
        console.log(`[Vestige] getProgramAccounts found ${allLaunches.length} total launches`);

        // Merge: use getProgramAccounts results as the authoritative list
        if (allLaunches.length > 0) {
          _launchCache = allLaunches;
          _launchCacheTime = Date.now();

          // Save all discovered PDAs for future fast-path fetches
          const allPdaStrs = allLaunches.map((l) => l.publicKey.toBase58());
          await saveKnownPdas(allPdaStrs);
        }
      } catch (err: any) {
        console.warn(`[Vestige] getProgramAccounts failed: ${err?.message}`);
        // Fall through — we already have knownLaunches from fast path
      }
    }

    return _launchCache;
  })()
    .catch((err) => {
      console.warn(`[Vestige] Launch fetch failed entirely: ${err?.message}`);
      return _launchCache; // return whatever stale data we have
    })
    .finally(() => {
      _launchInflight = null;
    });

  return _launchInflight;
}

/** Invalidate the launch cache (call after creating/modifying a launch) */
export function invalidateLaunchCache() {
  _launchCacheTime = 0;
}

// ============== Hook ==============

export function useVestige() {
  const { publicKey, signAndSendTransaction } = useWallet();

  const getConnection = useCallback(() => getSharedConnection(), []);
  const getClient = useCallback(() => getSharedClient(), []);

  // ============== Read Operations ==============

  const getAllLaunches = useCallback(
    async (force = false): Promise<LaunchData[]> => {
      return cachedGetAllLaunches(force);
    },
    []
  );

  const getLaunch = useCallback(
    async (launchPda: PublicKey): Promise<LaunchData | null> => {
      return getClient().getLaunch(launchPda);
    },
    [getClient]
  );

  const getUserPosition = useCallback(
    async (
      launchPda: PublicKey,
      user: PublicKey
    ): Promise<UserPositionData | null> => {
      return getClient().getUserPosition(launchPda, user);
    },
    [getClient]
  );

  const getBalance = useCallback(
    async (wallet: PublicKey): Promise<number> => {
      return getClient().getBalance(wallet);
    },
    [getClient]
  );

  // ============== Write Operations ==============

  const buy = useCallback(
    async (launchPda: PublicKey, launch: LaunchData, solAmount: number) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const connection = getConnection();
      const client = getClient();
      const lamports = VestigeClient.solToLamports(solAmount);

      const tokenVault = getAssociatedTokenAddressSync(
        launch.tokenMint,
        launchPda,
        true
      );
      const userTokenAccount = getAssociatedTokenAddressSync(
        launch.tokenMint,
        publicKey
      );

      const tx = await buildBuyTx(
        client.program,
        connection,
        launchPda,
        lamports,
        publicKey,
        tokenVault,
        userTokenAccount,
        launch.tokenMint
      );

      const signature = await signAndSendTransaction(tx);
      invalidateLaunchCache();
      return signature;
    },
    [publicKey, getConnection, getClient, signAndSendTransaction]
  );

  const graduate = useCallback(
    async (launchPda: PublicKey) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const connection = getConnection();
      const client = getClient();

      const tx = await buildGraduateTx(
        client.program,
        connection,
        launchPda,
        publicKey
      );

      const signature = await signAndSendTransaction(tx);
      invalidateLaunchCache();
      return signature;
    },
    [publicKey, getConnection, getClient, signAndSendTransaction]
  );

  const claimBonus = useCallback(
    async (launchPda: PublicKey, launch: LaunchData) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const connection = getConnection();
      const client = getClient();

      const tokenVault = getAssociatedTokenAddressSync(
        launch.tokenMint,
        launchPda,
        true
      );
      const userTokenAccount = getAssociatedTokenAddressSync(
        launch.tokenMint,
        publicKey
      );

      const tx = await buildClaimBonusTx(
        client.program,
        connection,
        launchPda,
        publicKey,
        tokenVault,
        userTokenAccount
      );

      const signature = await signAndSendTransaction(tx);
      return signature;
    },
    [publicKey, getConnection, getClient, signAndSendTransaction]
  );

  const creatorClaimFees = useCallback(
    async (launchPda: PublicKey) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const connection = getConnection();
      const client = getClient();

      const tx = await buildCreatorClaimFeesTx(
        client.program,
        connection,
        launchPda,
        publicKey
      );

      const signature = await signAndSendTransaction(tx);
      return signature;
    },
    [publicKey, getConnection, getClient, signAndSendTransaction]
  );

  const advanceMilestone = useCallback(
    async (launchPda: PublicKey) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const connection = getConnection();
      const client = getClient();

      const tx = await buildAdvanceMilestoneTx(
        client.program,
        connection,
        launchPda,
        publicKey
      );

      const signature = await signAndSendTransaction(tx);
      invalidateLaunchCache();
      return signature;
    },
    [publicKey, getConnection, getClient, signAndSendTransaction]
  );

  const sell = useCallback(
    async (launchPda: PublicKey, launch: LaunchData, tokenAmount: number) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const connection = getConnection();
      const client = getClient();
      const amount = new BN(tokenAmount);

      const tokenVault = getAssociatedTokenAddressSync(
        launch.tokenMint,
        launchPda,
        true
      );
      const userTokenAccount = getAssociatedTokenAddressSync(
        launch.tokenMint,
        publicKey
      );

      const tx = await buildSellTx(
        client.program,
        connection,
        launchPda,
        amount,
        publicKey,
        tokenVault,
        userTokenAccount,
      );

      const signature = await signAndSendTransaction(tx);
      invalidateLaunchCache();
      return signature;
    },
    [publicKey, getConnection, getClient, signAndSendTransaction]
  );

  const initializeLaunch = useCallback(
    async (
      mintKeypair: Keypair,
      tokenSupply: BN,
      bonusPool: BN,
      startTime: BN,
      endTime: BN,
      pMax: BN,
      pMin: BN,
      rBest: BN,
      rMin: BN,
      graduationTarget: BN,
      name: string,
      symbol: string,
      uri: string,
    ) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const connection = getConnection();
      const client = getClient();

      const tx = await buildInitializeLaunchTx(
        client.program,
        connection,
        mintKeypair,
        publicKey,
        tokenSupply,
        bonusPool,
        startTime,
        endTime,
        pMax,
        pMin,
        rBest,
        rMin,
        graduationTarget,
        name,
        symbol,
        uri,
      );

      const signature = await signAndSendTransaction(tx, [mintKeypair]);

      // Immediately persist the new launch PDA so it shows up in Discovery
      const [launchPda] = VestigeClient.deriveLaunchPda(
        publicKey,
        mintKeypair.publicKey
      );
      await addKnownPda(launchPda.toBase58());
      invalidateLaunchCache();

      return signature;
    },
    [publicKey, getConnection, getClient, signAndSendTransaction]
  );

  return {
    // Read
    getAllLaunches,
    getLaunch,
    getUserPosition,
    getBalance,
    // Write
    buy,
    sell,
    graduate,
    claimBonus,
    creatorClaimFees,
    advanceMilestone,
    initializeLaunch,
    // Helpers
    client: getClient(),
  };
}
