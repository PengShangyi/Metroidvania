import Phaser from 'phaser';

export function bindFullscreenKey(scene: Phaser.Scene): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return;

  const key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
  // scale.isFullscreen 读的是 document.fullscreenElement，它要等浏览器完成转场才更新。
  // 在那之前再按一次 F，Phaser 就会发出第二个 requestFullscreen()——而它把返回的 Promise
  // 直接丢掉了，被拒绝就是一个未捕获拒绝。自己记一下转场有没有落定，别让它发生。
  // 存的是截止时间而不是布尔量：万一某个浏览器既不落定也不报错，1 秒后也会自动解封，
  // F 键不会就此变成哑键。用 performance.now() 是因为场景时钟会随暂停停走。
  let pendingUntil = 0;
  const settle = (): void => {
    pendingUntil = 0;
  };
  const toggle = (): void => {
    const now = performance.now();
    if (now < pendingUntil) return;
    pendingUntil = now + 1_000;
    if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
    else scene.scale.startFullscreen();
  };

  key.on('down', toggle);
  scene.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, settle);
  scene.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, settle);
  scene.scale.on(Phaser.Scale.Events.FULLSCREEN_FAILED, settle);
  scene.scale.on(Phaser.Scale.Events.FULLSCREEN_UNSUPPORTED, settle);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    key.off('down', toggle);
    keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.F);
    // ScaleManager 归 Game 所有、不随场景销毁：这几个监听不摘掉就会一局一局往上叠。
    scene.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, settle);
    scene.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, settle);
    scene.scale.off(Phaser.Scale.Events.FULLSCREEN_FAILED, settle);
    scene.scale.off(Phaser.Scale.Events.FULLSCREEN_UNSUPPORTED, settle);
  });
}
