# 第一阶段：TTS 与后台常驻

开发分支：`feat/tts-providers-background`。本阶段不发布 Release、不运行安装器、不推送官方仓库。

## 模块与兼容性

- `src/main/tts/providers.ts`：Fish Audio 和百炼 Qwen HTTP 适配器，返回音频 Buffer，复用现有优先级、队列、预合成、过期和错误统计。
- `src/shared/tts-providers.ts`：服务配置；Edge 是旧配置默认值。Fish/Qwen 分别保存模型、全局音色和事件覆盖，不破坏原有 Edge 配置。弹幕朗读页原有 Edge 音色覆盖在云服务下使用云服务全局音色；事件覆盖可在 TTS 页设置。
- `src/main/tts/credentials.ts`：Key 单独经 Electron safeStorage 加密（Windows DPAPI）。界面仅获得配置状态；Linux basic_text / 无密钥环时拒绝保存。清空 Key 可显式删除。DeepSeek 原有明文 Key 在可用安全存储下迁移为密文，安全存储不可用时停止使用该 Key，不降低为明文。
- `src/main/actions/tts.ts`、`src/audio/index.html`：隐藏音频窗口关闭后台节流，枚举 audiooutput，使用 HTMLMediaElement.setSinkId；选择失效设备时显示播放失败，不静默转到错误设备。系统默认可随时恢复。
- `src/main/tray.ts`、`src/main/index.ts`：Windows 关闭窗口隐藏至托盘；双击恢复；托盘菜单明确退出并清理连接、游戏、TTS 与 AI 服务。托盘初始化失败时正常关闭。非 Windows 保留原窗口关闭语义。
- `src/renderer/pages/TTSSettings.vue`、IPC/preload/types：服务、模型、音色、地域、Key 状态/保存/删除、设备选择与试听。

开发启动（`pnpm dev --noSandbox`，云容器专用参数）使用 `LiveLink-Development` 数据目录，不读取/覆盖正式安装数据。未打包、安装或修改任何用户正式配置。打包程序目前仍使用原应用标识，**不要直接用默认 NSIS 覆盖现有安装**。

## 官方接口依据

2026-11-13 核对厂商官方 SDK：

- Fish：<https://github.com/fishaudio/fish-audio-python>，`src/fishaudio/resources/tts.py` 和 `types/tts.py`。POST `https://api.fish.audio/v1/tts`，Bearer，`model` header，MessagePack 的 text/reference_id/format/prosody.speed；固定默认 s2-pro，可输入账户支持的其他模型。
- Qwen：<https://github.com/dashscope/dashscope-sdk-python>，`tests/test_audio_tts_http.py` 中 qwen3-tts-flash 原生 HTTP 合约。POST `/api/v1/services/aigc/multimodal-generation/generation`，input.text/voice/language_type，读取 output.audio.url 并独立下载。支持北京和国际（新加坡）域名，凭据不发送到音频下载 URL，拒绝非 HTTPS/非阿里域名与重定向。
- 官方文档入口：<https://docs.fish.audio/>、<https://help.aliyun.com/zh/model-studio/qwen-tts-api>。云端访问文档站被策略拒绝，因此使用官方 SDK 验证合约。

Fish 语速在服务端 prosody 中调整；Qwen Flash 使用本地 playbackRate 调整（不伪造未证实的服务端参数）。第三方调用失败不自动切到其他服务，以免产生意外计费。

## 验证

执行 `pnpm typecheck`、`pnpm build`、`pnpm verify:tts` 和原有 `verify:reader`、`verify:song`、`verify:assets`、`verify:ai-reply`、`verify:danmu-display`、`verify:welcome`。

新增测试覆盖 Fish MessagePack/模型/鉴权请求、Qwen 地域和返回音频下载、下载不传 Key、401/403/429/500、安全错误摘要、空音频、缺 Key、恶意下载地址。测试均使用本地模拟，不调用计费 API。

云端实际启动 Electron，验证首页、IPC、三种配置切换、缺 Key 错误、本地 OBS health。Linux 无实际输出设备，枚举返回空列表。

## 未验证与 Windows 下一步

1. 云端没有 Fish/百炼账户 Key，未验证真实合成质量、模型可用性和计费。需用户在 Windows 应用中安全输入 Key，按模型可用音色试听；不要通过聊天发送 Key。
2. `verify:reconnect` 要求真实开播房间和 B 站网络，不属于本次离线测试。现有 B 站在线礼物接口仍被云网络策略阻止。
3. Windows 实机验证：扬声器与 CABLE Input 分别试听；OBS 选择 CABLE Output；热拔插、默认设备切换、重启设备 ID 持久化。Chromium 枚举权限或驱动限制可能影响可选设备，不能视为已成功路由。
4. Windows 实机验证：最小化/关闭后持续弹幕、礼物优先级、DeepSeek 回复和所有 Play 动画；托盘恢复；明确退出后进程和端口释放；系统注销/关机。
5. 先创建独立测试打包配置（不同 appId/productName/数据目录），使用 portable 或目录包，不运行默认 NSIS 安装器。用合成弹幕验证抽奖、投票、赛马、竞猜、宠物、点歌和钱包。通过实机验收后再考虑正式安装迁移。
6. Electron 31 是上游既有版本，本阶段未升级。后续单独评估 Electron 安全升级，避免与本次 TTS 修改混合。
