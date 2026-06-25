const fs = require('fs');
const path = require('path');

const OUT = path.join(process.cwd(), 'daily.json');

function keepExistingAndExit(reason) {
  if (fs.existsSync(OUT)) {
    console.warn(`[generate-daily] ${reason} → 기존 daily.json 유지`);
  } else {
    console.warn(`[generate-daily] ${reason} → daily.json이 없어 빈 스텁 생성`);
    fs.writeFileSync(OUT, JSON.stringify({ noun: [], verb: [], adj: [], adv: [] }, null, 2), 'utf8');
  }
  process.exit(0);
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return keepExistingAndExit('ANTHROPIC_API_KEY 환경변수 없음');

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

    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const md = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (md) text = md[1].trim();

    if (!text.startsWith('{') && text.indexOf('{') !== -1) {
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) text = text.slice(first, last+1);
    }

    let cleaned = text.replace(/[''""]/g, '"').replace(/,\s*(?=[}\]])/g, '').replace(/,\s*,+/g, ',').trim();

    const data = JSON.parse(cleaned);

    for (const cat of ['noun', 'verb', 'adj', 'adv']) {
      if (!Array.isArray(data[cat]) || data[cat].length < 5) {
        return keepExistingAndExit(`'${cat}' 카테고리 데이터 부족`);
      }
    }

    fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');
    console.log('[generate-daily] daily.json 생성 완료');
  } catch (err) {
    return keepExistingAndExit(`생성 오류: ${err?.message || err}`);
  }
}

main();
