# Windows x64 测试包

## 保留的基础

分支 `build/windows-test` 基于 `6b56dec`。`1e56da4`（Fish/Qwen、安全 Key、音频路由）、`2ac456f`（Windows 托盘）、`6b56dec`（阶段一文档）均为祖先提交，无重新实现或覆盖。OBS、AI、全部 Play 的原逻辑与资源均保留。

## 下载位置

用户仓库（不是上游官方仓库）：
https://github.com/lt1605621529-create/livelink/actions/workflows/windows-test.yml

打开 **Windows Test Build** 的最新成功运行，确认分支 `build/windows-test` 和提交号，在页面底部 **Artifacts** 下载：

- `LiveLink-Test-win-x64-portable-<运行编号>`：优先使用。解压 ZIP 后运行 `LiveLink-Test-1.9.0-x64-portable.exe`。
- `LiveLink-Test-win-x64-nsis-<运行编号>`：安装包 `LiveLink-Test-1.9.0-x64-setup.exe`。

需登录有仓库权限的 GitHub 账号。Artifacts 保留 14 天。每份包含 `SHA256SUMS.txt` 与 `BUILD-INFO.txt`（源码 SHA/运行 ID/架构）。校验可使用 PowerShell `Get-FileHash <exe路径> -Algorithm SHA256`。没有成功运行时没有可下载文件，不能将工作流链接视为现成安装包。

工作流支持该分支 push 自动触发；首次可通过 push 运行，无需将工作流合并到 main。`workflow_dispatch` 的网页手动入口通常要求工作流先存在于默认分支，本阶段不为此合并默认分支。需要重建可推送新提交至该分支。

## 隔离

- 名称/安装目录/快捷方式：LiveLink Test；可执行文件：LiveLink-Test.exe。
- AppId 与 AUMID：`io.jspider.livelink.test`。
- 数据目录：`%APPDATA%\LiveLink-Test`，与正式版和 `LiveLink-Development` 分离；不会导入或修改正式版观众/钱包/宠物/登录态/Key。
- 编译时嵌入测试标识，安装后不需要环境变量。打包前 hook 拒绝非测试构建，防止误将生产构建打成测试包。
- Portable 与 NSIS 测试版共享测试数据目录；便携表示免安装，不表示数据保存在 exe 旁。卸载不删除数据。
- 与正式版同时运行时本地 OBS 端口可能自动递增；请从测试版首页复制实际 URL，不覆盖原 OBS 浏览器源。

## 构建与验证

Windows CI：Node 24.22.1、pnpm 11.25.0、frozen lockfile；官方 Electron 下载地址。便携和 NSIS 独立矩阵任务，失败互不取消；无 Release 权限，显式 `--publish never`，只上传 Artifacts。

执行 `pnpm typecheck`、`pnpm test`（336 项离线断言）、`pnpm verify:tts-settings`（实际 Electron 配置保存/重新读取、Windows DPAPI 加密与删除）、`pnpm build:test`，然后分别执行：

```
pnpm exec electron-builder --win portable --x64 --config electron-builder.test.yml --publish never
pnpm exec electron-builder --win nsis --x64 --config electron-builder.test.yml --publish never
```

本地打包可运行 `pnpm package:test` 同时生成两种包。不要使用原 `pnpm package`，它保留正式版标识。

`verify:reconnect` 需要正在直播的房间和网络，不在 CI 自动执行，以免将外部平台状态当作构建成功条件。不需要在 CI 配置 Fish、百炼或 DeepSeek Key。测试存储使用固定的无效测试字符串，临时目录运行完删除。Windows 包默认未签名，SmartScreen 可能提示；仅在确认仓库运行和 SHA256 后使用。

## Windows 实机步骤

1. 记录正式版原有钱包/观众/宠物状态。下载便携 Artifact，校验 SHA256，解压启动。确认窗口名为 LiveLink Test，并只创建 `%APPDATA%\LiveLink-Test`。
2. 进入语音页，分别选择 Edge、Fish、Qwen；修改模型、音色、语速和事件音色，切页并退出重启确认保持。自行在应用内填写 Key；不得发到聊天或 GitHub。检查配置文件中无 Key 明文。
3. 三种服务分别试听；百炼选择与账户一致地域。Qwen 当前语速采用本地 playbackRate。Key 错误或模型/音色不兼容应显示失败，不自动切换付费服务。
4. 选择 CABLE Input；在 OBS 独立测试场景采集 CABLE Output。验证朗读、默认扬声器切换、拔插/禁用设备后的失败提示与重新选择。云端无硬件，未验证成功路由。
5. 使用测试房间连接弹幕，检查低优先级朗读、礼物/SC 优先、DeepSeek 自动回复。最小化、点关闭隐藏到托盘后持续测试，双击托盘恢复。
6. 在独立 OBS 场景粘贴测试版 URL，验证欢迎、礼物、抽奖、投票、赛马、竞猜、宠物、点歌和哈松币钱包及动画。不导入/重置正式数据。
7. 从托盘选择退出，确认进程与服务端口释放；重启确认测试数据保留。最后再测试 NSIS 安装/卸载，确认快捷方式和正式版数据不受影响。
