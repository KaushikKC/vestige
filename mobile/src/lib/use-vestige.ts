import { useCallback, useRef } from 'react';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
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
import { RPC_ENDPOINT, fetchWithRetry } from '../constants/solana';

// ============== Shared cache (module-level, shared across all hook instances) ==============

const CACHE_TTL = 15_000; // 15 seconds

let _launchCache: LaunchData[] = [];
let _launchCacheTime = 0;
let _launchInflight: Promise<LaunchData[]> | null = null;

// Shared singleton connection + client
let _sharedConnection: Connection | null = null;
let _sharedClient: VestigeClient | null = null;

function getSharedConnection(): Connection {
  if (!_sharedConnection) {
    _sharedConnection = new Connection(RPC_ENDPOINT, {
      commitment: 'confirmed',
      fetch: fetchWithRetry,
    });
  }
  return _sharedConnection;
}

function getSharedClient(): VestigeClient {
  if (!_sharedClient) {
    _sharedClient = new VestigeClient(getSharedConnection());
  }
  return _sharedClient;
}

/**
 * Cached + deduplicated getAllLaunches.
 * - Returns cached data if less than CACHE_TTL old.
 * - If a fetch is already in flight, returns the same promise (dedup).
 * - force=true bypasses the cache (used after creating a launch).
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

  _launchInflight = getSharedClient()
    .getAllLaunches()
    .then((data) => {
      _launchCache = data;
      _launchCacheTime = Date.now();
      return data;
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
