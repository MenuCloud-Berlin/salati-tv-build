#!/usr/bin/env node
// Liest den Ist-Zustand bei Apple, bevor irgendetwas angelegt wird:
// vorhandene Apps, Bundle-IDs, Zertifikate und Profile. Reine Leseabfrage.
//
// Usage: node scripts/asc-bestand.mjs
import { asc, ascAlle } from './lib/asc.mjs';

console.log('=== Apps ===');
for (const a of await ascAlle('/apps?limit=200')) {
  console.log(`  ${a.id.padEnd(12)} ${a.attributes.bundleId.padEnd(30)} ${a.attributes.name}`);
}

console.log('\n=== Bundle-IDs ===');
for (const b of await ascAlle('/bundleIds?limit=200')) {
  const a = b.attributes;
  console.log(`  ${b.id.padEnd(12)} ${String(a.identifier).padEnd(34)} ${String(a.platform).padEnd(10)} ${a.name}`);
}

console.log('\n=== Zertifikate ===');
for (const c of await ascAlle('/certificates?limit=200')) {
  const a = c.attributes;
  console.log(
    `  ${c.id.padEnd(12)} ${String(a.certificateType).padEnd(24)} laeuft ab ${String(a.expirationDate).slice(0, 10)}  ${a.displayName}`,
  );
}

console.log('\n=== Profile ===');
for (const p of await ascAlle('/profiles?limit=200')) {
  const a = p.attributes;
  console.log(
    `  ${p.id.padEnd(12)} ${String(a.profileType).padEnd(22)} ${String(a.profileState).padEnd(8)} ${a.name}`,
  );
}

console.log('\n=== Nutzer/Rolle des Schluessels ===');
try {
  const me = await asc('/users?limit=10');
  for (const u of me.data) {
    console.log(`  ${u.attributes.username ?? u.attributes.firstName} — ${u.attributes.roles?.join(', ')}`);
  }
} catch (e) {
  console.log(`  (nicht lesbar: ${String(e.message).slice(0, 120)})`);
}
