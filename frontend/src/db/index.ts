import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Server-only: the connection string is a secret and must never reach client code.
// App runtime uses the pooled (-pooler) URL; the direct DATABASE_URL is for migrations.
const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
export const db = drizzle(neon(url!), { schema });
