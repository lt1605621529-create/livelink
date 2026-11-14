# AI Key 保存：Context Bridge 克隆错误修复

## 已确认原因

#8 的 AiReply.vue 使用 `{ ...config.value }`。顶层虽然是普通对象，keywords 仍是 Vue reactive 数组。Electron 在 Renderer 调用 contextBridge 导出的函数时就需要复制参数，嵌套 Proxy 在这个边界被拒绝。位于 preload 函数体内部的 cleanForIpc 尚未执行，所以 JSON 序列化兜底无法处理这次错误。

真实 Electron/Vue 重现：普通配置成功（preload invoke/main handler 各进入一次）；直接 Proxy 与浅拷贝后的嵌套 Proxy 均失败，preload invoke/main handler 计数均不增加。普通配置的主进程保存和响应 structuredClone 正常。故障属于 Renderer → Context Bridge，不是 safeStorage 或 IPC 响应克隆失败。

## 修改

- `src/shared/ai-reply.ts`：toAiReplyPatchDto 明确列出可编辑字段，Array.from 复制 keywords，在 Renderer 中完成普通 JSON DTO 构造；不发送 hasApiKey/apiKeyHint。空输入省略 apiKey，清除仍显式传空串。
- `src/renderer/pages/AiReply.vue`：桥接调用前构造 DTO；仅在主进程确认已保存后更新状态并清空输入。失败保留输入和原状态，不显示成功；凭据操作不向界面回显任意异常文本。
- `src/shared/ipc-dto.ts`、`src/preload/index.ts`：严格复制 JSON 数据，拒绝循环、函数、非有限数、自定义类型等；不再返回不可克隆原对象，不记录原始数据或异常内容。此 helper 不能补救进入 preload 前就被 contextBridge 拒绝的 Proxy。
- `src/main/config/ai-reply-ipc.ts`、`src/main/ipc.ts`：提取同一生产配置 Handler 供真实 IPC 测试使用，保护错误摘要和普通响应 DTO；实际配置写入仍由 AppConfig.patchAiReply 完成，Key 仍只由主进程 safeStorage 加密保存。
- `src/renderer/types.ts`：配置 patch 类型使用主配置 DTO，排除公开只读 Key 状态字段。

未修改规则 CRUD、事件映射、Fish/Qwen/Edge、Play、AI 调用逻辑或用户数据目录；没有迁移或重建用户配置。

## 验证

- `pnpm verify:ai-dto`：真正的 Vue reactive 配置、嵌套 keywords 复制、可 structuredClone 的 DTO、不带只读元数据、Key 省略语义、无效类型/循环/敏感 getter 错误安全拒绝。
- `pnpm verify:ai-ipc`：真实 Electron contextIsolation/contextBridge、生产 preload、生产配置 IPC Handler、AppConfig、实际 AiReply.vue 页面。包含原错误的负例边界计数、普通配置保存、DTO/keywords 往返、preload 失败、响应序列化、注入写入失败后输入与错误状态检查。
- Windows 同一测试使用 safeStorage/DPAPI，虚构测试 Key 在实际页面保存/清除，并重新读取 hasApiKey/apiKeyHint；检查磁盘密文、新 AppConfig 实例读取、其他设置保存不覆盖 Key。Linux 无密钥环时仅验证拒绝保存，不能把这条路径称为加密成功。
- 其余 `pnpm typecheck`、`pnpm build:test`、`pnpm test`、`verify:tts-settings`、`verify:rule-persistence`、`verify:rule-overlay` 均纳入验证。重新检查真实规则 CRUD 界面，确认严格 preload 清理没有破坏其操作。

测试目录位于操作系统临时目录，使用虚构 Key；不读取用户真实 Key，不调用 DeepSeek API。Chromium 可能在退出前持有缓存文件，因此临时浏览器 profile 留待系统临时目录清理。测试工具不随产品打包。

## 下载与复测

代码分支：`fix/ai-key-ipc`。Windows 工作流只上传 Portable/NSIS Artifacts，禁止公开 Release；不修改或合并 main。

在 https://github.com/lt1605621529-create/livelink/actions/workflows/windows-test.yml 选择本分支最新成功运行，下载对应运行编号的 `LiveLink-Test-win-x64-portable-<编号>` 或 `LiveLink-Test-win-x64-nsis-<编号>`。

复测先关闭旧测试版，从新 Portable 启动。在 AI 页填写自己的 Key 并保存，确认已保存状态后关闭/重启，验证状态保持；修改关键词或冷却后保存，确认无需再次填写 Key；最后按需要清除。不要向聊天、日志或仓库提交 Key。
