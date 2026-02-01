"use client";

import React from "react";

interface VestigeLogoProps {
  /** Size in pixels (width and height) */
  size?: number;
  /** Use "light" on dark backgrounds (e.g. sidebar), "dark" on light backgrounds */
  variant?: "light" | "dark";
  className?: string;
}

/**
 * Vestige logo: stylized V with integrated lock.
 * Light = white (for #1D04E1 sidebar). Dark = indigo (for light backgrounds).
 */
export default function VestigeLogo({
  size = 40,
  variant = "light",
  className = "",
}: VestigeLogoProps) {
  const isLight = variant === "light";
  const color = isLight ? "#FFFFFF" : "#1D04E1";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Bold V */}
      <path
        d="M10 10 L24 38 L38 10"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Lock: shackle */}
      <path
        d="M24 22 L24 22 C27.3 22 30 24.7 30 28 L30 34 C30 36.2 28.2 38 26 38 L22 38 C19.8 38 18 36.2 18 34 L18 28 C18 24.7 20.7 22 24 22 Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Lock: keyhole dot */}
      <circle cx="24" cy="31" r="2.5" fill={color} />
    </svg>
  );
}
