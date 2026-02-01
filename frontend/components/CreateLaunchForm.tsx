"use client";

import { useState } from 'react';
import { Keypair, SystemProgram, PublicKey, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { createInitializeMint2Instruction, TOKEN_PROGRAM_ID, MINT_SIZE, getMinimumBalanceForRentExemptMint } from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVestige } from '@/lib/use-vestige';
import { VestigeClient } from '@/lib/vestige-client';
import { Loader2, Rocket } from 'lucide-react';

export default function CreateLaunchForm() {
  const { client, publicKey, connected } = useVestige();
  const wallet = useWallet();
  const [creating, setCreating] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    tokenSupply: '1000000',
    graduationTarget: '100',
    minCommitment: '0.1',
    maxCommitment: '10',
    durationMinutes: '1440', // 24 hours in minutes
  });
  const [testMode, setTestMode] = useState(false);

  // Quick test mode settings (3 minute duration, low targets)
  const applyTestMode = (enabled: boolean) => {
    setTestMode(enabled);
    if (enabled) {
      setFormData({
        tokenSupply: '1000',
        graduationTarget: '0.5', // 0.5 SOL target (easy to reach)
        minCommitment: '0.1',
        maxCommitment: '1',
        durationMinutes: '3', // 3 minutes for testing
      });
    } else {
      setFormData({
        tokenSupply: '1000000',
        graduationTarget: '100',
        minCommitment: '0.1',
        maxCommitment: '10',
        durationMinutes: '1440', // 24 hours
      });
    }
  };

  const handleCreate = async () => {
    if (!client || !publicKey) {
      alert('Please connect your wallet');
      return;
    }

    setCreating(true);
    try {
      console.log('Creating SPL token mint...');
      
      const connection = (client as any).connection;
      const mintKeypair = Keypair.generate();
      
      // Get rent exemption amount for mint
      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      
      // Create transaction to initialize mint
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(
          mintKeypair.publicKey,
          6,  // decimals
          publicKey,  // mint authority
          publicKey,  // freeze authority
          TOKEN_PROGRAM_ID
        )
      );
      
      // Send and sign transaction
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      // Sign with both wallet and mint keypair
      const signedTx = await wallet.signTransaction!(transaction);
      signedTx.partialSign(mintKeypair);
      
      const mintTxSig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(mintTxSig, 'confirmed');
      
      const tokenMint = mintKeypair.publicKey;
      console.log('✅ Token mint created:', tokenMint.toBase58());

      // Wait a bit for the transaction to fully settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Derive launch PDA
      const [launchPda] = VestigeClient.deriveLaunchPda(publicKey, tokenMint);
      console.log('📝 Creating launch at PDA:', launchPda.toBase58());

      // Calculate times (must be BN for i64)
      const now = Math.floor(Date.now() / 1000);
      const durationSeconds = parseInt(formData.durationMinutes) * 60; // minutes to seconds
      const startTime = new BN(now);
      const endTime = new BN(now + durationSeconds);

      console.log(`⏱️ Launch duration: ${formData.durationMinutes} minutes (${durationSeconds} seconds)`);

      // Convert to proper units (BN for u64)
      const tokenSupply = VestigeClient.solToLamports(parseFloat(formData.tokenSupply));
      const graduationTarget = VestigeClient.solToLamports(parseFloat(formData.graduationTarget));
      const minCommitment = VestigeClient.solToLamports(parseFloat(formData.minCommitment));
      const maxCommitment = VestigeClient.solToLamports(parseFloat(formData.maxCommitment));

      // Call initialize_launch
      const program = (client as any).program;
      const [commitmentPoolPda] = VestigeClient.deriveCommitmentPoolPda(launchPda);
      const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

      const tx = await program.methods
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
          tokenMint: tokenMint,
          creator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: true });

      console.log('✅ Launch created! Transaction:', tx);
      setTxSignature(tx);
      
      alert(`🎉 Launch Created Successfully!\n\nLaunch PDA: ${launchPda.toBase58()}\nToken Mint: ${tokenMint.toBase58()}\n\nYou can now delegate to MagicBlock ER!`);
    } catch (error: any) {
      console.error('Launch creation failed:', error);
      alert(`Failed to create launch: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (!connected) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#E6E8EF] text-center">
        <p className="text-[#6B7280]">Connect your wallet to create a launch</p>
      </div>
    );
  }

  if (txSignature) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#E6E8EF] text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Rocket size={32} className="text-green-600" />
        </div>
        <h3 className="text-2xl font-bold mb-4">Launch Created! 🎉</h3>
        <p className="text-sm text-[#6B7280] mb-4">
          Your launch has been deployed to Solana
        </p>
        <a
          href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3A2BFF] hover:underline text-sm"
        >
          View Transaction →
        </a>
        <button
          onClick={() => {
            setTxSignature(null);
            setTestMode(false);
            setFormData({
              tokenSupply: '1000000',
              graduationTarget: '100',
              minCommitment: '0.1',
              maxCommitment: '10',
              durationMinutes: '1440',
            });
          }}
          className="mt-6 w-full py-3 bg-[#F5F6FA] rounded-xl font-bold hover:bg-[#E6E8EF]"
        >
          Create Another Launch
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#E6E8EF]">
      <h2 className="text-2xl font-bold mb-6">Create New Launch</h2>

      {/* Quick Test Mode Toggle */}
      <div className="mb-6 p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={testMode}
            onChange={(e) => applyTestMode(e.target.checked)}
            className="w-5 h-5 rounded border-2 border-yellow-400 accent-yellow-500"
          />
          <div>
            <span className="font-bold text-yellow-800">🧪 Quick Test Mode</span>
            <p className="text-xs text-yellow-600 mt-1">
              3-minute duration, 0.5 SOL target - perfect for demo!
            </p>
          </div>
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-[#6B7280] mb-2">
            Token Supply
          </label>
          <input
            type="number"
            value={formData.tokenSupply}
            onChange={(e) => setFormData({ ...formData, tokenSupply: e.target.value })}
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
            placeholder="1000000"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-[#6B7280] mb-2">
            Graduation Target (SOL)
          </label>
          <input
            type="number"
            value={formData.graduationTarget}
            onChange={(e) => setFormData({ ...formData, graduationTarget: e.target.value })}
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
            placeholder="100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-[#6B7280] mb-2">
              Min Commitment (SOL)
            </label>
            <input
              type="number"
              value={formData.minCommitment}
              onChange={(e) => setFormData({ ...formData, minCommitment: e.target.value })}
              className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
              placeholder="0.1"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#6B7280] mb-2">
              Max Commitment (SOL)
            </label>
            <input
              type="number"
              value={formData.maxCommitment}
              onChange={(e) => setFormData({ ...formData, maxCommitment: e.target.value })}
              className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
              placeholder="10"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-[#6B7280] mb-2">
            Duration (Minutes)
          </label>
          <input
            type="number"
            value={formData.durationMinutes}
            onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
            placeholder="1440"
          />
          <p className="text-xs text-[#6B7280] mt-1">
            {parseInt(formData.durationMinutes) >= 60
              ? `≈ ${(parseInt(formData.durationMinutes) / 60).toFixed(1)} hours`
              : `${formData.durationMinutes} minutes`}
          </p>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-4 bg-[#C8FF2E] hover:bg-[#bce62b] text-[#0B0D17] font-bold rounded-xl transition-all border-2 border-[#09090A] flex items-center justify-center gap-2 disabled:bg-gray-300"
        >
          {creating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Creating Launch...
            </>
          ) : (
            <>
              <Rocket size={20} />
              Create Launch
            </>
          )}
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-xl text-sm text-[#6B7280]">
        <strong>Note:</strong> After creating, you can delegate to MagicBlock ER for private commitments!
      </div>
    </div>
  );
}
