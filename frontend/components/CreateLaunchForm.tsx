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
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVestige } from "@/lib/use-vestige";
import { VestigeClient } from "@/lib/vestige-client";
import { Loader2, ExternalLink, Copy } from "lucide-react";
import toast from "react-hot-toast";

interface CreateLaunchFormProps {
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
    bonusPool: "500000",
    pMax: "1",
    rBest: "15",
    rMin: "1",
    graduationTarget: "10",
    durationMinutes: "1440",
  });
  const [testMode, setTestMode] = useState(false);

  // Derived from pMax
  const pMinDisplay = formData.pMax
    ? (parseFloat(formData.pMax) / 10).toString()
    : "0";

  const applyTestMode = (enabled: boolean) => {
    setTestMode(enabled);
    if (enabled) {
      setFormData({
        tokenSupply: "1000",
        bonusPool: "500",
        pMax: "1",
        rBest: "15",
        rMin: "1",
        graduationTarget: "0.5",
        durationMinutes: "3",
      });
    } else {
      setFormData({
        tokenSupply: "1000000",
        bonusPool: "500000",
        pMax: "1",
        rBest: "15",
        rMin: "1",
        graduationTarget: "10",
        durationMinutes: "1440",
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
      const connection = (client as any).connection;
      const mintKeypair = Keypair.generate();

      // Create SPL token mint
      const lamports = await getMinimumBalanceForRentExemptMint(connection);
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
          9, // 9 decimals to match TOKEN_PRECISION
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      const signedTx = await wallet.signTransaction!(transaction);
      signedTx.partialSign(mintKeypair);
      const mintTxSig = await connection.sendRawTransaction(
        signedTx.serialize()
      );
      await connection.confirmTransaction(mintTxSig, "confirmed");
      const tokenMint = mintKeypair.publicKey;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Derive launch PDA
      const [launchPda] = VestigeClient.deriveLaunchPda(publicKey, tokenMint);

      // Compute params
      const now = Math.floor(Date.now() / 1000);
      const durationSeconds = parseInt(formData.durationMinutes) * 60;
      const startTime = new BN(now);
      const endTime = new BN(now + durationSeconds);

      // Token amounts (raw, 9 decimals matching TOKEN_PRECISION)
      const tokenSupplyRaw = Math.floor(
        parseFloat(formData.tokenSupply) * 1e9
      );
      const bonusPoolRaw = Math.floor(parseFloat(formData.bonusPool) * 1e9);
      const tokenSupply = new BN(tokenSupplyRaw);
      const bonusPool = new BN(bonusPoolRaw);

      // Price in lamports: pMax SOL * 1e9
      const pMaxLamports = VestigeClient.solToLamports(
        parseFloat(formData.pMax)
      );
      const pMinLamports = VestigeClient.solToLamports(
        parseFloat(formData.pMax) / 10
      );

      const rBest = new BN(parseInt(formData.rBest));
      const rMin = new BN(parseInt(formData.rMin));
      const graduationTarget = VestigeClient.solToLamports(
        parseFloat(formData.graduationTarget)
      );

      // Initialize launch
      const program = (client as any).program;
      const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

      const tx = await program.methods
        .initializeLaunch(
          tokenSupply,
          bonusPool,
          startTime,
          endTime,
          pMaxLamports,
          pMinLamports,
          rBest,
          rMin,
          graduationTarget
        )
        .accounts({
          launch: launchPda,
          vault: vaultPda,
          tokenMint: tokenMint,
          creator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: true });

      await connection.confirmTransaction(tx, "confirmed");

      // Create ATA for Launch PDA (token vault) and mint supply + bonus
      const launchTokenVault = getAssociatedTokenAddressSync(
        tokenMint,
        launchPda,
        true, // allowOwnerOffCurve - PDA owner
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const totalMint = tokenSupplyRaw + bonusPoolRaw;

      const vaultTx = new Transaction();
      const existingVault = await connection.getAccountInfo(launchTokenVault);
      if (!existingVault) {
        vaultTx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            launchTokenVault,
            launchPda,
            tokenMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }
      vaultTx.add(
        createMintToInstruction(
          tokenMint,
          launchTokenVault,
          publicKey,
          totalMint,
          [],
          TOKEN_PROGRAM_ID
        )
      );
      const { blockhash: bh2 } = await connection.getLatestBlockhash();
      vaultTx.recentBlockhash = bh2;
      vaultTx.feePayer = publicKey;
      const signedVault = await wallet.signTransaction!(vaultTx);
      const vaultTxSig = await connection.sendRawTransaction(
        signedVault.serialize()
      );
      await connection.confirmTransaction(vaultTxSig, "confirmed");

      setTxSignature(tx);
      setLaunchPdaCreated(launchPda.toBase58());
      toast.success("Launch created successfully!");
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
        <p className="text-[#6B7280]">
          Connect your wallet to create a launch
        </p>
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
        <h3 className="text-2xl font-bold mb-4 text-[#0B0D17]">
          Launch Created
        </h3>
        <p className="text-sm text-[#6B7280] mb-4">
          Your inverted bonding curve launch has been deployed to Solana.
        </p>

        <div className="mb-4 p-4 bg-[#F5F6FA] rounded-xl border border-[#E6E8EF] text-left">
          <p className="text-xs font-bold text-[#6B7280] mb-2 uppercase tracking-wide">
            Launch PDA
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
              className="py-3 px-6 bg-[#1D04E1] text-white rounded-xl font-bold hover:bg-[#1603C0] flex items-center justify-center gap-2"
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
            View transaction
          </a>
        </div>

        <button
          onClick={() => {
            setTxSignature(null);
            setLaunchPdaCreated(null);
            setTestMode(false);
            setFormData({
              tokenSupply: "1000000",
              bonusPool: "500000",
              pMax: "1",
              rBest: "15",
              rMin: "1",
              graduationTarget: "10",
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
      <h2 className="text-2xl font-bold mb-6">New Inverted Curve Launch</h2>

      <div className="mb-6 p-4 bg-[#F5F6FA] rounded-xl border-2 border-[#E6E8EF]">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={testMode}
            onChange={(e) => applyTestMode(e.target.checked)}
            className="w-5 h-5 rounded border-2 border-[#E6E8EF] accent-[#1D04E1]"
          />
          <div>
            <span className="font-bold text-[#0B0D17]">Quick Test Mode</span>
            <p className="text-xs text-[#6B7280] mt-1">
              3-minute duration, 0.5 SOL target, small supply
            </p>
          </div>
        </label>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
              className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#1D04E1] outline-none"
              placeholder="1000000"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#6B7280] mb-2">
              Bonus Pool
            </label>
            <input
              type="number"
              value={formData.bonusPool}
              onChange={(e) =>
                setFormData({ ...formData, bonusPool: e.target.value })
              }
              className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#1D04E1] outline-none"
              placeholder="500000"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Reserved for graduation bonus distribution
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-[#6B7280] mb-2">
            Starting Price (SOL) &mdash; p_max
          </label>
          <input
            type="number"
            value={formData.pMax}
            onChange={(e) =>
              setFormData({ ...formData, pMax: e.target.value })
            }
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#1D04E1] outline-none"
            placeholder="1"
            step="0.01"
          />
          <p className="text-xs text-[#6B7280] mt-1">
            Price drops from {formData.pMax || "?"} SOL to {pMinDisplay} SOL
            (10:1 ratio)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-[#6B7280] mb-2">
              Risk Weight Best (r_best)
            </label>
            <input
              type="number"
              value={formData.rBest}
              onChange={(e) =>
                setFormData({ ...formData, rBest: e.target.value })
              }
              className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#1D04E1] outline-none"
              placeholder="15"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Must be &gt; 10 (price ratio)
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#6B7280] mb-2">
              Risk Weight Min (r_min)
            </label>
            <input
              type="number"
              value={formData.rMin}
              onChange={(e) =>
                setFormData({ ...formData, rMin: e.target.value })
              }
              className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#1D04E1] outline-none"
              placeholder="1"
            />
          </div>
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
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#1D04E1] outline-none"
            placeholder="10"
          />
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
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#1D04E1] outline-none"
            placeholder="1440"
          />
          <p className="text-xs text-[#6B7280] mt-1">
            {parseInt(formData.durationMinutes) >= 60
              ? `= ${(parseInt(formData.durationMinutes) / 60).toFixed(
                  1
                )} hours`
              : `${formData.durationMinutes} minutes`}
          </p>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-4 bg-[#CFEA4D] hover:bg-[#DFFF5E] text-[#0B0D17] font-bold rounded-xl transition-all border-2 border-[#09090A] flex items-center justify-center gap-2 disabled:bg-gray-300"
        >
          {creating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Creating Launch...
            </>
          ) : (
            "Create Launch"
          )}
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-xl text-sm text-[#6B7280]">
        <strong>How it works:</strong> Price drops from p_max to p_min over the
        duration. Early buyers pay more but earn a higher risk weight, giving
        them bonus tokens at graduation. Real tokens are delivered immediately on
        buy.
      </div>
    </div>
  );
}
