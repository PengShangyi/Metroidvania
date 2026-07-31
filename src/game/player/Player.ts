import Phaser from 'phaser';

import type { ActionSnapshot } from '../input/actions';
import type { AbilityState } from '../state/GameSession';
import { canStartDash, DASH, dashVelocity } from './dashMath';
import {
  canConsumeJump,
  horizontalAcceleration,
  MOVEMENT,
  shortenedJumpVelocity,
} from './movementMath';

export type PlayerMovementState = 'idle' | 'run' | 'jump' | 'fall' | 'dash';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private groundedAt = Number.NEGATIVE_INFINITY;
  private jumpBufferedUntil = Number.NEGATIVE_INFINITY;
  private facing: -1 | 1 = 1;
  private movementStateValue: PlayerMovementState = 'idle';
  private dashAvailable = true;
  private dashEndsAt = 0;
  private dashInvulnerableUntil = 0;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.setCollideWorldBounds(true);
    this.setDragX(MOVEMENT.deceleration);
    this.setMaxVelocity(MOVEMENT.speed, MOVEMENT.maxFallSpeed);
    (this.body as Phaser.Physics.Arcade.Body).setSize(14, 28).setOffset(5, 4);
  }

  public updateMovement(delta: number, input: ActionSnapshot, abilities: AbilityState): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.groundedAt = now;
      if (now >= this.dashEndsAt) this.dashAvailable = true;
    }
    if (input.pressed.jump) this.jumpBufferedUntil = now + MOVEMENT.jumpBufferMs;

    if (input.moveX !== 0) this.facing = input.moveX < 0 ? -1 : 1;
    if (canStartDash(abilities.phaseDash, this.dashAvailable, input.pressed.dash)) {
      this.startDash(now, input.moveX);
    }

    if (now < this.dashEndsAt) {
      body.setAllowGravity(false);
      this.setAcceleration(0, 0).setVelocity(dashVelocity(this.facing), 0);
      this.movementStateValue = 'dash';
      this.setTint(0x8ce7ff).setAlpha(0.82);
      return;
    }

    if (!body.allowGravity) body.setAllowGravity(true);
    body.setMaxVelocity(MOVEMENT.speed, MOVEMENT.maxFallSpeed);
    this.clearTint();

    if (input.moveX !== 0) {
      this.setFlipX(this.facing < 0);
      this.setAccelerationX(horizontalAcceleration(input.moveX));
    } else {
      this.setAccelerationX(0);
    }

    if (canConsumeJump(now, this.groundedAt, this.jumpBufferedUntil)) {
      this.setVelocityY(MOVEMENT.jumpVelocity);
      this.jumpBufferedUntil = Number.NEGATIVE_INFINITY;
      this.groundedAt = Number.NEGATIVE_INFINITY;
    }

    if (input.released.jump) this.setVelocityY(shortenedJumpVelocity(body.velocity.y));

    this.updateState(grounded, delta);
  }

  public get facingDirection(): -1 | 1 {
    return this.facing;
  }

  public get movementState(): PlayerMovementState {
    return this.movementStateValue;
  }

  public isDashInvulnerable(now: number): boolean {
    return now < this.dashInvulnerableUntil;
  }

  public resetTraversalState(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.dashEndsAt = 0;
    this.dashInvulnerableUntil = 0;
    this.dashAvailable = true;
    body.setAllowGravity(true);
    body.setMaxVelocity(MOVEMENT.speed, MOVEMENT.maxFallSpeed);
    this.clearTint().setAlpha(1);
  }

  private startDash(now: number, inputX: number): void {
    if (inputX !== 0) this.facing = inputX < 0 ? -1 : 1;
    this.setFlipX(this.facing < 0);
    this.dashAvailable = false;
    this.dashEndsAt = now + DASH.durationMs;
    this.dashInvulnerableUntil = now + DASH.invulnerabilityMs;
    (this.body as Phaser.Physics.Arcade.Body).setMaxVelocity(DASH.speed, MOVEMENT.maxFallSpeed);
  }

  private updateState(grounded: boolean, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!grounded) this.movementStateValue = body.velocity.y < 0 ? 'jump' : 'fall';
    else if (Math.abs(body.velocity.x) > 8) this.movementStateValue = 'run';
    else this.movementStateValue = 'idle';

    const runBob = this.movementStateValue === 'run' ? Math.sin(this.scene.time.now / 55) : 0;
    this.setScale(1, 1 + runBob * 0.025);
    this.setAlpha(this.movementStateValue === 'fall' ? 0.94 : 1);
    this.rotation = Phaser.Math.Linear(this.rotation, 0, Math.min(1, delta / 80));
  }
}
