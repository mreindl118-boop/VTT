// A token's piece on the map: what its miniature is built from, as one key (the app keeps a token's miniature from one
// pass over the tokens to the next while its key is unchanged, as building one can take a large part of a second), and
// the look a token gives the meshes of its piece.
import * as THREE from 'three';
import type { HeroFigure } from '../kit/heroes';
import type { Token } from '../state/campaign';

/** What a token's miniature is built from, as one string: the same key, the same miniature. A party pack character's
 *  figure (the look it has now: kit/heroes.ts, `heroLook`), its size, its state (standing, in a fight, down) and the
 *  jiggle switch; a creature's entry, its state, its
 *  token (which of its kind's looks it wears), the name the players know it by and the jiggle switch (a creature whose
 *  figure is built as a hero's reads it too); anyone else's role and colour (a member's cloth). The look the piece
 *  wears rides with it too: faint, for a creature the DM sees that the players have not yet been shown. */
export function figureKey(t: Pick<Token, 'id' | 'size' | 'role' | 'color' | 'playerName'>, o: { figure?: HeroFigure; entry?: string; state: 'dead' | boolean; jiggle: boolean; ghostly: boolean }): string {
  return JSON.stringify(
    o.figure ? ['hero', o.figure, t.size, o.state, o.jiggle, o.ghostly]
    : o.entry ? ['creature', o.entry, o.state, t.id, t.playerName ?? '', o.jiggle, o.ghostly]
    : ['adventurer', t.role === 'member' ? t.color : '', o.ghostly],
  );
}

/** Give the meshes of a token's piece the token's look: each its own material, never fogged (a hero's face and drapes
 *  keep their soft shading), faint for a creature the DM sees that the players have not yet been shown, and marked as
 *  the token's; a mesh with a look of its own (a hero's wings, a portrait) keeps it. A mesh is given it once: one of a
 *  miniature kept from the last pass already wears it (its key carries the faint look), and given it again it would be
 *  read off the token's material, which no longer says which meshes shade soft. */
export function tokenLook(piece: THREE.Object3D, tokenId: string, ghostly: boolean): void {
  piece.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || m.userData.tokenLook) return;
    m.userData.tokenLook = true; m.userData.role = 'token'; m.userData.tokenId = tokenId;
    if (m.userData.keepLook || (m.material as THREE.Material).userData?.keepLook) return;
    const src = m.material as THREE.MeshLambertMaterial;
    m.material = new THREE.MeshLambertMaterial({ color: src.color, flatShading: !src.userData?.smooth, side: src.side, transparent: ghostly, opacity: ghostly ? 0.45 : 1 });
  });
}
