import { fileURLToPath } from "node:url";
import { PORTS } from "@abholdemo/shared";
import { buildApp } from "./app.js";

const dbFile = process.env.DB_FILE ?? fileURLToPath(new URL("../data/db.json", import.meta.url));
const app = buildApp({ dbFile, logger: true });

app.listen({ host: "127.0.0.1", port: PORTS.api }).then(
  () => console.log(`API läuft auf http://127.0.0.1:${PORTS.api}`),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
