import { fileURLToPath } from "node:url";
import { PORTS } from "@abholdemo/shared";
import { buildApp } from "./app.js";
import { connectSupabase } from "./supabase.js";

const dbFile = process.env.DB_FILE ?? fileURLToPath(new URL("../data/db.json", import.meta.url));
const remote = process.env.DATABASE_URL ? await connectSupabase(process.env.DATABASE_URL) : undefined;
const app = buildApp({ dbFile, logger: true, remote });

const host = process.env.PORT ? "0.0.0.0" : "127.0.0.1"; // hosted: Render sets PORT
const port = Number(process.env.PORT) || PORTS.api;

app.listen({ host, port }).then(
  () => console.log(`API läuft auf http://${host}:${port}`),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
