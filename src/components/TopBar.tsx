// components/TopBar.tsx
"use client";

import React, { ReactNode, CSSProperties } from "react";
import clsx from "clsx";

type TopBarProps = {
  title?: string;
  PageIcon?: ReactNode; // e.g. <CalendarIcon className="w-6 h-6" />
  RightSideActions?: ReactNode; // e.g. your buttons group
  className?: string;
  style?: CSSProperties; // override background, etc.
};

export default function TopBar({
  title = "Untitled",
  PageIcon = null,
  RightSideActions = null,
  className,
  style,
}: TopBarProps) {
  return (
    <header
      className={clsx("sticky top-0 z-50 text-white", className)}
      style={{ backgroundColor: "#0472B4", ...style }}
    >
      <div className="mx-auto max-w-full p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/theone.png"
            className="inset-0 -z-10 object-cover mix-blend-multiply"
            style={{ width: "32px", height: "32px" }}
          />
          {PageIcon ? <span className="shrink-0">{PageIcon}</span> : null}
          <h1 className="text-xl md:text-2xl font-semibold truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">{RightSideActions}</div>
      </div>
    </header>
  );
}
