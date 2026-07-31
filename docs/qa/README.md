# 视觉验收基线

本目录保存关键流程的 Chromium 实机截图。`low-res-*.png` 使用与游戏逻辑画布一致的
`480×270` 浏览器视口直接截取，没有先放大再缩小，用于检查最低目标分辨率下的中文笔画、
按钮标签、双栏帮助说明和换行间距。

低分辨率基线包括：

- `low-res-title.png`：标题页与四个主菜单入口；
- `low-res-tutorial.png`：训练关卡的目标、按键提示与效果说明；
- `low-res-help-keyboard.png`：键盘/鼠标帮助页；
- `low-res-help-gamepad.png`：手柄帮助页；
- `low-res-shield-open.png`：冲刺结束后，盾兵核心和玩家位于正确相对侧；
- `low-res-reflect.png`：挥砍弧、反射弹和局部火花；
- `low-res-piercing-armed.png`：琥珀武装轮廓及同一直线上的两个正式目标。

`combat-shield-open.png`、`combat-reflect.png` 和 `combat-piercing-armed.png` 保存相同三种
状态的 960×540 基线。`title.png` 是当前版本标题，`v0.1-title.png` 保留上一个标签的标题
快照，避免历史验收记录随新版截图漂移。

自动旅程还会在 Chromium、Firefox 和 WebKit 的 `480×270` 视口验证画布尺寸、训练入口、
帮助页开关及最近输入设备切换。截图如因有意 UI 调整而更新，应再次以 100% 缩放逐张检查，
确保所有汉字可辨认且没有裁切、重叠或溢出。
