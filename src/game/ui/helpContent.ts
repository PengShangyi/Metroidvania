import type { InputDevice } from '../input/device';
import type { TutorialStepId } from '../tutorial/tutorialPlan';

export interface HelpRow {
  action: string;
  control: string;
  description: string;
}

export interface HelpGroup {
  title: string;
  rows: readonly HelpRow[];
}

export const HELP_CONTENT: Record<InputDevice, readonly HelpGroup[]> = {
  keyboardMouse: [
    {
      title: '移动与战斗',
      rows: [
        { action: '移动', control: 'A/D · ←/→', description: '横向移动' },
        { action: '跳跃', control: 'SPACE', description: '按住跳得更高' },
        { action: '能量枪', control: 'J', description: '墙跳首发贯穿' },
        { action: '能量刃', control: 'K', description: '前 80ms 反射炮弹' },
        { action: '相位冲刺', control: 'SHIFT', description: '穿盾开核 · 短暂无敌' },
      ],
    },
    {
      title: '探索与系统',
      rows: [
        { action: '交互', control: 'E', description: '终端、通道、记录' },
        { action: '地图', control: 'TAB', description: '探索地图' },
        { action: '暂停', control: 'ESC', description: '暂停与设置' },
        { action: '帮助', control: 'H', description: '随时打开本页' },
        { action: '全屏', control: 'F', description: '浏览器全屏' },
      ],
    },
  ],
  gamepad: [
    {
      title: '移动与战斗',
      rows: [
        { action: '移动', control: '左摇杆/D-pad', description: '横向移动' },
        { action: '跳跃', control: 'A', description: '按住跳得更高' },
        { action: '能量枪', control: 'X', description: '墙跳首发贯穿' },
        { action: '能量刃', control: 'Y', description: '前 80ms 反射炮弹' },
        { action: '相位冲刺', control: 'B', description: '穿盾开核 · 短暂无敌' },
      ],
    },
    {
      title: '探索与系统',
      rows: [
        { action: '交互', control: 'RB', description: '终端、通道、记录' },
        { action: '地图', control: 'VIEW', description: '探索地图' },
        { action: '暂停', control: 'MENU', description: '暂停与设置' },
        { action: '帮助', control: 'LB', description: '随时打开本页' },
        { action: '菜单选择', control: '鼠标', description: '点击菜单按钮' },
      ],
    },
  ],
};

const TUTORIAL_CONTROLS: Record<TutorialStepId, Record<InputDevice, string>> = {
  move: { keyboardMouse: 'A / D 或方向键', gamepad: '左摇杆或 D-pad' },
  jump: { keyboardMouse: 'SPACE', gamepad: 'A' },
  weapons: { keyboardMouse: 'J 射击，K 近战', gamepad: 'X 射击，Y 近战' },
  reflect: { keyboardMouse: '弹体接近时按 K', gamepad: '弹体接近时按 Y' },
  dash: { keyboardMouse: 'SHIFT', gamepad: 'B' },
  shield: { keyboardMouse: 'SHIFT 穿越，J/K 攻击', gamepad: 'B 穿越，X/Y 攻击' },
  wallJump: { keyboardMouse: '贴墙后按 SPACE', gamepad: '贴墙后按 A' },
  piercing: { keyboardMouse: '墙跳后按 J', gamepad: '墙跳后按 X' },
  interact: { keyboardMouse: 'E', gamepad: 'RB' },
};

export function inputDeviceLabel(device: InputDevice): string {
  return device === 'gamepad' ? '手柄' : '键盘与鼠标';
}

export function tutorialControlHint(step: TutorialStepId, device: InputDevice): string {
  return TUTORIAL_CONTROLS[step][device];
}
