import { describe, expect, it } from "vitest";
import { MANUAL_TRANSITIONS, ORDER_STATUSES } from "@abholdemo/shared";
import { createOrder, makeEnv, orderId, setStatus } from "./helpers.js";

describe("status transitions", () => {
  it("applies valid transitions and logs time and actor", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const staff = await env.token("mitarbeiter");
    const o = await createOrder(env, owner);
    expect(o.status).toBe("ANGENOMMEN");
    expect(o.log).toEqual([
      { at: new Date(env.time.value).toISOString(), from: null, to: "ANGENOMMEN", actorId: "u1", actorName: "Maria Leisten" },
    ]);
    env.time.value += 60_000;
    const r = await setStatus(env, staff, o.id, "IN_ARBEIT");
    expect(r.status).toBe(200);
    expect(r.json.status).toBe("IN_ARBEIT");
    expect(r.json.log).toHaveLength(2);
    expect(r.json.log[1]).toMatchObject({ from: "ANGENOMMEN", to: "IN_ARBEIT", actorId: "u2", actorName: "Tom Werner" });
    expect(r.json.log[1].at).toBe(new Date(env.time.value).toISOString());
    const done = await setStatus(env, owner, o.id, "ABHOLBEREIT");
    expect(done.json.readyAt).not.toBeNull();
    expect(done.json.allowedTransitions).toEqual(["ABGEHOLT", "STORNIERT"]);
    const picked = await setStatus(env, owner, o.id, "ABGEHOLT");
    expect(picked.json.pickedUpAt).not.toBeNull();
  });

  it("allows ANGENOMMEN directly to ABHOLBEREIT", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const o = await createOrder(env, owner);
    expect((await setStatus(env, owner, o.id, "ABHOLBEREIT")).status).toBe(200);
  });

  it("rejects every transition that is not in MANUAL_TRANSITIONS with 409", async () => {
    const env = makeEnv();
    const owner = await env.token();
    // one seed order per status: ANGENOMMEN H7RT3K, IN_ARBEIT C6VJ5T, ABHOLBEREIT D3FY6W, UEBERFAELLIG RT8WMZ, ABGEHOLT Z5MA9H, STORNIERT X2SP7N
    const byStatus = { ANGENOMMEN: "H7RT3K", IN_ARBEIT: "C6VJ5T", ABHOLBEREIT: "D3FY6W", UEBERFAELLIG: "RT8WMZ", ABGEHOLT: "Z5MA9H", STORNIERT: "X2SP7N" } as const;
    for (const from of ORDER_STATUSES) {
      const id = orderId(env, byStatus[from]);
      for (const to of ORDER_STATUSES) {
        if (MANUAL_TRANSITIONS[from].includes(to)) continue;
        const before = env.db().orders.find((o) => o.id === id)!.log.length;
        const r = await setStatus(env, owner, id, to);
        expect(r.status, `${from} to ${to}`).toBe(409);
        expect(r.json.error.code).toBe("INVALID_TRANSITION");
        expect(r.json.error.message).toBe("Dieser Statuswechsel ist nicht möglich.");
        expect(env.db().orders.find((o) => o.id === id)!.log.length).toBe(before);
      }
    }
  });

  it("final states stay final, unknown status is a validation error, unknown order is 404", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const o = await createOrder(env, owner);
    await setStatus(env, owner, o.id, "STORNIERT");
    expect((await setStatus(env, owner, o.id, "IN_ARBEIT")).status).toBe(409);
    expect((await setStatus(env, owner, o.id, "QUATSCH")).status).toBe(400);
    expect((await setStatus(env, owner, "o999", "IN_ARBEIT")).status).toBe(404);
  });

  it("UEBERFAELLIG can be left manually (picked up)", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const r = await setStatus(env, owner, orderId(env, "RT8WMZ"), "ABGEHOLT");
    expect(r.status).toBe(200);
  });
});

describe("order list", () => {
  it("filters and searches", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const list = async (qs: string) => (await env.api(owner, "GET", `/api/betrieb/orders${qs}`)).json as any[];
    expect(await list("")).toHaveLength(10);
    expect((await list("?filter=offen")).map((o) => o.code).sort()).toEqual(["C6VJ5T", "H7RT3K", "N4WZ8P", "Q9XB2M"]);
    expect((await list("?filter=abholbereit")).map((o) => o.code).sort()).toEqual(["7KP4QX", "D3FY6W", "G8UE4R"]);
    expect((await list("?filter=ueberfaellig")).map((o) => o.code)).toEqual(["RT8WMZ"]);
    expect((await list("?filter=heute_abgeholt")).map((o) => o.code)).toEqual(["Z5MA9H"]);
    expect((await list("?q=%20h7rt")).map((o) => o.code)).toEqual(["H7RT3K"]);
    expect((await list("?q=muster")).map((o) => o.code).sort()).toEqual(["C6VJ5T", "Z5MA9H"]);
    expect((await env.api(owner, "GET", "/api/betrieb/orders?filter=quatsch")).status).toBe(400);
    const all = await list("");
    expect(all[0].code).toBe("H7RT3K"); // newest first
    expect(all.find((o) => o.code === "C6VJ5T").ageDays).toBe(4);
  });

  it("validates order creation", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const post = (b: unknown) => env.api(owner, "POST", "/api/betrieb/orders", b);
    expect((await post({})).status).toBe(400);
    expect((await post({ item: "x", customerEmail: "kaputt" })).json.error.code).toBe("VALIDATION");
    expect((await post({ item: "x", customerPhone: "12" })).status).toBe(400);
    expect((await post({ item: "x", plannedPickupDate: "2026-13-40" })).status).toBe(400);
    expect((await post({ item: "x".repeat(121) })).status).toBe(400);
    const ok = await post({ item: "Gürtel", customerPhone: "+49 151 0000001", plannedPickupDate: "2026-11-20" });
    expect(ok.status).toBe(201);
  });

  it("stores a photo as a file and returns it only in the staff detail", async () => {
    const env = makeEnv();
    const owner = await env.token();
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
    const o = await createOrder(env, owner, { item: "Mit Foto", photoDataUrl: png });
    expect(o.hasPhoto).toBe(true);
    const detail = await env.api(owner, "GET", `/api/betrieb/orders/${o.id}`);
    expect(detail.json.photoDataUrl).toBe(png);
    const bad = await env.api(owner, "POST", "/api/betrieb/orders", { item: "x", photoDataUrl: "data:text/html;base64,AAAA" });
    expect(bad.status).toBe(400);
  });
});
