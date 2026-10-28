import type { Tone } from "@/components/ui";

// Badge tones. The dairy design is black and white only: tones are drawn as grayscale weights in components/ui.tsx.
export const ORDER_TONE: Record<string, Tone> = { OPEN: "blue", COMPLETED: "green", CANCELLED: "gray" };
export const MOVE_TONE: Record<string, Tone> = { PRODUCTION: "green", USE: "gray", INPUT: "green", OUTPUT: "amber", BUY: "blue", SELL: "purple" };
