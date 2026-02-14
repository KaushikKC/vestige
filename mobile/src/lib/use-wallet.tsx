// This file serves as the default/fallback and iOS implementation.
// On Android, Metro resolves use-wallet.android.tsx instead.
// On iOS, this file is used directly.

export { PrivyWalletProvider as WalletProvider, useWallet } from './use-wallet-privy';
