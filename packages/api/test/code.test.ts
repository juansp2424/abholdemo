import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, CODE_LENGTH, CODE_REGEX } from "@abholdemo/shared";
import { generateCode } from "../src/code.js";
import { createOrder, makeEnv } from "./helpers.js";

describe("order code", () => {
  it("has 6 chars from the alphabet without 0 O 1 I L", () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).toMatch(CODE_REGEX);
      expect(code).not.toMatch(/[01OIL]/);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it("does not collide in a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateCode(undefined, (c) => seen.has(c)));
    expect(seen.size).toBe(5000);
  });

  it("is not sequential", () => {
    const codes = Array.from({ length: 1000 }, () => generateCode());
    let ascending = 0;
    for (let i = 1; i < codes.length; i++) if (codes[i] > codes[i - 1]) ascending++;
    expect(ascending).toBeGreaterThan(300);
    expect(ascending).toBeLessThan(700);
  });

  it("regenerates on a forced collision (injected random)", () => {
    const picks = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
    let i = 0;
    const rng = () => picks[i++];
    const existing = new Set([CODE_ALPHABET[0].repeat(6)]);
    const asked: string[] = [];
    const code = generateCode(rng, (c) => (asked.push(c), existing.has(c)));
    expect(asked).toEqual([CODE_ALPHABET[0].repeat(6), CODE_ALPHABET[1].repeat(6)]);
    expect(code).toBe(CODE_ALPHABET[1].repeat(6));
  });

  it("api never hands out the code of an existing order", async () => {
    const idx = (s: string) => [...s].map((c) => CODE_ALPHABET.indexOf(c));
    const picks = [...idx("H7RT3K"), ...idx("AAAAAA")]; // H7RT3K is a seed code
    let i = 0;
    const env = makeEnv({ random: () => picks[i++] });
    const token = await env.token();
    const order = await createOrder(env, token);
    expect(order.code).toBe("AAAAAA");
  });
});
