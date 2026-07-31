import type Phaser from 'phaser';

import { AUDIO_EVENT } from '../audio/soundDesign';
import type { GameSessionState } from '../state/GameSession';
import { hitReaction, type HitImpactKind } from './feedbackRules';

const HIT_STOP_TIME_SCALE = 20;

export class CombatFeedback {
  private readonly effects = new Set<Phaser.GameObjects.GameObject>();
  private readonly normalTimeScale: number;
  private hitStopUntil = 0;
  private hitStopToken = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSessionState,
  ) {
    this.normalTimeScale = scene.physics.world.timeScale;
  }

  public enemyHit(kind: HitImpactKind, x: number, y: number, direction: -1 | 1): void {
    this.playImpact(kind, x, y, direction);
    this.scene.events.emit(AUDIO_EVENT, 'enemyHit');
  }

  public bossHit(kind: HitImpactKind, x: number, y: number, direction: -1 | 1): void {
    this.playImpact(kind, x, y, direction);
  }

  public shieldBlock(x: number, y: number, direction: -1 | 1): void {
    this.requestHitStop(16);
    this.scene.events.emit(AUDIO_EVENT, 'shieldBlock');
    this.spawnImpact(x, y, direction, 0x8ce7ff);
  }

  public shieldOpen(x: number, y: number, direction: -1 | 1): void {
    this.requestHitStop(45);
    this.scene.events.emit(AUDIO_EVENT, 'shieldOpen');
    if (this.session.settings.screenShake) this.scene.cameras.main.shake(60, 0.002);
    this.spawnImpact(x, y, direction, 0xffb454);
    this.spawnImpact(x, y - 4, direction, 0xd8f7ff);
  }

  public clear(): void {
    this.hitStopToken += 1;
    this.hitStopUntil = 0;
    this.scene.physics.world.timeScale = this.normalTimeScale;
    for (const effect of this.effects) {
      this.scene.tweens.killTweensOf(effect);
      effect.destroy();
    }
    this.effects.clear();
  }

  private playImpact(kind: HitImpactKind, x: number, y: number, direction: -1 | 1): void {
    const reaction = hitReaction(kind);
    this.requestHitStop(reaction.hitStopMs);
    if (reaction.shakesCamera && this.session.settings.screenShake) {
      this.scene.cameras.main.shake(45, 0.0015);
    }
    this.spawnImpact(x, y, direction, reaction.color);
  }

  private requestHitStop(durationMs: number): void {
    const now = this.scene.time.now;
    this.hitStopUntil = Math.max(this.hitStopUntil, now + durationMs);
    this.scene.physics.world.timeScale = HIT_STOP_TIME_SCALE;
    const token = ++this.hitStopToken;
    this.scene.time.delayedCall(this.hitStopUntil - now, () => {
      if (token !== this.hitStopToken || this.scene.time.now < this.hitStopUntil) return;
      this.hitStopUntil = 0;
      this.scene.physics.world.timeScale = this.normalTimeScale;
    });
  }

  private spawnImpact(x: number, y: number, direction: -1 | 1, color: number): void {
    for (let index = 0; index < 3; index += 1) {
      const spark = this.scene.add
        .rectangle(x, y, index === 0 ? 3 : 2, 2, color, 0.95)
        .setDepth(9)
        .setRotation((index - 1) * 0.45);
      this.effects.add(spark);
      this.scene.tweens.add({
        targets: spark,
        x: x + direction * (8 + index * 3),
        y: y + (index - 1) * 6,
        alpha: 0,
        duration: 120,
        onComplete: () => {
          this.effects.delete(spark);
          spark.destroy();
        },
      });
    }
  }
}
