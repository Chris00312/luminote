# LumiNote 官网

LumiNote 的静态落地页。纯静态、无构建步骤 —— 浏览器内用 Babel 转译 JSX，可以直接托管到任何 CDN（Cloudflare Pages / Vercel / Netlify / GitHub Pages）。

## 目录结构

```
website/
├── index.html                  # 入口，按顺序加载各组件
├── assets/
│   ├── colors_and_type.css     # 设计 token（颜色 / 字体 / 间距）
│   ├── logo-stack.svg          # favicon + 品牌图
│   └── luminote-preview.mp4    # 演示视频
├── components/                 # React 组件（浏览器内 Babel 转译）
│   ├── icons.jsx               # 内联 SVG 图标集
│   ├── copy.jsx                # 所有文案（中 / 英 / 日）
│   ├── Nav.jsx                 # 顶部导航
│   ├── Hero.jsx                # 首屏
│   ├── LiveDemo.jsx            # 交互式「标记 → 解释」演示
│   ├── Flow.jsx                # 三步流程
│   ├── Gallery.jsx             # 产品界面预览
│   ├── Agent.jsx               # Agent + MCP 演示
│   ├── Download.jsx            # 下载安装包 + 安装步骤
│   ├── Privacy.jsx             # 隐私承诺
│   ├── Faq.jsx                 # 常见问题
│   ├── Footer.jsx              # CTA + 页脚
│   └── App.jsx                 # 根组件 + 语言持久化
(安装包不进仓库，见下方「更新安装包」)
```

## 本地预览

```bash
python3 -m http.server 8000 --directory website
# 打开 http://localhost:8000
```

## 更新安装包

官网直接分发 zip，不经过任何应用商店。重新打包：

```bash
node scripts/package-extension.mjs
# → website/downloads/luminote-chrome.zip
```

安装包不放在仓库里，而是通过 GitHub Releases 分发。`Download.jsx` 和
`Nav.jsx` / `Hero.jsx` / `Footer.jsx` 里的按钮都指向
`/releases/latest`，发新版本后自动生效，无需改代码。

## 文案

所有文案集中在 `components/copy.jsx`，按 `zh` / `en` / `ja` 三语组织。改文案只需要动这一个文件。

## LiveDemo 的真实 AI 解释

`LiveDemo` 默认用内置的 mock 文本。要接真实模型，在 `index.html` 里定义
`window.explainPassage`：

```html
<script>
  window.explainPassage = async function (prompt, { lang } = {}) {
    const r = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, lang }),
    });
    if (!r.ok) throw new Error('explain failed');
    const { text } = await r.json();
    return text;
  };
</script>
```

不定义时页面会退回到 mock，仍然可以演示。

## 部署

任何静态托管都可以。上传整个 `website/` 目录即可 —— 安装包来自 GitHub
Releases，不需要额外托管二进制文件。
