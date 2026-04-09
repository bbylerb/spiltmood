const express = require('express');
const https   = require('https');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY   || 'AIzaSyAYJgGSNICZZHeXucBgGPF5UtqduAmizOE';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '605074815241-qd92s30l7s2456360omqe90hbsbl9tuq.apps.googleusercontent.com';

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

app.post('/api/ai', (req, res) => {
  const { messages, system, max_tokens } = req.body;

  const contents = [];
  if (system) {
    contents.push({ role: 'user', parts: [{ text: '[System]: ' + system }] });
    contents.push({ role: 'model', parts: [{ text: 'เข้าใจแล้ว พร้อมช่วยเหลือ' }] });
  }
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    if (Array.isArray(msg.content)) {
      const parts = msg.content.map(c => {
        if (c.type === 'image') {
          return { inline_data: { mime_type: c.source.media_type, data: c.source.data } };
        }
        return { text: c.text };
      });
      contents.push({ role, parts });
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  const geminiBody = JSON.stringify({
    contents,
    generationConfig: { maxOutputTokens: max_tokens || 500, temperature: 0.7 }
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(geminiBody)
    }
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const geminiRes = JSON.parse(data);
        if (geminiRes.error) return res.status(400).json({ error: geminiRes.error.message });
        const text = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ content: [{ type: 'text', text }] });
      } catch (e) {
        res.status(500).json({ error: 'Parse error: ' + e.message });
      }
    });
  });

  apiReq.on('error', (err) => {
    res.status(500).json({ error: 'Connection error: ' + err.message });
  });

  apiReq.write(geminiBody);
  apiReq.end();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║        SplitMood กำลังทำงาน         ║');
  console.log(`║   http://localhost:${PORT}              ║`);
  console.log('╚══════════════════════════════════════╝\n');
});
