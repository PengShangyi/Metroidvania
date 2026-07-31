export interface MapPoint {
  x: number;
  y: number;
}

export const ROOM_MAP_LAYOUT: Record<string, MapPoint> = {
  vestibule_dock: { x: 48, y: 132 },
  vestibule_gallery: { x: 82, y: 132 },
  vestibule_shaft: { x: 124, y: 132 },
  vestibule_depot: { x: 124, y: 170 },
  vestibule_vault: { x: 124, y: 94 },
  vestibule_causeway: { x: 172, y: 132 },
  bioforge_intake: { x: 216, y: 132 },
  bioforge_pump: { x: 250, y: 170 },
  bioforge_lattice: { x: 288, y: 170 },
  bioforge_nursery: { x: 324, y: 142 },
  bioforge_cradle: { x: 286, y: 94 },
  bioforge_spire: { x: 234, y: 94 },
  reactor_antechamber: { x: 338, y: 94 },
  reactor_conduit: { x: 374, y: 94 },
  reactor_coreway: { x: 402, y: 132 },
  reactor_threshold: { x: 430, y: 132 },
  core_guardian: { x: 454, y: 94 },
};
