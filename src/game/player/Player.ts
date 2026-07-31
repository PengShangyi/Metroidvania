import Phaser from 'phaser';

import type { ActionSnapshot } from '../input/actions';
import {
  canConsumeJump,
  horizontalAcceleration,
  MOVEMENT,
  shortenedJumpVelocity,
} from './movementMath';

export type PlayerMovementState = 'idle' | 'run' | 'jump' | 'fall';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private groundedAt = Number.NEGATIVE_INFINITY;
  private jumpBufferedUntil = Number.NEGATIVE_INFINITY;
  private facing: -1 | 1 = 1;
  private movementStateValue: PlayerMovementState = 'idle';

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

  public updateMovement(delta: number, input: ActionSnapshot): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.groundedAt = now;
    if (input.pressed.jump) this.jumpBufferedUntil = now + MOVEMENT.jumpBufferMs;

    if (input.moveX !== 0) {
      this.facing = input.moveX < 0 ? -1 : 1;
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
