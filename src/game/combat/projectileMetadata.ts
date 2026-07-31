export type ProjectileFaction = 'player' | 'hostile';

export type ProjectileKind =
  'blaster' | 'piercing' | 'turret' | 'bossVolley' | 'shockwave' | 'reflected';

export interface ProjectileMetadata {
  faction: ProjectileFaction;
  kind: ProjectileKind;
  damage: number;
  reflectable: boolean;
  reflected: boolean;
  serial: number;
  expiresAt: number;
  hitTargetIds: Set<string>;
}

interface ProjectileDataStore {
  getData(key: string): unknown;
  setData(key: string, value: unknown): unknown;
}

const PROJECTILE_METADATA_KEY = 'starEchoProjectile';

export function createProjectileMetadata(
  values: Partial<Omit<ProjectileMetadata, 'hitTargetIds'>> = {},
): ProjectileMetadata {
  return {
    faction: values.faction ?? 'player',
    kind: values.kind ?? 'blaster',
    damage: values.damage ?? 0,
    reflectable: values.reflectable ?? false,
    reflected: values.reflected ?? false,
    serial: values.serial ?? 0,
    expiresAt: values.expiresAt ?? 0,
    hitTargetIds: new Set<string>(),
  };
}

export function configureProjectileMetadata(
  projectile: ProjectileDataStore,
  values: Partial<Omit<ProjectileMetadata, 'hitTargetIds'>>,
): ProjectileMetadata {
  const metadata = createProjectileMetadata(values);
  projectile.setData(PROJECTILE_METADATA_KEY, metadata);
  return metadata;
}

export function resetProjectileMetadata(projectile: ProjectileDataStore): void {
  projectile.setData(PROJECTILE_METADATA_KEY, createProjectileMetadata());
}

export function getProjectileMetadata(projectile: ProjectileDataStore): ProjectileMetadata {
  const value = projectile.getData(PROJECTILE_METADATA_KEY);
  if (isProjectileMetadata(value)) return value;
  return configureProjectileMetadata(projectile, {});
}

export function markProjectileTarget(metadata: ProjectileMetadata, targetId: string): boolean {
  if (metadata.hitTargetIds.has(targetId)) return false;
  metadata.hitTargetIds.add(targetId);
  return true;
}

function isProjectileMetadata(value: unknown): value is ProjectileMetadata {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as Partial<ProjectileMetadata>;
  return (
    (metadata.faction === 'player' || metadata.faction === 'hostile') &&
    typeof metadata.kind === 'string' &&
    typeof metadata.damage === 'number' &&
    typeof metadata.reflectable === 'boolean' &&
    typeof metadata.reflected === 'boolean' &&
    typeof metadata.serial === 'number' &&
    typeof metadata.expiresAt === 'number' &&
    metadata.hitTargetIds instanceof Set
  );
}
