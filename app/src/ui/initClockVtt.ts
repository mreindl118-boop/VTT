// The initiative clock inside mistLAB: the VTT's side of the clock's host (ui/initClock.ts). The roster seeds the
// party, the books store serves the SRD monsters, the bestiary gives the module's creatures, and placed creatures can
// be copied in from the open map. The same clock also runs on its own page (standalone/initClockPage.ts).
import type { App } from '../app';
import { BESTIARY, colorOf, statsOf } from '../bestiary';
import { EDITION_EVENT, rulesEdition, setRulesEdition } from '../books/lookup';
import { loadEntries } from '../books/store';
import { BOOK_OF, type MonsterSummary } from '../books/types';
import { fightsFromPack, xpForCr, type PreparedFight } from '../core/initClock';
import { openClock, type CatItem, type ClockHost } from './initClock';

let packRaw: string | null | undefined, packFights: PreparedFight[] = [];

export function openInitClock(app: App): void {
  const host: ClockHost = {
    key: app.state.id,
    roster: () => app.state.roster.filter((s) => s.kind === 'pc').map((s) => ({ id: s.id, name: s.name, color: s.color, initMod: s.initMod })),
    monsters: (ed) => loadEntries(BOOK_OF[ed], 'monsters').then((f) => Object.values(f.entries).map((e) => ({ id: e.id, name: e.name, s: e.s as MonsterSummary, html: e.html }))).catch(() => []),
    edition: rulesEdition,
    setEdition: setRulesEdition,
    editionEvent: EDITION_EVENT,
    modules: () => BESTIARY.filter((e) => e.kind === 'npc' || e.kind === 'creature').map((e): CatItem => {
      const st = statsOf(e);
      return { key: `module:${e.id}`, ref: { type: 'module', id: e.id }, name: e.name, cr: st?.cr, xp: xpForCr(st?.cr), ac: st?.ac, hp: st?.hp, mod: 0, tag: e.kind === 'npc' ? 'Module person' : 'Module creature' };
    }),
    resolveModule: async (id, ed) => {
      const cs = await import('./creature').then((x) => x.creatureSource(id, ed));
      return cs.kind === 'srd' ? { id: cs.entry.id, edition: cs.entry.edition } : undefined;
    },
    mapCreatures: () => {
      const loc = app.cur?.scene.location;
      return app.state.tokens.filter((t) => t.role === 'creature' && t.location === loc).map((t) => {
        const ent = BESTIARY.find((b) => b.id === t.creatureId);
        return { id: t.id, name: t.name, alias: t.playerName, color: t.color ?? (ent ? colorOf(ent) : undefined), hidden: t.hidden, hp: t.hp, creatureId: t.creatureId };
      });
    },
    // The encounter pack the DM opened under Initiative → Encounter packs (kept on this device, never in the repo).
    fights: () => {
      let raw: string | null = null;
      try { raw = localStorage.getItem('mistlab.encounterPack'); } catch { /* no storage */ }
      if (raw !== packRaw) { packRaw = raw; try { packFights = raw ? fightsFromPack(JSON.parse(raw), (id) => BESTIARY.find((b) => b.id === id)?.name) : []; } catch { packFights = []; } }
      return packFights;
    },
    fightsLabel: 'the encounter pack',
    rosterLabel: 'the VTT roster',
  };
  openClock(host);
}
