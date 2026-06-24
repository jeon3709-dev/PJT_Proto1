const fs = require('fs');

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('No ANTHROPIC_API_KEY in environment. Aborting generate-daily.');
    process.exit(1);
  }

  const model = process.env.MODEL || 'claude-haiku-4-5';
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;

  const prompt = `Generate 40 Japanese vocabulary words (JLPT N5~N1) for a Korean learner. Date seed: ${dateStr}.\n\nReturn ONLY valid JSON with this structure:\n{\n  "noun": [ ...10 objects... ],\n  "verb": [ ...10 objects... ],\n  "adj":  [ ...10 objects... ],\n  "adv":  [ ...10 objects... ]\n}\n\nEach object must include: "k" (kanji/kana), "h" (hiragana), "r" (romaji), "m" (Korean meaning), "d" (short Korean description with an example), "level" (N5|N4|N3|N2|N1).\nNothing else.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
    });

    const json = await res.json();
    let text = (json?.content?.[0]?.text || '').trim();

    // remove BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    // strip code blocks
    const md = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (md) text = md[1].trim();

    // extract first JSON object if extra text
    if (!text.startsWith('{') && text.indexOf('{') !== -1) {
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) text = text.slice(first, last+1);
    }

    // basic cleaning
    let cleaned = text.replace(/[\u2018\u2019\u201C\u201D]/g, '"').replace(/,\s*(?=[}\]])/g, '').replace(/,\s*,+/g, ',').trim();

    const data = JSON.parse(cleaned);

    // ensure public directory exists
    const outDir = 'public';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    fs.writeFileSync(outDir + '/daily.json', JSON.stringify(data, null, 2), 'utf8');
    console.log('Generated public/daily.json successfully.');
  } catch (err) {
    console.error('Error generating daily.json:', err?.message || err);
    process.exit(1);
  }
}

main();
