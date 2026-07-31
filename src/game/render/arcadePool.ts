import type Phaser from 'phaser';

export function activateArcadeImage(
  image: Phaser.Physics.Arcade.Image,
  texture: string,
  x: number,
  y: number,
): Phaser.Physics.Arcade.Image {
  image
    .setTexture(texture)
    .setPosition(x, y)
    .setScale(1)
    .setAlpha(1)
    .setAngle(0)
    .setFlip(false, false)
    .clearTint()
    .setData('damage', 0)
    .setData('expiresAt', 0);
  image.enableBody(true, x, y, true, true);
  const body = image.body as Phaser.Physics.Arcade.Body;
  body
    .setAllowGravity(false)
    .setVelocity(0, 0)
    .setAcceleration(0, 0)
    .setSize(image.width, image.height, true);
  return image;
}

export function releaseArcadeImage(image: Phaser.Physics.Arcade.Image): void {
  if (!image.active) return;
  const body = image.body as Phaser.Physics.Arcade.Body;
  body.setVelocity(0, 0).setAcceleration(0, 0);
  image.setData('damage', 0).setData('expiresAt', 0).disableBody(true, true);
}

export function releaseArcadeGroup(group: Phaser.Physics.Arcade.Group): void {
  group.children.each((child) => {
    releaseArcadeImage(child as Phaser.Physics.Arcade.Image);
    return true;
  });
}
