"use client";

import Script from "next/script";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function RazorpayScript() {
  return <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />;
}
