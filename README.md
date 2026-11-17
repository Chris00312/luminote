# LumiNote

把你的浏览器变成一个记忆库。在任意网页或 PDF 上选中文字或图片，AI 会分层解释它，并把结果存成一张可以随时回访的记忆卡。

- **本地优先** — 数据只存在你的浏览器里，没有账号，没有服务器
- **自带 API Key** — 用你自己的 OpenAI / Claude / Gemini / DeepSeek Key，请求直接从浏览器发往服务商
- **MCP 开放** — Claude Desktop、Cursor 等 AI 客户端可以读写同一份记忆库
- **MIT 开源** — 随便改，随便用

## 安装

不需要应用商店，直接下载安装包加载即可。

1. 下载 [`website/downloads/luminote-chrome.zip`](website/downloads/luminote-chrome.zip)
2. 解压到一个固定目录（之后别删，扩展要一直从这个目录加载）
3. 打开 `chrome://extensions`（Edge 用 `edge://extensions`）
4. 打开右上角 **开发者模式**
5. 点 **加载已解压的扩展程序**，选中解压出来的 `luminote` 文件夹
6. 点扩展图标 → 设置，选择 AI 服务商并填入你的 API Key

以开发者模式加载的扩展不会自动更新。想升级时重新下载 zip，覆盖原文件夹即可，本地数据不会丢。

## 配置 AI

LumiNote 不带内置模型，也不代理任何请求。设置页支持：

| 服务商 | 说明 |
| --- | --- |
| OpenAI / DeepSeek / 兼容 | 任意 OpenAI 兼容端点，自填 Base URL 与模型名 |
| Anthropic Claude | 原生 Claude API |
| Google Gemini | 原生 Gemini API |
| 火山方舟 | Coding Plan，固定 `https://ark.cn-beijing.volces.com/api/coding/v3` |
| MiniMax | Token Plan，兼容 Anthropic 协议 |
| 阿里云百炼 | Coding Plan，固定 `https://coding.dashscope.aliyuncs.com/v1` |

Deep Think（双模型交叉思考）和 Agent（工具调用）都可以单独配置第二组 Key，不配置时复用第一组。

## 开发

扩展本身没有构建步骤，改完直接重新加载：

```bash
# 在 chrome://extensions 点扩展卡片上的刷新按钮
```

重新打包安装包：

```bash
node scripts/package-extension.mjs
# → website/downloads/luminote-chrome.zip
```

## 目录结构

```
LumiNote/                 Chrome 扩展本体（MV3，无构建步骤）
├── background/           Service worker：解释请求、PDF、记忆 API、右键菜单
├── content/              内容脚本：划选气泡、解释卡片
├── lib/                  共享模块：AI 服务商、prompt、存储、i18n、Agent 引擎
├── notebook/             完整笔记本页（记忆库 + 灵感板 + Agent）
├── options/              设置页
├── popup/                工具栏弹窗
├── pdf-viewer/           自托管 pdf.js 阅读器
├── welcome/              首次安装引导
└── vendor/               第三方库（pdf.js、html2canvas）

website/                  官网（静态 React + 浏览器内 Babel）
├── components/
└── downloads/            打包好的安装包

luminote-mcp-server/      MCP 服务器，让 AI 客户端读写记忆库
scripts/                  打包脚本
design-system/            设计系统与 UI kit
```

## MCP 服务器

```bash
npm install -g luminote-mcp-server
```

在你的 AI 客户端配置里加上：

```json
{
  "mcpServers": {
    "luminote": { "command": "luminote-mcp", "args": [] }
  }
}
```

## 隐私

所有记忆、灵感板、图片都写在 `chrome.storage.local`。扩展不收集、不上传任何数据。唯一的外部请求是你自己配置的 AI 服务商（以及 MCP 客户端与扩展之间的本地 WebSocket）。

## 许可证

[MIT](LICENSE)
