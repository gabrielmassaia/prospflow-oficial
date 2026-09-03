"use client";

import dynamic from "next/dynamic";

export const FunilContent = dynamic(
  () => import("./FunilContent").then((mod) => mod.FunilContent),
  { ssr: false }
);
