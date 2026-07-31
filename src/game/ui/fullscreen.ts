import Phaser from 'phaser';

export function bindFullscreenKey(scene: Phaser.Scene): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return;

  const key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
  const toggle = (): void => {
    if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
    else void scene.scale.startFullscreen();
  };

  key.on('down', toggle);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    key.off('down', toggle);
    keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.F);
  });
}
