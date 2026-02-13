import { useCallback, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
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
  buildGraduateTx,
  buildClaimBonusTx,
  buildCreatorClaimFeesTx,
  buildAdvanceMilestoneTx,
  buildInitializeLaunchTx,
} from './vestige-transactions';
import { RPC_ENDPOINT } from '../constants/solana';

export function useVestige() {
  const { publicKey, signAndSendTransaction } = useWallet();
  const clientRef = useRef<VestigeClient | null>(null);
  const connectionRef = useRef<Connection | null>(null);

  const getConnection = useCallback(() => {
    if (!connectionRef.current) {
      connectionRef.current = new Connection(RPC_ENDPOINT, 'confirmed');
    }
    return connectionRef.current;
  }, []);

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new VestigeClient(getConnection());
    }
    return clientRef.current;
  }, [getConnection]);

  // ============== Read Operations ==============

  const getAllLaunches = useCallback(async (): Promise<LaunchData[]> => {
    return getClient().getAllLaunches();
  }, [getClient]);

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
        userTokenAccount
      );

      const signature = await signAndSendTransaction(tx);
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
      return signature;
    },
    [publicKey, getConnection, getClient, signAndSendTransaction]
  );

  const initializeLaunch = useCallback(
    async (
      tokenMint: PublicKey,
      tokenSupply: BN,
      bonusPool: BN,
      startTime: BN,
      endTime: BN,
      pMax: BN,
      pMin: BN,
      rBest: BN,
      rMin: BN,
      graduationTarget: BN
    ) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const connection = getConnection();
      const client = getClient();

      const tx = await buildInitializeLaunchTx(
        client.program,
        connection,
        tokenMint,
        publicKey,
        tokenSupply,
        bonusPool,
        startTime,
        endTime,
        pMax,
        pMin,
        rBest,
        rMin,
        graduationTarget
      );

      const signature = await signAndSendTransaction(tx);
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
    graduate,
    claimBonus,
    creatorClaimFees,
    advanceMilestone,
    initializeLaunch,
    // Helpers
    client: getClient(),
  };
}
