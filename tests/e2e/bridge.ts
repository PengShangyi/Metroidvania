import type {
  CombatTestScenario,
  StarEchoTestBridge,
  TestSnapshot,
  TypographyTestSnapshot,
} from '../../src/game/testing/installTestBridge';

export type { CombatTestScenario, StarEchoTestBridge, TestSnapshot, TypographyTestSnapshot };

/**
 * 桥接契约的唯一定义在 src/game/testing/installTestBridge.ts。四个 spec 此前各自手抄了
 * 一份副本，于是连桥的公开签名改了都没有编译期反馈——CLAUDE.md 已经警告过改私有成员
 * 会静默弄坏 e2e，手抄类型让公开签名也掉进同一个坑。
 *
 * 桥只在 test 模式下安装，spec 都会先 waitForFunction 等它出现，所以这里不是可选的。
 */
export type TestWindow = Window & { __STAR_ECHO_TEST__: StarEchoTestBridge };
