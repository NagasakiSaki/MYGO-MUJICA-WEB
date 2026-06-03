/**
 * One-time migration: data.json → Supabase
 * Run: node migrate.js
 */
const SVC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjaWVtdmlobWpiZnd0c2xoZndxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ1NTAxNiwiZXhwIjoyMDk2MDMxMDE2fQ.85afGZybjMnoWXGxGxeNlyykqIjX2w6xMGrq2Q7z-HQ';
const URL = 'https://xciemvihmjbfwtslhfwq.supabase.co/rest/v1';
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('js/data.json', 'utf-8'));

async function insert(table, rows) {
  if (!rows.length) return;
  const resp = await fetch(`${URL}/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SVC_KEY,
      'Authorization': `Bearer ${SVC_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(rows)
  });
  console.log(`  ${table}: ${rows.length} rows → ${resp.status} ${resp.ok ? 'OK' : await resp.text()}`);
}

async function main() {
  console.log('Migrating data.json → Supabase\n');

  // Literature
  const lit = (data.literature || []).map(l => ({
    title: l.title, date: l.date, category: l.category || '', tags: l.tags || [],
    excerpt: l.excerpt || '', content: l.content || ''
  }));
  await insert('literature', lit);

  // Projects
  const proj = (data.projects || []).map(p => ({
    name: p.name, description: p.desc || '', detail: p.detail || '',
    tags: p.tags || [], link: p.link || ''
  }));
  await insert('projects', proj);

  // Recommendations
  const recs = data.recommendations || {};
  const allRecs = [];
  for (const cat of ['literary','popular','lightnovel','manga','movie','drama','anime','music']) {
    for (const r of (recs[cat] || [])) {
      allRecs.push({
        title: r.title, category: cat, creator: r.creator || r.author || r.artist || r.director || '',
        year: r.year || '', cover: r.cover || '', excerpt: r.excerpt || '', review: r.review || r.comment || ''
      });
    }
  }
  await insert('recommendations', allRecs);

  console.log('\nMigration complete!');
}

main().catch(e => console.error(e));
