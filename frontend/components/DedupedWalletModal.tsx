"use client";

/**
 * Wallet modal that deduplicates wallets by adapter name before rendering.
 * Fixes "Encountered two children with the same key" when wallet-standard
 * and adapters both expose the same wallet (e.g. MetaMask) under the same name.
 * Uses same CSS classes as @solana/wallet-adapter-react-ui so styles apply.
 */
import type { WalletName } from "@solana/wallet-adapter-base";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import type { Wallet } from "@solana/wallet-adapter-react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { FC, MouseEvent } from "react";
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  useWalletModal,
  WalletModalContext,
} from "@solana/wallet-adapter-react-ui";
import type { ReactNode } from "react";

export interface DedupedWalletModalProps {
  className?: string;
  container?: string;
}

function dedupeWalletsByName(wallets: Wallet[]): Wallet[] {
  const seen = new Set<string>();
  return wallets.filter((w) => {
    const name = w.adapter.name;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

function WalletListItemRow({
  wallet,
  onClick,
  tabIndex = 0,
}: {
  wallet: Wallet;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  tabIndex?: number;
}) {
  return (
    <li>
      <button
        className="wallet-adapter-button"
        onClick={onClick}
        tabIndex={tabIndex}
        type="button"
      >
        <i className="wallet-adapter-button-start-icon">
          <img
            src={wallet.adapter.icon}
            alt={`${wallet.adapter.name} icon`}
            width={24}
            height={24}
          />
        </i>
        {wallet.adapter.name}
        {wallet.readyState === WalletReadyState.Installed && (
          <span>Detected</span>
        )}
      </button>
    </li>
  );
}

function SimpleCollapse({
  expanded,
  id,
  children,
}: {
  expanded: boolean;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="wallet-adapter-collapse"
      id={id}
      role="region"
      style={{
        display: expanded ? "block" : "none",
      }}
    >
      {children}
    </div>
  );
}

export const DedupedWalletModal: FC<DedupedWalletModalProps> = ({
  className = "",
  container = "body",
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { wallets, select } = useWallet();
  const { setVisible } = useWalletModal();
  const [expanded, setExpanded] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [portal, setPortal] = useState<Element | null>(null);

  const [listedWallets, collapsedWallets] = useMemo(() => {
    const deduped = dedupeWalletsByName(wallets);
    const installed: Wallet[] = [];
    const notInstalled: Wallet[] = [];
    for (const wallet of deduped) {
      if (wallet.readyState === WalletReadyState.Installed) {
        installed.push(wallet);
      } else {
        notInstalled.push(wallet);
      }
    }
    return installed.length ? [installed, notInstalled] : [notInstalled, []];
  }, [wallets]);

  const hideModal = useCallback(() => {
    setFadeIn(false);
    setTimeout(() => setVisible(false), 150);
  }, [setVisible]);

  const handleClose = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      hideModal();
    },
    [hideModal],
  );

  const handleWalletClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, walletName: WalletName) => {
      select(walletName);
      hideModal();
    },
    [select, hideModal],
  );

  const handleCollapseClick = useCallback(
    () => setExpanded(!expanded),
    [expanded],
  );

  const handleTabKey = useCallback((event: KeyboardEvent) => {
    const node = ref.current;
    if (!node) return;
    const focusableElements = node.querySelectorAll("button");
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) return;
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }, []);

  useLayoutEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideModal();
      else if (event.key === "Tab") handleTabKey(event);
    };
    const { overflow } = window.getComputedStyle(document.body);
    setTimeout(() => setFadeIn(true), 0);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown, false);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleKeyDown, false);
    };
  }, [hideModal, handleTabKey]);

  useLayoutEffect(
    () => setPortal(document.querySelector(container)),
    [container],
  );

  if (!portal) return null;

  return createPortal(
    <div
      aria-labelledby="wallet-adapter-modal-title"
      aria-modal="true"
      className={`wallet-adapter-modal ${
        fadeIn ? "wallet-adapter-modal-fade-in" : ""
      } ${className}`}
      ref={ref}
      role="dialog"
    >
      <div className="wallet-adapter-modal-container">
        <div className="wallet-adapter-modal-wrapper">
          <button
            onClick={handleClose}
            className="wallet-adapter-modal-button-close"
            type="button"
          >
            <svg width="14" height="14">
              <path d="M14 12.461 8.3 6.772l5.234-5.233L12.006 0 6.772 5.234 1.54 0 0 1.539l5.234 5.233L0 12.006l1.539 1.528L6.772 8.3l5.69 5.7L14 12.461z" />
            </svg>
          </button>
          {listedWallets.length ? (
            <>
              <h1 className="wallet-adapter-modal-title">
                Connect a wallet on Solana to continue
              </h1>
              <ul className="wallet-adapter-modal-list">
                {listedWallets.map((wallet, i) => (
                  <WalletListItemRow
                    key={`${wallet.adapter.name}-${i}`}
                    wallet={wallet}
                    onClick={(e) => handleWalletClick(e, wallet.adapter.name)}
                  />
                ))}
                {collapsedWallets.length ? (
                  <SimpleCollapse
                    expanded={expanded}
                    id="wallet-adapter-modal-collapse"
                  >
                    {collapsedWallets.map((wallet, i) => (
                      <WalletListItemRow
                        key={`${wallet.adapter.name}-collapsed-${i}`}
                        wallet={wallet}
                        onClick={(e) =>
                          handleWalletClick(e, wallet.adapter.name)
                        }
                        tabIndex={expanded ? 0 : -1}
                      />
                    ))}
                  </SimpleCollapse>
                ) : null}
              </ul>
              {collapsedWallets.length ? (
                <button
                  className="wallet-adapter-modal-list-more"
                  onClick={handleCollapseClick}
                  tabIndex={0}
                  type="button"
                >
                  <span>{expanded ? "Less " : "More "}options</span>
                  <svg
                    width="13"
                    height="7"
                    viewBox="0 0 13 7"
                    xmlns="http://www.w3.org/2000/svg"
                    className={
                      expanded
                        ? "wallet-adapter-modal-list-more-icon-rotate"
                        : ""
                    }
                  >
                    <path d="M0.71418 1.626L5.83323 6.26188C5.91574 6.33657 6.0181 6.39652 6.13327 6.43762C6.24844 6.47872 6.37371 6.5 6.50048 6.5C6.62725 6.5 6.75252 6.47872 6.8677 6.43762C6.98287 6.39652 7.08523 6.33657 7.16774 6.26188L12.2868 1.626C12.7753 1.1835 12.3703 0.5 11.6195 0.5H1.37997C0.629216 0.5 0.224175 1.1835 0.71418 1.626Z" />
                  </svg>
                </button>
              ) : null}
            </>
          ) : (
            <>
              <h1 className="wallet-adapter-modal-title">
                You&apos;ll need a wallet on Solana to continue
              </h1>
              <div className="wallet-adapter-modal-middle">
                <svg
                  width="97"
                  height="96"
                  viewBox="0 0 97 96"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="48.5"
                    cy="48"
                    r="48"
                    fill="url(#paint0_linear)"
                    fillOpacity="0.1"
                  />
                  <circle
                    cx="48.5"
                    cy="48"
                    r="47"
                    stroke="url(#paint1_linear)"
                    strokeOpacity="0.4"
                    strokeWidth="2"
                  />
                  <defs>
                    <linearGradient
                      id="paint0_linear"
                      x1="3.42"
                      y1="98.09"
                      x2="103.05"
                      y2="8.42"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#9945FF" />
                      <stop offset="1" stopColor="#00D18C" />
                    </linearGradient>
                    <linearGradient
                      id="paint1_linear"
                      x1="3.42"
                      y1="98.09"
                      x2="103.05"
                      y2="8.42"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#9945FF" />
                      <stop offset="1" stopColor="#00D18C" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              {collapsedWallets.length ? (
                <>
                  <button
                    className="wallet-adapter-modal-list-more"
                    onClick={handleCollapseClick}
                    tabIndex={0}
                    type="button"
                  >
                    <span>
                      {expanded ? "Hide " : "Already have a wallet? View "}
                      options
                    </span>
                    <svg
                      width="13"
                      height="7"
                      viewBox="0 0 13 7"
                      xmlns="http://www.w3.org/2000/svg"
                      className={
                        expanded
                          ? "wallet-adapter-modal-list-more-icon-rotate"
                          : ""
                      }
                    >
                      <path d="M0.71418 1.626L5.83323 6.26188C5.91574 6.33657 6.0181 6.39652 6.13327 6.43762C6.24844 6.47872 6.37371 6.5 6.50048 6.5C6.62725 6.5 6.75252 6.47872 6.8677 6.43762C6.98287 6.39652 7.08523 6.33657 7.16774 6.26188L12.2868 1.626C12.7753 1.1835 12.3703 0.5 11.6195 0.5H1.37997C0.629216 0.5 0.224175 1.1835 0.71418 1.626Z" />
                    </svg>
                  </button>
                  <SimpleCollapse
                    expanded={expanded}
                    id="wallet-adapter-modal-collapse"
                  >
                    <ul className="wallet-adapter-modal-list">
                      {collapsedWallets.map((wallet, i) => (
                        <WalletListItemRow
                          key={`${wallet.adapter.name}-no-installed-${i}`}
                          wallet={wallet}
                          onClick={(e) =>
                            handleWalletClick(e, wallet.adapter.name)
                          }
                          tabIndex={expanded ? 0 : -1}
                        />
                      ))}
                    </ul>
                  </SimpleCollapse>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
      <div
        className="wallet-adapter-modal-overlay"
        onMouseDown={handleClose}
        role="presentation"
      />
    </div>,
    portal,
  );
};

/**
 * Provider that renders DedupedWalletModal instead of the default WalletModal,
 * fixing duplicate key warnings when multiple adapters share the same name (e.g. MetaMask).
 */
export function DedupedWalletModalProvider({
  children,
  className,
  container,
}: DedupedWalletModalProps & { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <WalletModalContext.Provider value={{ visible, setVisible }}>
      {children}
      {visible && (
        <DedupedWalletModal className={className} container={container} />
      )}
    </WalletModalContext.Provider>
  );
}
