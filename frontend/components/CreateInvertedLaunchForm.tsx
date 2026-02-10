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
import { VestigeClient, PRICE_RATIO, WEIGHT_SCALE } from "@/lib/vestige-client";
import { Loader2, ExternalLink, Copy } from "lucide-react";
import toast from "react-hot-toast";

interface CreateInvertedLaunchFormProps {
  onGoToLaunch?: (launchPda: string) => void;
}

export default function CreateInvertedLaunchForm({
  onGoToLaunch,
}: CreateInvertedLaunchFormProps) {
  const { client, publicKey, connected } = useVestige();
  const wallet = useWallet();
  const [creating, setCreating] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [launchPdaCreated, setLaunchPdaCreated] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    bondedSupply: "1000000",
    durationMinutes: "1440",
    pMax: "1", // SOL — p_min auto-calculated as pMax / PRICE_RATIO
    rBest: "150000", // 15x weight
    rMin: "10000", // 1x weight (= WEIGHT_SCALE)
    graduationTarget: "100", // SOL
  });
  const [testMode, setTestMode] = useState(false);

  const applyTestMode = (enabled: boolean) => {
    setTestMode(enabled);
    if (enabled) {
      setFormData({
        bondedSupply: "10000",
        durationMinutes: "3",
        pMax: "1",
        rBest: "150000",
        rMin: "10000",
        graduationTarget: "0.5",
      });
    } else {
      setFormData({
        bondedSupply: "1000000",
        durationMinutes: "1440",
        pMax: "1",
        rBest: "150000",
        rMin: "10000",
        graduationTarget: "100",
      });
    }
  };

  const pMin = parseFloat(formData.pMax) / PRICE_RATIO;

  const handleCreate = async () => {
    if (!client || !publicKey) {
      toast.error("Connect your wallet first.");
      return;
    }

    setCreating(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          6,
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID,
        ),
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signedTx = await wallet.signTransaction!(transaction);
      signedTx.partialSign(mintKeypair);

      const mintTxSig = await connection.sendRawTransaction(
        signedTx.serialize(),
      );
      await connection.confirmTransaction(mintTxSig, "confirmed");

      const tokenMint = mintKeypair.publicKey;
      console.log("Token mint created:", tokenMint.toBase58());
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Derive inverted launch PDA
      const [invertedLaunchPda] = VestigeClient.deriveInvertedLaunchPda(
        publicKey,
        tokenMint,
      );
      const [bondedPoolPda] =
        VestigeClient.deriveBondedPoolPda(invertedLaunchPda);
      const [invertedVaultPda] =
        VestigeClient.deriveInvertedVaultPda(invertedLaunchPda);

      // Calculate params
      const now = Math.floor(Date.now() / 1000);
      const durationSeconds = parseInt(formData.durationMinutes) * 60;
      const startTime = new BN(now);
      const endTime = new BN(now + durationSeconds);

      const bondedSupplyRaw = Math.floor(
        parseFloat(formData.bondedSupply) * 1e6,
      );
      const bondedSupply = new BN(bondedSupplyRaw);
      const pMaxLamports = VestigeClient.solToLamports(
        parseFloat(formData.pMax),
      );
      const pMinLamports = VestigeClient.solToLamports(pMin);
      const rBest = new BN(parseInt(formData.rBest));
      const rMin = new BN(parseInt(formData.rMin));
      const graduationTarget = VestigeClient.solToLamports(
        parseFloat(formData.graduationTarget),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const program = (client as any).program;

      const tx = await program.methods
        .initializeInvertedLaunch(
          bondedSupply,
          startTime,
          endTime,
          pMaxLamports,
          pMinLamports,
          rBest,
          rMin,
          graduationTarget,
        )
        .accounts({
          invertedLaunch: invertedLaunchPda,
          bondedPool: bondedPoolPda,
          invertedVault: invertedVaultPda,
          tokenMint: tokenMint,
          creator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: true });

      console.log("Inverted launch created:", tx);

      // Create ATA for the inverted launch PDA and mint tokens to it
      const launchTokenVault = getAssociatedTokenAddressSync(
        tokenMint,
        invertedLaunchPda,
        true, // allowOwnerOffCurve for PDA
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const vaultTx = new Transaction();
      const existingVault = await connection.getAccountInfo(launchTokenVault);
      if (!existingVault) {
        vaultTx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            launchTokenVault,
            invertedLaunchPda,
            tokenMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }
      vaultTx.add(
        createMintToInstruction(
          tokenMint,
          launchTokenVault,
          publicKey,
          bondedSupplyRaw,
          [],
          TOKEN_PROGRAM_ID,
        ),
      );
      const { blockhash: blockhash2 } = await connection.getLatestBlockhash();
      vaultTx.recentBlockhash = blockhash2;
      vaultTx.feePayer = publicKey;
      const signedVault = await wallet.signTransaction!(vaultTx);
      const vaultTxSig = await connection.sendRawTransaction(
        signedVault.serialize(),
      );
      await connection.confirmTransaction(vaultTxSig, "confirmed");
      console.log("Token vault created and supply minted:", vaultTxSig);

      setTxSignature(tx);
      setLaunchPdaCreated(invertedLaunchPda.toBase58());

      toast.success("Inverted launch created!");
    } catch (error: unknown) {
      console.error("Inverted launch creation failed:", error);
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
          Connect your wallet to create an inverted launch
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
          Inverted Launch Created
        </h3>
        <p className="text-sm text-[#6B7280] mb-4">
          Your inverted launch has been deployed to Solana
        </p>

        <div className="mb-4 p-4 bg-[#F5F6FA] rounded-xl border border-[#E6E8EF] text-left">
          <p className="text-xs font-bold text-[#6B7280] mb-2 uppercase tracking-wide">
            Inverted Launch PDA
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
              bondedSupply: "1000000",
              durationMinutes: "1440",
              pMax: "1",
              rBest: "150000",
              rMin: "10000",
              graduationTarget: "100",
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
      <h2 className="text-2xl font-bold mb-2">Create Inverted Launch</h2>
      <p className="text-sm text-[#6B7280] mb-6">
        Price starts high and drops over time. Early buyers get higher risk-weight multipliers.
      </p>

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
              3-minute duration, 0.5 SOL target
            </p>
          </div>
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-[#6B7280] mb-2">
            Bonded Supply (tokens)
          </label>
          <input
            type="number"
            value={formData.bondedSupply}
            onChange={(e) =>
              setFormData({ ...formData, bondedSupply: e.target.value })
            }
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
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
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
          />
          <p className="text-xs text-[#6B7280] mt-1">
            {parseInt(formData.durationMinutes) >= 60
              ? `${(parseInt(formData.durationMinutes) / 60).toFixed(1)} hours`
              : `${formData.durationMinutes} minutes`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-[#6B7280] mb-2">
              Starting Price (SOL)
            </label>
            <input
              type="number"
              value={formData.pMax}
              onChange={(e) =>
                setFormData({ ...formData, pMax: e.target.value })
              }
              className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#6B7280] mb-2">
              Ending Price (SOL)
            </label>
            <input
              type="number"
              value={pMin.toFixed(4)}
              readOnly
              className="w-full px-4 py-3 bg-[#E6E8EF] border border-[#E6E8EF] rounded-xl text-[#6B7280] cursor-not-allowed"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Auto: Starting Price / {PRICE_RATIO}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-[#6B7280] mb-2">
              Best Risk Weight
            </label>
            <input
              type="number"
              value={formData.rBest}
              onChange={(e) =>
                setFormData({ ...formData, rBest: e.target.value })
              }
              className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              {(parseInt(formData.rBest) / WEIGHT_SCALE).toFixed(1)}x multiplier (early buyers)
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#6B7280] mb-2">
              Min Risk Weight
            </label>
            <input
              type="number"
              value={formData.rMin}
              onChange={(e) =>
                setFormData({ ...formData, rMin: e.target.value })
              }
              className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              {(parseInt(formData.rMin) / WEIGHT_SCALE).toFixed(1)}x multiplier (late buyers)
            </p>
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
            className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-4 bg-[#C8FF2E] hover:bg-[#bce62b] text-[#0B0D17] font-bold rounded-xl transition-all border-2 border-[#09090A] flex items-center justify-center gap-2 disabled:bg-gray-300"
        >
          {creating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Creating Inverted Launch...
            </>
          ) : (
            "Create Inverted Launch"
          )}
        </button>
      </div>

      <div className="mt-6 p-4 bg-purple-50 rounded-xl text-sm text-[#6B7280]">
        <strong>How it works:</strong> Price starts at {formData.pMax} SOL and
        drops to {pMin.toFixed(4)} SOL. Early buyers get a{" "}
        {(parseInt(formData.rBest) / WEIGHT_SCALE).toFixed(1)}x risk-weight
        multiplier on their tokens at graduation.
      </div>
    </div>
  );
}
