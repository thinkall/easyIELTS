# easyIELTS

[English](README.md) · [简体中文](README.zh-CN.md)

一个用于 **雅思 General Training（A 类以外的移民/培训类）** 备考的 Web 应用，覆盖听、读、写、说四项技能。

- **听力 & 阅读** —— 自动评分的模拟测试，并换算为雅思分数段（band）。
- **写作** —— 由大语言模型（LLM）评分（4 项评分标准 + 反馈 + 范文）。登录用户可以使用自己
  **GitHub Copilot** 账号下的高级模型（Claude Opus、GPT-5.x 等）。
- **口语** —— 通过 **Gemini Live API** 进行实时口语模拟考试，随后由 LLM 评分。
- 无需登录：学习进度保存在浏览器的 **localStorage** 中。站点所有者配置的 API 密钥仅在服务端使用，
  绝不会发送到浏览器。

基于 Next.js 16（App Router）+ React 19 + TypeScript + Tailwind v4 构建，运行在一个自定义的
Node 服务器（`server.ts`）之上，该服务器同时桥接口语功能所需的 WebSocket 代理。

## 快速开始（一条命令）

启动脚本会自动检查 Node.js（如果缺失或版本过低会自动安装），安装依赖、构建并启动网站：

**Windows（PowerShell）：**

```powershell
.\start.ps1          # 生产模式构建并启动
.\start.ps1 -Dev     # 开发服务器（热重载）
```

> 如果 PowerShell 阻止脚本运行，可在当前会话中临时放开权限：
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

**Linux / macOS：**

```bash
./start.sh           # 生产模式构建并启动
./start.sh --dev     # 开发服务器（热重载）
```

在 Windows 上脚本通过 **winget** 安装 Node.js；在 Linux/macOS 上通过 **nvm** 安装。如果无法
自动安装，脚本会给出 <https://nodejs.org/> 链接提示你手动安装。随后在浏览器打开脚本输出的地址
（默认 **http://localhost:3000**）。

如果想手动操作，请参考下文的 [环境要求](#环境要求) 与 [运行](#运行)。

## 环境要求

- Node.js 20+（在 24 上测试通过）
- `npm install`

## 配置

将 `.env.example` 复制为 `.env`（或 `.env.local`），按需填写。**所有密钥都是可选的** —— 未设置的
密钥只会禁用对应的共享/所有者通道；用户可以在应用内 **/settings** 页面填入自己的密钥。

```bash
# 仅服务端使用的所有者密钥（绝不会暴露给浏览器）
GITHUB_MODELS_TOKEN=          # 具有 Models 访问权限的 GitHub token（共享的写作评分）
GEMINI_API_KEY=               # 所有者的 Gemini 密钥（共享的口语代理）

# 可选项覆盖（未设置时使用安全默认值）
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview

# 服务器
PORT=3000
HOST=localhost
```

> 仅在开发模式下，如果 `GITHUB_MODELS_TOKEN` 为空，服务器会回退到 `gh auth token`
> （这样本地已登录的 GitHub CLI 即可零配置使用）。

## 运行

**开发模式**（自动重载）：

```bash
npm run dev
```

**生产模式**：

```bash
npm run build
npm start
```

随后打开 **http://localhost:3000**（或你设置的 `PORT`）。可用 `PORT` / `HOST` 修改地址，
例如 `PORT=8080 npm run dev`。

> 请使用上述 npm 脚本，而不要直接运行 `next dev` / `next start`。应用通过自定义的 `server.ts`
> （借助 `tsx`）运行，它会加载 `.env` 并挂载口语代理。

## 使用你自己的 GitHub Copilot 模型（写作）

1. 进入 **/settings → “Connect with device code”（用设备码连接）**，并在浏览器中完成授权。
2. 页面会出现一个 **Evaluation model（评分模型）** 下拉框，列出你的 Copilot 模型。
3. 选择其中一个（如 `claude-opus-4.8`、`gpt-5.5`），之后写作评分便会在你的账号上运行。

你的 GitHub token 会保存在 httpOnly cookie 中，并在 **服务端** 换取 Copilot token ——
它绝不会暴露给浏览器。

## 路由

| 路径 | 说明 |
|------|-------------|
| `/` | 首页 |
| `/listening`、`/reading` | 自动评分的模拟测试 |
| `/reading/generate` | AI 生成的原创阅读测试 |
| `/writing` | 由 LLM 评分的写作任务 |
| `/speaking` | Gemini 实时口语考试 |
| `/dashboard` | 你的答题记录与分数段进度 |
| `/settings` | 你的 API 密钥与模型选择 |
| `/connect` | 连接 GitHub（设备码流程） |

## 测试、检查、构建

```bash
npm run test     # vitest（单元 + 组件测试）
npm run lint     # eslint
npm run build    # 生产构建
```
