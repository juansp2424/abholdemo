import { randomInt } from "node:crypto";
import { CODE_ALPHABET, CODE_LENGTH } from "@abholdemo/shared";

/** Returns an integer in [0, max). Injectable for tests. */
export type RandomInt = (max: number) => number;

export const cryptoRandomInt: RandomInt = (max) => randomInt(max);

/** Random order code; regenerates until `exists` says the code is free. */
export function generateCode(
  rng: RandomInt = cryptoRandomInt,
  exists: (code: string) => boolean = () => false,
): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[rng(CODE_ALPHABET.length)];
    if (!exists(code)) return code;
  }
  throw new Error("Could not generate a free order code");
}
