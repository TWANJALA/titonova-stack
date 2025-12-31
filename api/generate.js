export async function generateHandler(req, res) {
  const { prompt } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // If no OpenAI key is configured, return a simple mock JSON response.
  if (!process.env.OPENAI_API_KEY) {
    return res.json({ result: `(mock) AI generated response for:\n\n${prompt}` });
  }

  // Stream from OpenAI and proxy to the client as Server-Sent Events (SSE).
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.8,
        stream: true,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return res.status(502).json({ error: 'OpenAI error', details: errText });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of openaiRes.body) {
      buffer += decoder.decode(chunk, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const line = part.trim();
        if (!line) continue;
        // OpenAI streaming lines are prefixed with "data: "
        const dataLine = line.startsWith('data:') ? line.replace(/^data:\s*/, '') : line;

        if (dataLine === '[DONE]') {
          res.write('event: done\ndata: [DONE]\n\n');
          res.end();
          return;
        }

        try {
          const parsed = JSON.parse(dataLine);
          // Depending on response shape, content may be in choices[0].delta.content
          const content = parsed?.choices?.[0]?.delta?.content || parsed?.choices?.[0]?.text;
          if (content) {
            // Send chunk as a JSON-encoded data field so clients can parse easily.
            res.write(`data: ${JSON.stringify(content)}\n\n`);
          }
        } catch (e) {
          // If parsing fails, forward raw line.
          res.write(`data: ${JSON.stringify(dataLine)}\n\n`);
        }
      }
    }

    // End stream if for-await completes without explicit [DONE]
    res.end();
  } catch (err) {
    console.error('generateHandler error', err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error', details: String(err) });
    else res.end();
  }
}