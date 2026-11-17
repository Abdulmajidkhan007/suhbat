// `npm audit --omit=dev --json` chiqishini stdin'dan o'qiydi; scripts/audit-allowlist.json (sabab -> paketlar)
// istisno ro'yxatidan tashqari har qanday high/critical bo'lsa 1 bilan chiqadi.
import { readFileSync } from 'node:fs';

const allowed = new Set(Object.values(JSON.parse(readFileSync(new URL('./audit-allowlist.json', import.meta.url), 'utf8'))).flat());
const audit = JSON.parse(readFileSync(0, 'utf8'));
const bad = Object.entries(audit.vulnerabilities ?? {})
  .filter(([name, v]) => ['high', 'critical'].includes(v.severity) && !allowed.has(name))
  .map(([name]) => name);
if (bad.length > 0) {
  console.error(`::error::Istisnosiz high/critical: ${bad.join(', ')}`);
  process.exit(1);
}
console.log('audit: istisnodan tashqari high yoq');
