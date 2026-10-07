# Docker 101 教学仓库

Docker 入门课程：每讲有**课程稿**（`src/lectures/lecture0X.md`）和配套 **Slidev 幻灯片**（`slides/lecture0X.md`）。

## 目录速览

- `src/lectures/lecture0X.md` — 讲稿正文（本讲全部内容、命令、实战）。这是幻灯片唯一内容源。
- `slides/lecture0X.md` — 该讲渲染成片的 Slidev markdown。已产出 lecture01~06，配套 `.pdf`（`slidev export`）。
- `slides/` — Slidev 项目根：`npm run dev` 预览 / `build` / `export`；经 Netlify（`netlify.toml`）/ Vercel 部署。
- `.claude/skills/xucen-slide/` — 「电影级幻灯片」技能（许岑方法论），生成与审阅都走它。
- `syllabus.md`、`journey/` — 课程大纲与历次改动日志。

## 生成/审阅幻灯片：先调 `xucen-slide` 技能

凡涉及"做 PPT / 幻灯片 / 设计审阅 / 稿转片"的请求，**先**调用 `.claude/skills/xucen-slide/` 技能，按其 `SKILL.md` 与 `references/principles.md` 执行：

1. **源稿先行**：以 `src/lectures/lecture0X.md` 为唯一内容源（Speech-First）。
2. 输出到 `slides/lecture0X.md`，命名与讲序号一致。
3. 完成后跑密度审计（见下）至 0 DENSE。

## 幻灯片约定（系列已固化，新片必须对齐）

- `theme: default`（浅色，适合幕布/投影）——与既有 lecture01~06 一致。
- **Frontmatter** 模板：`theme / title / info / class: text-center / highlighter: shiki / drawings.persist: false / transition: fade / mdc: true`。
- **三幕剧结构**：片头【空镜】钩子 → 各幕 `layout: section` 幕卡（【转场】）→ 幕内特写镜【特写】→ 片尾【空镜】悬念 + `谢谢大家 Q&A`。
- **台词式标题**：一镜一句"台词"，不是名词标签（❌"生命周期" → ✅"容器会跑，可它连不清自己人"）。
- **留白密度**：可见面（去讲者备注/注释后）≤ 6 行 且 ≤ 200 字，`> 引用`、表格行、代码块、图注是"镜头"可超长。
- **讲者备注**：每镜必须有 `<!-- 讲者备注：【镜头类型】+ 细节 + 教学提示 -->`；被删下银幕的细节必须能在此找回（永不丢失内容）。
- **节奏**：幕卡/开场用 `fade`；`transition: slide-left` 仅作终章收束刻意使用，别放在 `layout: section` 前一张（会造成背靠背转场风格不一）。
- **`v-clicks`** 正确写法：`<v-clicks>` 与 `</v-clicks>` 独占一行，包裹无前缀的标准列表项（不要写成 `- <v-clicks>`）。
- 归因红线：不要把「对比/重复/对齐/亲密」说成许岑原创，其出自 Robin Williams。

## 密度审计（收尾自检，必须 0 DENSE）

```bash
python3 .claude/skills/xucen-slide/scripts/audit-shots.py slides/lecture0X.md
```

有 DENSE 就把超长那镜的可见面精简、细节沉到讲者备注，重跑至全绿再交付。

## 预览 / 构建 / 导出

```bash
cd slides
npm run dev      # 本地预览 http://localhost:3030
npm run build    # 产出 dist/（部署用）
npm run export   # 导出 slides/lecture0X.md 对应 PDF（配 playwright-chromium）
```

## 写代码/改配置的边界

- 不要把内容或配置写进全局 `~/.claude`；项目级指引放这里（仓库根 `CLAUDE.md`），技能放 `.claude/skills/`。
- 幻灯片只由课程稿驱动，不要私自新增与讲稿无关的内容。