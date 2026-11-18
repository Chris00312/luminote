# 贡献指南

感谢你愿意花时间。这里没有复杂的流程。

英文贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开始之前

- **小改动**（错别字、样式微调、文档）：直接开 PR，不用先说。
- **大改动**（新功能、重构、改数据结构）：先开 issue 说清楚要解决什么问题，我们确认方向后再动手，避免白写。

## 本地开发

扩展没有构建步骤。

```bash
git clone https://github.com/Chris00312/luminote.git
cd luminote
```

1. 打开 `chrome://extensions`
2. 打开右上角 **开发者模式**
3. 点 **加载已解压的扩展程序**，选择 `LumiNote/` 目录
4. 改完代码，点扩展卡片上的刷新按钮

如果同时改 MCP server：

```bash
cd luminote-mcp-server
npm install
node index.js
```

## 提交前自查

```bash
node scripts/package-extension.mjs    # 能正常打包
node --check LumiNote/lib/*.js        # 语法没问题
```

CI 会在每次推送时跑这两条。如果你改了 UI，请附一张截图。

## 硬性约束

这些是产品定位，不是偏好：

- **不加账号体系、不加服务器、不加遥测。** 数据必须留在用户本机。
- **不加付费、订阅、额度限制。** 这是开源免费版。
- **AI 只能走用户自己的 Key。** 不允许把任何 API Key 打进仓库或代码里。
- **不破坏存量数据。** 老用户升级后，本地已存的记忆和灵感板不能丢。

## 代码风格

- 现有代码风格就是规范：2 空格缩进、ES modules、无分号偏好不强求。
- 注释写**为什么**，不写**是什么**。
- 中文、英文注释都可以。

## 提交信息

```
feat: 一句话说做了什么
fix: 修了什么
docs: 文档
chore: 杂项
```

不用写得很长，但要说清楚"为什么改"。

## 许可证

提交 PR 即表示你同意以 [MIT](LICENSE) 授权你的贡献。
