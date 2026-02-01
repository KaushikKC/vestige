"use client";

import { useState } from "react";
import {
  Keypair,
  SystemProgram,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  createInitializeMint2Instruction,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVestige } from "@/lib/use-vestige";
import { VestigeClient } from "@/lib/vestige-client";
import { Loader2, Rocket, ExternalLink, Copy } from "lucide-react";
import toast from "react-hot-toast";

interface CreateLaunchFormProps {
  /** Called with launch PDA when user wants to go to launch detail (e.g. after creation) */
  onGoToLaunch?: (launchPda: string) => void;
}

export default function CreateLaunchForm({
  onGoToLaunch,
}: CreateLaunchFormProps) {
  const { client, publicKey, connected } = useVestige();
  const wallet = useWallet();
  const [creating, setCreating] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [launchPdaCreated, setLaunchPdaCreated] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    tokenSupply: "1000000",
    graduationTarget: "100",
    minCommitment: "0.1",
    maxCommitment: "10",
    durationMinutes: "1440", // 24 hours in minutes
  });
  const [testMode, setTestMode] = useState(false);

  // Quick test mode settings (3 minute duration, low targets)
  const applyTestMode = (enabled: boolean) => {
    setTestMode(enabled);
    if (enabled) {
      setFormData({
        tokenSupply: "1000",
        graduationTarget: "0.5", // 0.5 SOL target (easy to reach)
        minCommitment: "0.1",
        maxCommitment: "1",
        durationMinutes: "3", // 3 minutes for testing
      });
    } else {
      setFormData({
        tokenSupply: "1000000",
        graduationTarget: "100",
        minCommitment: "0.1",
        maxCommitment: "10",
        durationMinutes: "1440", // 24 hours
      });
    }
  };

  const handleCreate = async () => {
    if (!client || !publicKey) {
      toast.error("Connect your wallet first.");
      return;
    }

    setCreating(true);
    try {
      console.log("Creating SPL token mint...");

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
          6, // decimals
          publicKey, // mint authority
          publicKey, // freeze authority
          TOKEN_PROGRAM_ID,
        ),
      );

      // Send and sign transaction
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign with both wallet and mint keypair
      const signedTx = await wallet.signTransaction!(transaction);
      signedTx.partialSign(mintKeypair);

      const mintTxSig = await connection.sendRawTransaction(
        signedTx.serialize(),
      );
      await connection.confirmTransaction(mintTxSig, "confirmed");

      const tokenMint = mintKeypair.publicKey;
      console.log("✅ Token mint created:", tokenMint.toBase58());

      // Wait a bit for the transaction to fully settle
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Derive launch PDA
      const [launchPda] = VestigeClient.deriveLaunchPda(publicKey, tokenMint);
      console.log("📝 Creating launch at PDA:", launchPda.toBase58());

      // Calculate times (must be BN for i64)
      const now = Math.floor(Date.now() / 1000);
      const durationSeconds = parseInt(formData.durationMinutes) * 60; // minutes to seconds
      const startTime = new BN(now);
      const endTime = new BN(now + durationSeconds);

      console.log(
        `⏱️ Launch duration: ${formData.durationMinutes} minutes (${durationSeconds} seconds)`,
      );

      // Convert to proper units (BN for u64)
      const tokenSupply = VestigeClient.solToLamports(
        parseFloat(formData.tokenSupply),
      );
      const graduationTarget = VestigeClient.solToLamports(
        parseFloat(formData.graduationTarget),
      );
      const minCommitment = VestigeClient.solToLamports(
        parseFloat(formData.minCommitment),
      );
      const maxCommitment = VestigeClient.solToLamports(
        parseFloat(formData.maxCommitment),
      );

      // Call initialize_launch
      const program = (client as any).program;
      const [commitmentPoolPda] =
        VestigeClient.deriveCommitmentPoolPda(launchPda);
      const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

      const tx = await program.methods
        .initializeLaunch(
          tokenSupply,
          startTime,
          endTime,
          graduationTarget,
          minCommitment,
          maxCommitment,
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

      console.log("✅ Launch created! Transaction:", tx);
      setTxSignature(tx);
      setLaunchPdaCreated(launchPda.toBase58());

      toast.success("Launch created. You can now enable private mode.");
    } catch (error: unknown) {
      console.error("Launch creation failed:", error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Launch failed: ${msg}`);
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

  const copyPda = () => {
    if (!launchPdaCreated) return;
    navigator.clipboard.writeText(launchPdaCreated);
    toast.success("Launch PDA copied to clipboard");
  };

  if (txSignature && launchPdaCreated) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#E6E8EF] text-center">
        <div className="w-16 h-16 bg-[#F5F6FA] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#E6E8EF]">
          <Rocket size={32} className="text-[#3A2BFF]" />
        </div>
        <h3 className="text-2xl font-bold mb-4 text-[#0B0D17]">
          Launch Created
        </h3>
        <p className="text-sm text-[#6B7280] mb-4">
          Your launch has been deployed to Solana
        </p>

        {/* Launch PDA - visible in UI for demo */}
        <div className="mb-4 p-4 bg-[#F5F6FA] rounded-xl border border-[#E6E8EF] text-left">
          <p className="text-xs font-bold text-[#6B7280] mb-2 uppercase tracking-wide">
            Launch PDA (use this to open or share your launch)
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm text-[#0B0D17] break-all font-mono flex-1 min-w-0">
              {launchPdaCreated}
            </code>
            <button
              type="button"
              onClick={copyPda}
              className="shrink-0 p-2 rounded-lg bg-white border border-[#E6E8EF] hover:bg-[#E6E8EF] text-[#6B7280]"
              title="Copy PDA"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onGoToLaunch && (
            <button
              onClick={() => onGoToLaunch(launchPdaCreated)}
              className="py-3 px-6 bg-[#3A2BFF] text-white rounded-xl font-bold hover:bg-[#2A1BDF] flex items-center justify-center gap-2"
            >
              <ExternalLink size={18} />
              Open launch page
            </button>
          )}
          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 px-6 border-2 border-[#E6E8EF] rounded-xl font-bold text-[#0B0D17] hover:bg-[#F5F6FA] inline-flex items-center justify-center gap-2"
          >
            View transaction on Explorer
          </a>
        </div>

        <button
          onClick={() => {
            setTxSignature(null);
            setLaunchPdaCreated(null);
            setTestMode(false);
            setFormData({
              tokenSupply: "1000000",
              graduationTarget: "100",
              minCommitment: "0.1",
              maxCommitment: "10",
              durationMinutes: "1440",
            });
          }}
          className="mt-6 w-full py-3 bg-[#F5F6FA] rounded-xl font-bold hover:bg-[#E6E8EF] text-[#6B7280]"
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
      <div className="mb-6 p-4 bg-[#F5F6FA] rounded-xl border-2 border-[#E6E8EF]">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={testMode}
            onChange={(e) => applyTestMode(e.target.checked)}
            className="w-5 h-5 rounded border-2 border-[#E6E8EF] accent-[#3A2BFF]"
          />
          <div>
            <span className="font-bold text-[#0B0D17]">Quick Test Mode</span>
            <p className="text-xs text-[#6B7280] mt-1">
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
            onChange={(e) =>
              setFormData({ ...formData, tokenSupply: e.target.value })
            }
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
            onChange={(e) =>
              setFormData({ ...formData, graduationTarget: e.target.value })
            }
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
              onChange={(e) =>
                setFormData({ ...formData, minCommitment: e.target.value })
              }
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
              onChange={(e) =>
                setFormData({ ...formData, maxCommitment: e.target.value })
              }
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
            onChange={(e) =>
              setFormData({ ...formData, durationMinutes: e.target.value })
            }
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
            placeholder="1440"
          />
          <p className="text-xs text-[#6B7280] mt-1">
            {parseInt(formData.durationMinutes) >= 60
              ? `≈ ${(parseInt(formData.durationMinutes) / 60).toFixed(
                  1,
                )} hours`
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
        <strong>Note:</strong> After creating, you can delegate to MagicBlock ER
        for private commitments!
      </div>
    </div>
  );
}
