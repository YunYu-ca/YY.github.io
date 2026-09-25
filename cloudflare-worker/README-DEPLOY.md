# Game5 云存档同步 —— 部署状态（已完成）✅

把游戏的存档**自动**保存到你的 GitHub 仓库 `Game5Saves/{用户名}/save.json`，
并在换设备登录时自动恢复。密钥只放在服务端，前端代码里没有任何密钥。

## ✅ 当前状态

- **Worker 已部署**：`lucky-chip-sync`
- **Worker 地址**：`https://lucky-chip-sync.3837782838.workers.dev`
- **环境变量**：`REPO_OWNER=YunYu-ca`、`REPO_NAME=YunYu-ca.github.io`、`GITHUB_TOKEN`（机密，已设）
- **前端地址已锁定**：`client/src/api/cloud-sync.ts` 的 `LOCKED_SYNC_URL` 已写死为上面的地址，
  已构建并推上线（`https://yunyu-ca.github.io/game5/`）。所有设备打开游戏自动使用该地址，
  无需再手动填写。

## 原理

```
浏览器(游戏) --GET/POST--> Cloudflare Worker(免费) --GitHub Contents API--> 你的仓库
                                   └── GITHUB_TOKEN 只存在这里，前端永远看不到
```

- 每次存档变化，前端自动推送到云端（3 秒防抖）。
- 每次登录，前端自动从云端拉取（云端比本地新才覆盖）。
- 账号（密码盐 + 哈希）也会同步到 `Game5Accounts/{用户名}.json`，
  换设备用同一账号 + 密码登录即可恢复全部进度。

## ⚠️ 重要：网络可达性

Cloudflare 的 `*.workers.dev` 域名在部分网络/地区（尤其大陆直连）可能被拦。
实测本机（你当前这台电脑）**直连 workers.dev 会超时**（PowerShell 和浏览器都不通），
而你的本地代理工具（`127.0.0.1:7890`）目前**没有运行**。

因此：
- **本机现在用云存档会失败**（游戏推不到云端）。请先开启你的代理/VPN 工具（让 7890 端口
  处于监听），再进游戏点「立即同步到云端」测试，能同步即说明通了。
- 若你/玩家在大陆且希望稳定免代理访问，最稳妥是把 Worker **绑定一个自定义域名**
  （Cloudflare → Workers → 你的 Worker → Settings → Domains & Routes → 添加自定义域名，
  需你已有一个解析到 Cloudflare 的域名）。绑定后把新地址告诉我，我把 `LOCKED_SYNC_URL`
  改成新地址即可。

## 令牌说明（GITHUB_TOKEN）

Worker 机密里现在用的仍是源码目录 `.env` 里的旧 `ghp_` 令牌。**强烈建议**：
到 <https://github.com/settings/tokens> 撤销该令牌，重新生成一个**细粒度**令牌
（仅授权 `YunYu-ca/YunYu-ca.github.io` 的 Contents: read and write），然后在
`cloudflare-worker` 目录下执行更新：

```
npx wrangler secret put GITHUB_TOKEN
```

同时更新 `.env`。不要在聊天或代码里明文保留令牌。

## 本地自测（可选）

`mock-worker.js` 是本地模拟云函数的服务（端口 8140），数据落在 `.mock-repo/`。
启动：`node mock-worker.js`。若你想脱离线上 Worker 测同步逻辑，可把 `LOCKED_SYNC_URL`
临时改成 `http://127.0.0.1:8140` 并重建，测完再改回来。
