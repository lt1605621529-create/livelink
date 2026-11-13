# 自定义规则 CRUD 测试版

## 保护性检查

从干净的 `build/windows-test`（`6ff9fa2`）创建 `feature/rule-crud`。`1e56da4`、`2ac456f`、`6b56dec` 均存在且为祖先。未重置、重写或删除既有提交。沿用 LiveLink Test 的应用标识与独立数据目录；未改变 Fish/Qwen/Edge、DeepSeek、钱包、宠物及 Play 逻辑和用户数据。

## 使用

规则页顶部「新增规则」或任一分类「添加规则」打开编辑器。支持现有七种用户互动：进房、弹幕、礼物、上舰、关注、SC、盲盒。分类始终保留；保存后按事件归类。`room.stats` 是高频房间统计，不是用户互动，不开放自动播报规则；SDK 中尚未映射的点赞/分享不会被虚假列为可用事件。

可编辑名称、事件、启用状态、全局/用户冷却、总是/关键词任一或全部/正则/粉丝牌匹配，以及日志、TTS、Overlay、盲盒查询和钱包查询动作。动作可以添加/移除，复制产生独立 ID 和默认禁用的副本，保存后才落盘。取消编辑不会写入。

关键词/正则匹配弹幕与 SC 文本、礼物/上舰礼物名、盲盒及奖励名。进房/关注没有文本，选择总是或粉丝牌条件。进房的粉丝牌信息受 B 站协议缺字段限制。粉丝牌匹配仍使用原有规则引擎。

Overlay 选择「自定义文字横幅」可在所有互动事件上显示模板文本；选择「原生效果」继续使用已有礼物等动画。原生事件不一定有专用动画，关注/回复建议使用自定义横幅。旧 Overlay payload 的其他字段保留。多个规则命中同一事件时分别执行，可能产生重复播报/画面，请用冷却或禁用调整。

规则经原有 IPC 保存至 `livelink-config.json` 的 rules 数组；保存成功后再更新运行中引擎。无重建默认列表、无用户数据迁移。新规则编辑有前后端验证，非法关键词、无效正则、负冷却等在写入前拒绝。

## 实现

- `src/shared/rule-types.ts`、`rules.ts`：前后端共用规则类型、事件目录、创建/复制和校验。
- `src/renderer/pages/Rules.vue`、`components/RuleEditor.vue`：CRUD 和可复用编辑器。
- `src/main/config/store.ts`、`ipc.ts`：沿用原有持久化和引擎实时更新。
- `src/main/platform/bilibili-events.ts`：从原适配器原样提取已有事件转换，供生产回调与测试共同使用；`bilibili.ts` 的连接/重连/心跳保持原实现。
- `src/main/rules/engine.ts`：复用匹配/冷却/动作派发，仅补充礼物/盲盒可匹配文本并明确忽略统计事件。
- `src/overlay/App.vue`：新增 `rule.message` 文字横幅监听，复用已有 banner，原动画未替换。

## 验证

- `pnpm typecheck`、`pnpm build:test`、`pnpm test`：原 336 项加新 78 项，共 414 项离线断言。
- `pnpm verify:rule-persistence`：实际 Electron 下 22 项 CRUD、重新实例化配置、拒绝非法写入、保留原规则与 TTS 设置。
- `pnpm verify:rule-overlay`：实际 B 站适配回调 → bus → 引擎 → dispatcher → Socket.IO → 浏览器 OBS DOM，同时验证日志和 TTS 文本（3 项）。测试不调用付费语音 API。
- `pnpm verify:tts-settings`：原有三服务配置与密钥安全存储验证。
- Linux 云端还通过实际规则页面操作检查创建、编辑事件归类、复制、启用/禁用、删除及保留默认规则，使用临时测试数据目录。

原始真实 B 站联网 `verify:reconnect` 需要当前开播房间，未自动运行；上述映射测试使用 SDK 形状的模拟事件，但执行生产事件转换、引擎和 dispatcher。Fish/Qwen 的真实合成及 Windows 声卡、托盘常驻仍需实机验证。

## 新 Windows 测试包

工作流 `.github/workflows/windows-test.yml` 已增加 `feature/rule-crud` 自动触发，并运行新增的持久化和 OBS DOM 测试，再分别生成 x64 portable / NSIS。只上传 Artifacts，显式禁止 Release 发布。

在 https://github.com/lt1605621529-create/livelink/actions/workflows/windows-test.yml 选择 **feature/rule-crud** 的最新成功运行，底部下载 `LiveLink-Test-win-x64-portable-<编号>`（优先）或 `LiveLink-Test-win-x64-nsis-<编号>`。登录 GitHub，解压后对照 SHA256SUMS 校验，具体命名和隔离约定见 `WINDOWS_TEST_BUILD.md`。

实机先保存现有自定义配置备份（不要覆盖正式 LiveLink 数据）。新增一条关注规则和一条关键词规则，配置三种动作；连接测试房间，验证日志、所选 TTS 服务和独立 OBS 测试场景画面；编辑关键词与冷却，检查不匹配不触发和同用户限流；重启验证保存；复制并启用，最后只删除自己新建的规则。不要删除现有预置规则来测试空分类，关注/上舰/盲盒等空分类本身即可用于验证。
