// MemoryHelper.ts
// Local pgvector-backed memory for the coding assistant.
// - Embeddings via @xenova/transformers (Xenova/all-MiniLM-L6-v2, 384-dim, fully local)
// - Storage via Postgres + pgvector
// - Failures degrade silently: if Postgres is down, the app keeps working without memory.

import crypto from "node:crypto";
import path from "node:path";
import { app } from "electron";
import { Pool } from "pg";

// @xenova/transformers is ESM-only. Under tsconfig "module": "CommonJS",
// TypeScript downcompiles `await import(...)` to `require(...)`, which fails
// at runtime ("require() of ES Module ... not supported"). The Function
// constructor preserves a real ESM dynamic import through TS compilation.
const dynamicImportESM = new Function(
  "specifier",
  "return import(specifier)"
) as <T = any>(specifier: string) => Promise<T>;

const EMBED_DIM = 384;
const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";

export interface MemoryConfig {
  enabled: boolean;
  connectionString: string;
}

export interface MemoryRecord {
  question: string;
  topic?: string | null;
  pattern?: string | null;
  language?: string | null;
  solutionCode?: string | null;
  thoughts?: string | null;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  bugsNoted?: string | null;
  alternativeApproaches?: string | null;
  summaryText?: string | null;
}

export interface RetrievedMemory extends MemoryRecord {
  id: number;
  createdAt: string;
  similarity: number;
  liked: number | null;
}

let pool: Pool | null = null;
let embedder: any = null;
let embedderLoading: Promise<any> | null = null;
let initPromise: Promise<void> | null = null;
let initialized = false;
let lastError: string | null = null;

function hashQuestion(q: string, language?: string | null): string {
  return crypto
    .createHash("sha256")
    .update(`${language || ""}::${q.trim()}`)
    .digest("hex");
}

function vecToSql(v: number[]): string {
  return `[${v.join(",")}]`;
}

async function loadEmbedder(): Promise<any> {
  if (embedder) return embedder;
  if (embedderLoading) return embedderLoading;

  embedderLoading = (async () => {
    const transformers: any = await dynamicImportESM("@xenova/transformers");
    try {
      transformers.env.cacheDir = path.join(
        app.getPath("userData"),
        "transformers-cache"
      );
      transformers.env.allowLocalModels = false;
    } catch {
      /* non-electron context */
    }
    embedder = await transformers.pipeline("feature-extraction", EMBED_MODEL);
    return embedder;
  })();

  try {
    return await embedderLoading;
  } finally {
    embedderLoading = null;
  }
}

export async function embed(text: string): Promise<number[]> {
  const e = await loadEmbedder();
  const out = await e(text, { pooling: "mean", normalize: true });
  const arr = Array.from(out.data as Float32Array);
  if (arr.length !== EMBED_DIM) {
    throw new Error(
      `Embedding dim mismatch: got ${arr.length}, expected ${EMBED_DIM}`
    );
  }
  return arr;
}

export function isEnabled(): boolean {
  return initialized && pool !== null;
}

export function getStatus(): { initialized: boolean; lastError: string | null } {
  return { initialized, lastError };
}

export async function initMemory(config: MemoryConfig): Promise<void> {
  if (!config.enabled) {
    await closeMemory();
    initialized = false;
    return;
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (pool) {
        await pool.end().catch(() => {});
        pool = null;
      }

      pool = new Pool({
        connectionString: config.connectionString,
        max: 4,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });

      const client = await pool.connect();
      try {
        await client.query("CREATE EXTENSION IF NOT EXISTS vector");
        await client.query(`
          CREATE TABLE IF NOT EXISTS coding_memory (
            id                    SERIAL PRIMARY KEY,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            question              TEXT NOT NULL,
            question_hash         TEXT UNIQUE NOT NULL,
            topic                 TEXT,
            pattern               TEXT,
            language              TEXT,
            solution_code         TEXT,
            thoughts              TEXT,
            time_complexity       TEXT,
            space_complexity      TEXT,
            bugs_noted            TEXT,
            alternative_approaches TEXT,
            summary_text          TEXT,
            liked                 SMALLINT DEFAULT NULL,
            embedding             VECTOR(${EMBED_DIM}) NOT NULL
          )
        `);
        // Idempotent migrations for existing tables
        await client.query(`ALTER TABLE coding_memory ADD COLUMN IF NOT EXISTS alternative_approaches TEXT`);
        await client.query(`ALTER TABLE coding_memory ADD COLUMN IF NOT EXISTS summary_text TEXT`);
        await client.query(`ALTER TABLE coding_memory ADD COLUMN IF NOT EXISTS liked SMALLINT DEFAULT NULL`);
        await client.query(`
          CREATE INDEX IF NOT EXISTS coding_memory_embedding_idx
            ON coding_memory USING hnsw (embedding vector_cosine_ops)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS coding_memory_pattern_idx
            ON coding_memory (pattern)
        `);
      } finally {
        client.release();
      }

      // Warm the embedder so the first user query is fast
      await loadEmbedder();

      initialized = true;
      lastError = null;
      console.log("[Memory] pgvector memory initialized");
    } catch (e: any) {
      lastError = e?.message || String(e);
      initialized = false;
      if (pool) {
        await pool.end().catch(() => {});
        pool = null;
      }
      console.warn("[Memory] init failed, memory disabled:", lastError);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export async function retrieveSimilar(
  question: string,
  language: string | null | undefined,
  k = 3,
  minSimilarity = 0.55
): Promise<RetrievedMemory[]> {
  if (!isEnabled() || !pool) return [];
  if (!question || !question.trim()) return [];

  try {
    const qVec = await embed(`${language ? language + ": " : ""}${question}`);
    const { rows } = await pool.query(
      `SELECT id, created_at, question, topic, pattern, language,
              solution_code, thoughts, time_complexity, space_complexity, bugs_noted,
              alternative_approaches, summary_text, liked,
              1 - (embedding <=> $1::vector) AS similarity
       FROM coding_memory
       WHERE ($2::text IS NULL OR language = $2)
         AND (liked IS NULL OR liked > 0)
       ORDER BY
         CASE WHEN liked = 1 THEN 0 ELSE 1 END,
         embedding <=> $1::vector
       LIMIT $3`,
      [vecToSql(qVec), language || null, k]
    );

    return rows
      .filter((r: any) => Number(r.similarity) >= minSimilarity)
      .map((r: any) => ({
        id: r.id,
        createdAt: r.created_at,
        question: r.question,
        topic: r.topic,
        pattern: r.pattern,
        language: r.language,
        solutionCode: r.solution_code,
        thoughts: r.thoughts,
        timeComplexity: r.time_complexity,
        spaceComplexity: r.space_complexity,
        bugsNoted: r.bugs_noted,
        alternativeApproaches: r.alternative_approaches,
        summaryText: r.summary_text,
        liked: r.liked !== null ? Number(r.liked) : null,
        similarity: Number(r.similarity),
      }));
  } catch (e: any) {
    console.warn("[Memory] retrieve failed:", e?.message || e);
    return [];
  }
}

export async function storeMemory(rec: MemoryRecord): Promise<number | null> {
  if (!isEnabled() || !pool) return null;
  if (!rec.question || !rec.question.trim()) return null;

  try {
    const hash = hashQuestion(rec.question, rec.language);
    const text = `${rec.language ? rec.language + ": " : ""}${rec.question}`;
    const vec = await embed(text);

    const { rows } = await pool.query(
      `INSERT INTO coding_memory
        (question, question_hash, topic, pattern, language, solution_code,
         thoughts, time_complexity, space_complexity, bugs_noted,
         alternative_approaches, summary_text, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::vector)
       ON CONFLICT (question_hash) DO UPDATE SET
         solution_code          = EXCLUDED.solution_code,
         thoughts               = EXCLUDED.thoughts,
         time_complexity        = EXCLUDED.time_complexity,
         space_complexity       = EXCLUDED.space_complexity,
         alternative_approaches = EXCLUDED.alternative_approaches,
         summary_text           = EXCLUDED.summary_text,
         bugs_noted             = COALESCE(EXCLUDED.bugs_noted, coding_memory.bugs_noted),
         pattern                = COALESCE(EXCLUDED.pattern, coding_memory.pattern),
         topic                  = COALESCE(EXCLUDED.topic, coding_memory.topic)
       RETURNING id`,
      [
        rec.question,
        hash,
        rec.topic ?? null,
        rec.pattern ?? null,
        rec.language ?? null,
        rec.solutionCode ?? null,
        rec.thoughts ?? null,
        rec.timeComplexity ?? null,
        rec.spaceComplexity ?? null,
        rec.bugsNoted ?? null,
        rec.alternativeApproaches ?? null,
        rec.summaryText ?? null,
        vecToSql(vec),
      ]
    );
    return rows[0]?.id ?? null;
  } catch (e: any) {
    console.warn("[Memory] store failed:", e?.message || e);
    return null;
  }
}

export async function findDirectAnswer(
  question: string,
  language: string | null | undefined,
  minSimilarity = 0.92
): Promise<RetrievedMemory | null> {
  if (!isEnabled() || !pool) return null;
  if (!question || !question.trim()) return null;

  try {
    const qVec = await embed(`${language ? language + ": " : ""}${question}`);
    const { rows } = await pool.query(
      `SELECT id, created_at, question, topic, pattern, language,
              solution_code, thoughts, time_complexity, space_complexity, bugs_noted,
              alternative_approaches, summary_text, liked,
              1 - (embedding <=> $1::vector) AS similarity
       FROM coding_memory
       WHERE ($2::text IS NULL OR language = $2)
         AND (liked IS NULL OR liked > 0)
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      [vecToSql(qVec), language || null]
    );

    if (!rows.length) return null;
    const r = rows[0];
    const sim = Number(r.similarity);
    if (sim < minSimilarity) return null;

    return {
      id: r.id,
      createdAt: r.created_at,
      question: r.question,
      topic: r.topic,
      pattern: r.pattern,
      language: r.language,
      solutionCode: r.solution_code,
      thoughts: r.thoughts,
      timeComplexity: r.time_complexity,
      spaceComplexity: r.space_complexity,
      bugsNoted: r.bugs_noted,
      alternativeApproaches: r.alternative_approaches,
      summaryText: r.summary_text,
      liked: r.liked !== null ? Number(r.liked) : null,
      similarity: sim,
    };
  } catch (e: any) {
    console.warn("[Memory] findDirectAnswer failed:", e?.message || e);
    return null;
  }
}

export async function likeMemory(id: number, liked: boolean): Promise<void> {
  if (!isEnabled() || !pool) return;
  try {
    await pool.query(
      `UPDATE coding_memory SET liked = $1 WHERE id = $2`,
      [liked ? 1 : -1, id]
    );
  } catch (e: any) {
    console.warn("[Memory] likeMemory failed:", e?.message || e);
  }
}

// Heuristic pattern detector — keyword-based, fast, conservative.
// Used to label new memories so future retrieval can filter by `pattern`.
const PATTERN_RULES: Array<[RegExp, string]> = [
  [/\b(sliding\s*window|window\s*size)\b/i, "sliding window"],
  [/\b(two\s*pointers?)\b/i, "two pointers"],
  [/\b(binary\s*search|lower_bound|upper_bound|bisect)\b/i, "binary search"],
  [/\b(dynamic\s*programming|memoiz|tabulation|dp\b)\b/i, "dynamic programming"],
  [/\b(backtrack|recursion\s*tree|permutations?|combinations?)\b/i, "backtracking"],
  [/\b(bfs|breadth[-\s]first|queue\s+traversal)\b/i, "bfs"],
  [/\b(dfs|depth[-\s]first|stack\s+traversal)\b/i, "dfs"],
  [/\b(union[-\s]find|disjoint\s*set|dsu)\b/i, "union-find"],
  [/\b(topological\s*sort|kahn|indegree)\b/i, "topological sort"],
  [/\b(dijkstra|bellman[-\s]ford|floyd[-\s]warshall|shortest\s*path)\b/i, "shortest path"],
  [/\b(min[-\s]?heap|max[-\s]?heap|priority\s*queue|heapq)\b/i, "heap"],
  [/\b(trie|prefix\s*tree)\b/i, "trie"],
  [/\b(segment\s*tree|fenwick|bit\s*indexed\s*tree)\b/i, "segment tree"],
  [/\b(prefix\s*sum|cumulative\s*sum)\b/i, "prefix sum"],
  [/\b(greedy)\b/i, "greedy"],
  [/\b(hash\s*map|hashmap|dict|hash\s*set|hashset)\b/i, "hashmap"],
  [/\b(linked\s*list)\b/i, "linked list"],
  [/\b(monotonic\s*stack|monotonic\s*queue)\b/i, "monotonic stack"],
  [/\b(graph|adjacency\s*list)\b/i, "graph"],
];

export function detectPattern(text: string): string | null {
  if (!text) return null;
  for (const [re, label] of PATTERN_RULES) {
    if (re.test(text)) return label;
  }
  return null;
}

export function formatMemoryContext(rows: RetrievedMemory[]): string {
  if (!rows || rows.length === 0) return "";
  const out: string[] = [];
  out.push(
    "=== RETRIEVED SIMILAR PROBLEMS (reference only — DO NOT copy blindly) ==="
  );
  rows.forEach((r, i) => {
    out.push(
      `\n[#${i + 1}] similarity=${r.similarity.toFixed(3)} | language=${
        r.language || "n/a"
      } | pattern=${r.pattern || "unknown"}`
    );
    out.push(`Q: ${r.question.slice(0, 500)}`);
    if (r.thoughts) out.push(`Approach: ${r.thoughts.slice(0, 500)}`);
    if (r.timeComplexity) out.push(`Time: ${r.timeComplexity.slice(0, 200)}`);
    if (r.spaceComplexity) out.push(`Space: ${r.spaceComplexity.slice(0, 200)}`);
    if (r.bugsNoted) out.push(`⚠️  Past bugs to avoid: ${r.bugsNoted.slice(0, 400)}`);
  });
  out.push("=== END RETRIEVED MEMORIES ===");
  out.push("");
  out.push(
    "Rules: Use the above only if relevant. Reuse validated patterns. AVOID the bugs listed above. If no memory is relevant, ignore this section."
  );
  return out.join("\n");
}

export async function closeMemory(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
  initialized = false;
}

/**
 * One-shot database setup: connects to the maintenance DB ("postgres"),
 * creates the target DB if missing, then enables the vector extension and
 * creates the schema. Used by the "Setup database" button in Settings.
 */
export async function setupDatabase(
  connectionString: string
): Promise<{ ok: boolean; error?: string; hint?: string }> {
  let target: URL;
  try {
    target = new URL(connectionString);
  } catch (e: any) {
    return { ok: false, error: `Invalid connection string: ${e?.message || e}` };
  }

  const host = target.hostname || "localhost";
  const port = target.port ? Number(target.port) : 5432;
  const user = decodeURIComponent(target.username || process.env.USER || "postgres");
  const password = target.password ? decodeURIComponent(target.password) : undefined;
  const database = target.pathname.replace(/^\//, "") || "coding_memory";

  // 1. Maintenance connection — create DB if missing
  const admin = new Pool({
    host, port, user, password,
    database: "postgres",
    connectionTimeoutMillis: 5_000,
    max: 1
  });

  try {
    const c = await admin.connect();
    try {
      const r = await c.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [database]
      );
      if (r.rowCount === 0) {
        await c.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
      }
    } finally {
      c.release();
    }
  } catch (e: any) {
    await admin.end().catch(() => {});
    return {
      ok: false,
      error: e?.message || String(e),
      hint:
        "Could not reach a local Postgres. Install Postgres.app (https://postgresapp.com/) — it's ~50MB, runs in your menubar, and ships with pgvector built-in."
    };
  }
  await admin.end().catch(() => {});

  // 2. Target DB connection — extension + schema
  const db = new Pool({
    host, port, user, password, database,
    connectionTimeoutMillis: 5_000,
    max: 1
  });

  try {
    const c = await db.connect();
    try {
      try {
        await c.query("CREATE EXTENSION IF NOT EXISTS vector");
      } catch (e: any) {
        return {
          ok: false,
          error: `pgvector extension unavailable: ${e?.message || e}`,
          hint:
            "Postgres is running but pgvector isn't installed. Postgres.app v15+ ships with it built-in. With Homebrew: `brew install pgvector` then restart Postgres."
        };
      }

      await c.query(`
        CREATE TABLE IF NOT EXISTS coding_memory (
          id                    SERIAL PRIMARY KEY,
          created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          question              TEXT NOT NULL,
          question_hash         TEXT UNIQUE NOT NULL,
          topic                 TEXT,
          pattern               TEXT,
          language              TEXT,
          solution_code         TEXT,
          thoughts              TEXT,
          time_complexity       TEXT,
          space_complexity      TEXT,
          bugs_noted            TEXT,
          alternative_approaches TEXT,
          summary_text          TEXT,
          liked                 SMALLINT DEFAULT NULL,
          embedding             VECTOR(${EMBED_DIM}) NOT NULL
        )
      `);
      await c.query(`ALTER TABLE coding_memory ADD COLUMN IF NOT EXISTS alternative_approaches TEXT`);
      await c.query(`ALTER TABLE coding_memory ADD COLUMN IF NOT EXISTS summary_text TEXT`);
      await c.query(`ALTER TABLE coding_memory ADD COLUMN IF NOT EXISTS liked SMALLINT DEFAULT NULL`);
      await c.query(`
        CREATE INDEX IF NOT EXISTS coding_memory_embedding_idx
          ON coding_memory USING hnsw (embedding vector_cosine_ops)
      `);
      await c.query(`
        CREATE INDEX IF NOT EXISTS coding_memory_pattern_idx
          ON coding_memory (pattern)
      `);
    } finally {
      c.release();
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    await db.end().catch(() => {});
  }

  return { ok: true };
}
