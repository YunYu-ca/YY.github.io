# Game5 云存档同步 —— Cloudflare Worker 部署说明（免费）

把游戏的存档**自动**保存到你的 GitHub 仓库 `Game5Saves/{用户名}/save.json`，
并在换设备登录时自动恢复。密钥只放在服务端，前端代码里没有任何密钥。

## 原理

```
浏览器(游戏) --GET/POST--> Cloudflare Worker(免费) --GitHub Contents API--> 你的仓库
                                   └── GITHUB_TOKEN 只存在这里，前端永远看不到
```

- 每次存档变化，前端自动推送到云端（3 秒防抖）。
- 每次登录，前端自动从云端拉取（云端比本地新才覆盖）。
- 账号（密码盐+哈希）也会同步到 `Game5Accounts/{用户名}.json`，
  换设备用同一账号+密码登录即可恢复全部进度。

## 部署步骤（约 5 分钟，免费，无需绑卡）

1. 打开 <https://dash.cloudflare.com/>，注册或登录（免费账号即可）。

2. 左侧「Workers & Pages」→「创建」→「创建 Worker」→ 名称填如 `lucky-chip-sync`，
   选择「Hello World」模板进入编辑。

3. 把 `worker.js` 的**全部内容**复制粘贴进去，替换掉模板代码。

4. 配置 3 个环境变量（「设置」→「变量和机密」）：
   - `GITHUB_TOKEN` —— 你的 GitHub 令牌（见下方「令牌说明」）
   - `REPO_OWNER`  = `YunYu-ca`
   - `REPO_NAME`   = `YunYu-ca.github.io`

5. 点击右上角「部署」→「Deploy」。部署后记下 Worker 的访问地址，形如：
   `https://lucky-chip-sync.<你的子域>.workers.dev`

6. 打开游戏（`https://yunyu-ca.github.io/game5/`）→ 右下角/顶部「设置」→「存档备份」→
   「云存档同步」：
   - 在地址框粘贴上面的 Worker 地址
   - 点「保存并测试」→ 看到「连接成功」即可
   - 之后存档变化会自动同步，登录自动恢复。

## 令牌说明（GITHUB_TOKEN）

强烈建议创建一个**细粒度（Fine-grained）**令牌，只给这一个仓库权限：

- 入口：<https://github.com/settings/tokens> → 「Generate new token」→「Fine-grained」
- Repository access：只选 `YunYu-ca/YunYu-ca.github.io`
- Permissions → Repository permissions → Contents：**Read and write**
- 生成后把 `github_pat_...` 填进上面的 `GITHUB_TOKEN` 变量。

> ⚠️ 安全提醒：本地源码目录 `.env` 里的 `GAME_GITHUB_TOKEN`（旧 ghp_ 令牌）本次已被用于
> 推送新构建。请到 GitHub 撤销该令牌并重新生成一个（细粒度、仅本仓库、Contents:write），
> 同时更新 `.env` 和 Cloudflare 的 `GITHUB_TOKEN`。不要在聊天或代码里明文保留令牌。

## 常见问题

- **连接失败/401**：检查 `GITHUB_TOKEN` 是否正确、权限是否为 Contents: Read and write。
- **403 跨域**：确认你是从 `https://yunyu-ca.github.io` 或本机 localhost 打开游戏。
- **想清空云端存档**：直接在仓库里删 `Game5Saves/{用户名}/` 或 `Game5Accounts/{用户名}.json`。

## 本地自测（可选）

`mock-worker.js` 是本地模拟云函数的服务（端口 8140），数据落在 `.mock-repo/`。
启动：`node mock-worker.js`，然后把游戏设置里的云同步地址填 `http://127.0.0.1:8140` 即可。
