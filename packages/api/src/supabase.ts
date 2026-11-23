import postgres from "postgres";
import type { RemoteDb } from "./store.js";
import type { Db } from "./types.js";

/** Whole demo database as one JSONB row in Supabase Postgres. */
export async function connectSupabase(url: string): Promise<RemoteDb> {
  const sql = postgres(url, { prepare: false, max: 1 }); // prepare:false works with the Supabase pooler
  await sql`create table if not exists demo_state (id int primary key, data jsonb not null)`;
  const [row] = await sql<{ data: Db }[]>`select data from demo_state where id = 1`;
  return {
    initial: row?.data ?? null,
    save: async (db) => {
      await sql`insert into demo_state (id, data) values (1, ${sql.json(db as never)})
                on conflict (id) do update set data = excluded.data`;
    },
  };
}
