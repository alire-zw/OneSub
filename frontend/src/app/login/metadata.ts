import type { Metadata } from "next";
import { generatePageMetadata } from "@/utils/metadata";

export const metadata: Metadata = generatePageMetadata({
  title: "ورود",
  description: "ورود به حساب کاربری وان‌ساب",
  noIndex: true,
});
