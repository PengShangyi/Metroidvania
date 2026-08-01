import Phaser from 'phaser';

import type { ActionSnapshot } from '../input/actions';
import type { AbilityState } from '../state/GameSession';
import { canStartDash, DASH, dashRefreshAllowed, dashVelocity } from './dashMath';
import {
  canConsumeJump,
  horizontalAcceleration,
  MOVEMENT,
  shortenedJumpVelocity,
} from './movementMath';
import {
  canWallJump,
  canWallSlide,
  cappedWallSlideVelocity,
  wallContactDirection,
  wallJumpFacingInputAllowed,
  wallJumpVelocity,
} from './wallJumpMath';

export type PlayerMovementState = 'idle' | 'run' | 'jump' | 'fall' | 'dash' | 'wallSlide';
export type PlayerActionAnimation = 'shoot' | 'slash' | 'hurt' | 'death';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private groundedAt = Number.NEGATIVE_INFINITY;
  private jumpBufferedUntil = Number.NEGATIVE_INFINITY;
  private facing: -1 | 1 = 1;
  private movementStateValue: PlayerMovementState = 'idle';
  private dashAvailable = true;
  private dashEndsAt = 0;
  private dashCooldownReadyAt = 0;
  private dashInvulnerableUntil = 0;
  private actionLockedUntil = 0;
  private wallJumpLockUntil = 0;
  private wallJumpSerialValue = 0;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'iya-atlas', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.setDepth(6);
    this.setCollideWorldBounds(true);
    this.setDragX(MOVEMENT.deceleration);
    this.setMaxVelocity(MOVEMENT.speed, MOVEMENT.maxFallSpeed);
    (this.body as Phaser.Physics.Arcade.Body).setSize(14, 28).setOffset(5, 4);
    this.play('iya-idle');
  }

  public updateMovement(delta: number, input: ActionSnapshot, abilities: AbilityState): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;
    const grounded = body.blocked.down || body.touching.down;
    const wallDirection = wallContactDirection(body.blocked.left, body.blocked.right);
    if (grounded) {
      this.groundedAt = now;
      if (dashRefreshAllowed(now, this.dashCooldownReadyAt, grounded)) this.dashAvailable = true;
    }
    if (input.pressed.jump) this.jumpBufferedUntil = now + MOVEMENT.jumpBufferMs;

    if (input.moveX !== 0 && wallJumpFacingInputAllowed(now, this.wallJumpLockUntil)) {
      this.facing = input.moveX < 0 ? -1 : 1;
    }
    if (canStartDash(abilities.phaseDash, this.dashAvailable, input.pressed.dash)) {
      this.startDash(now, input.moveX);
    }

    if (now < this.dashEndsAt) {
      body.setAllowGravity(false);
      this.setAcceleration(0, 0).setVelocity(dashVelocity(this.facing), 0);
      this.movementStateValue = 'dash';
      this.setTint(0x8ce7ff).setAlpha(0.82);
      this.play('iya-dash', true);
      return;
    }

    if (!body.allowGravity) body.setAllowGravity(true);
    body.setMaxVelocity(MOVEMENT.speed, MOVEMENT.maxFallSpeed);
    this.clearTint();

    if (now < this.wallJumpLockUntil) {
      this.setAccelerationX(0);
    } else if (input.moveX !== 0) {
      this.setFlipX(this.facing < 0);
      this.setAccelerationX(horizontalAcceleration(input.moveX));
    } else {
      this.setAccelerationX(0);
    }

    if (
      canWallJump(abilities.magneticGrip, grounded, wallDirection, this.jumpBufferedUntil >= now)
    ) {
      const velocity = wallJumpVelocity(wallDirection);
      this.setVelocity(velocity.x, velocity.y);
      this.facing = velocity.x < 0 ? -1 : 1;
      this.setFlipX(this.facing < 0);
      this.wallJumpLockUntil = now + 120;
      this.jumpBufferedUntil = Number.NEGATIVE_INFINITY;
      this.wallJumpSerialValue += 1;
    } else if (canConsumeJump(now, this.groundedAt, this.jumpBufferedUntil)) {
      this.setVelocityY(MOVEMENT.jumpVelocity);
      this.jumpBufferedUntil = Number.NEGATIVE_INFINITY;
      this.groundedAt = Number.NEGATIVE_INFINITY;
    }

    if (input.released.jump) this.setVelocityY(shortenedJumpVelocity(body.velocity.y));

    const wallSliding = canWallSlide(
      abilities.magneticGrip,
      grounded,
      wallDirection,
      body.velocity.y,
    );
    if (wallSliding) this.setVelocityY(cappedWallSlideVelocity(body.velocity.y));

    this.updateState(grounded, delta, wallSliding);
    this.playMovementAnimation(now);
  }

  public get facingDirection(): -1 | 1 {
    return this.facing;
  }

  public get movementState(): PlayerMovementState {
    return this.movementStateValue;
  }

  public get wallJumpSerial(): number {
    return this.wallJumpSerialValue;
  }

  public get isGrounded(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
  }

  public isDashInvulnerable(now: number): boolean {
    return now < this.dashInvulnerableUntil;
  }

  public playAction(animation: PlayerActionAnimation): void {
    const duration = animation === 'shoot' ? 150 : animation === 'slash' ? 220 : 180;
    this.actionLockedUntil = this.scene.time.now + duration;
    this.play(`iya-${animation}`, true);
  }

  public resetTraversalState(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.dashEndsAt = 0;
    this.dashCooldownReadyAt = 0;
    this.dashInvulnerableUntil = 0;
    this.dashAvailable = true;
    this.actionLockedUntil = 0;
    this.wallJumpLockUntil = 0;
    // 不清掉这两个的话，换房或重生后会立刻消费上个房间残留的跳跃缓冲、
    // 或者凭空得到一次土狼跳。
    this.jumpBufferedUntil = Number.NEGATIVE_INFINITY;
    this.groundedAt = Number.NEGATIVE_INFINITY;
    body.setAllowGravity(true);
    body.setMaxVelocity(MOVEMENT.speed, MOVEMENT.maxFallSpeed);
    this.clearTint().setAlpha(1);
    this.play('iya-idle', true);
  }

  private startDash(now: number, inputX: number): void {
    if (inputX !== 0) this.facing = inputX < 0 ? -1 : 1;
    this.setFlipX(this.facing < 0);
    this.dashAvailable = false;
    this.dashEndsAt = now + DASH.durationMs;
    this.dashCooldownReadyAt = now + DASH.cooldownMs;
    this.dashInvulnerableUntil = now + DASH.invulnerabilityMs;
    (this.body as Phaser.Physics.Arcade.Body).setMaxVelocity(DASH.speed, MOVEMENT.maxFallSpeed);
  }

  private updateState(grounded: boolean, delta: number, wallSliding: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (wallSliding) this.movementStateValue = 'wallSlide';
    else if (!grounded) this.movementStateValue = body.velocity.y < 0 ? 'jump' : 'fall';
    else if (Math.abs(body.velocity.x) > 8) this.movementStateValue = 'run';
    else this.movementStateValue = 'idle';

    const runBob = this.movementStateValue === 'run' ? Math.sin(this.scene.time.now / 55) : 0;
    this.setScale(1, 1 + runBob * 0.025);
    this.setAlpha(this.movementStateValue === 'fall' ? 0.94 : 1);
    this.rotation = Phaser.Math.Linear(this.rotation, 0, Math.min(1, delta / 80));
  }

  private playMovementAnimation(now: number): void {
    if (now < this.actionLockedUntil) return;
    const animation = this.movementStateValue === 'wallSlide' ? 'fall' : this.movementStateValue;
    this.play(`iya-${animation}`, true);
  }
}
