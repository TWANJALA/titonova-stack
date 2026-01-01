import express from "express";
import cors from "cors";
import { generateHandler } from "./generate.js";
import archiver from "archiver";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post("/api/generate", generateHandler);

app.post('/api/generate-app', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  // If no OpenAI key configured, return a simple zip with a mock scaffold
  if (!process.env.OPENAI_API_KEY) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="titonova-app.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.append(`# ${prompt}\n\nGenerated mock app by TitoNova`, { name: 'README.md' });
    archive.append(JSON.stringify({ name: 'titonova-app' }, null, 2), { name: 'package.json' });
    archive.append('<!-- Mock index.html -->', { name: 'index.html' });
    await archive.finalize();
    return;
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an assistant that outputs a JSON object with a `files` map where keys are filenames and values are file contents. Respond ONLY with the JSON object.' },
          { role: 'user', content: `Create a minimal project scaffold for this prompt:\n${prompt}` },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      }),
    });

    const text = await openaiRes.text();
    let json;
    try {
      // Some models may wrap JSON in markdown; attempt to extract JSON block
      const match = text.match(/\{[\s\S]*\}$/m);
      const jsonText = match ? match[0] : text;
      json = JSON.parse(jsonText);
    } catch (err) {
      return res.status(502).json({ error: 'Failed to parse JSON from OpenAI', details: text });
    }

    const files = json.files || {};

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="titonova-app.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('Archive error', err);
      res.status(500).end();
    });
    archive.pipe(res);

    for (const [filename, content] of Object.entries(files)) {
      archive.append(typeof content === 'string' ? content : JSON.stringify(content, null, 2), { name: filename });
    }

    await archive.finalize();
  } catch (err) {
    console.error('generate-app error', err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error', details: String(err) });
    else res.end();
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});