import Fastify from "fastify";
import pg from "pg";
import cors from "@fastify/cors";

const fastify = Fastify({ logger: true });

// register CORS so the studio dev server can call the API
await fastify.register(cors, { origin: true });

const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "titonova",
  password: process.env.PGPASSWORD || "titonova_pw",
  database: process.env.PGDATABASE || "titonova",
});

fastify.get("/health", async () => ({ ok: true }));

fastify.get("/health_check", async () => {
  const { rows } = await pool.query("SELECT * FROM health_check ORDER BY id DESC LIMIT 20");
  return rows;
});

fastify.post("/health_check", async (req) => {
  const msg = (req.body && req.body.message) ? req.body.message : "Hello from TitoNova API";
  const { rows } = await pool.query(
    "INSERT INTO health_check(message) VALUES($1) RETURNING *",
    [msg]
  );
  return rows[0];
});

fastify.post('/ai', async (req) => {
  const prompt = req.body && req.body.prompt ? String(req.body.prompt) : '';

  if (!prompt) return { error: 'prompt is required' };

  // If an OpenAI API key is configured, proxy the request to OpenAI's Chat Completions API.
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 400,
        }),
      });

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || JSON.stringify(data);
      return { reply };
    } catch (err) {
      fastify.log.error(err);
      return { error: 'AI request failed', details: String(err) };
    }
  }

  // Fallback mock response when no API key is configured.
  return { reply: `(mock) AI reply to: ${prompt}` };
});

fastify.listen({ port: 3001, host: "0.0.0.0" });
