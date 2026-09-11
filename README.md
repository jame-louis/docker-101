# 前端开发课程（示例）

基于 **Astro** 的课程内容管理系统。作者只需要编辑 Markdown，其余全部自动完成：课程网站、讲义页面、作业页面、Slidev 课件一键构建并部署到 GitHub Pages。

## 项目简介

本项目是一套**课程网站模板**，将静态课程网站与 Slidev 课件整合在一起：

- **课程网站**（Astro）：首页课程安排、讲义、作业，纯静态输出，无任何客户端 JS，动效仅依赖 CSS。
- **课件**（Slidev）：每节课对应一套幻灯片，与讲义内容同步维护，构建后挂载在网站 `幻灯片` 链接下。
- **内容驱动**：所有内容都是 Markdown；修改讲义、作业或课件后，一条命令重新构建即可发布。

## 技术栈

| 模块 | 技术 |
|------|------|
| 网站 | [Astro](https://astro.build) + Tailwind CSS v3 |
| 课件 | [Slidev](https://sli.dev) |
| 部署 | GitHub Pages（GitHub Actions 自动部署），亦支持 Netlify |
| 内容 | Markdown（YAML frontmatter） |

## 快速开始

### 本地预览

```bash
npm install --prefix website
npm install --prefix slides
npm run build      # 构建网站 + 课件，输出到 site/
npm run dev        # 本地预览 http://127.0.0.1:4321/course-template/
```

### 日常开发（热更新）

```bash
npm run dev:website   # Astro 开发服务器
npm run dev:slides    # Slidev 开发服务器
```

## 内容怎么改

**原则：只编辑 Markdown，其余自动生成。**

1. **讲义** → `website/src/content/lectures/lectureNN.md`
   - 顶部 YAML frontmatter：`title`、`lectureNumber`、可选 `slidevUrl`、`draft`
   - 课程介绍（描述、教材、目标）写在 `lecture01.md` 开头
2. **作业** → `website/src/content/assignments/hwNN.md`
   - frontmatter：`title`、`assignmentNumber`、`lectureRef`（必须对应讲义 slug）、可选 `dueDate`、`downloadFile`
   - 下载文件放到 `website/public/assets/`
3. **课件** → `slides/lectureNN.md`（Slidev 语法）
   - 讲义中填写 `slidevUrl: /slides/lectureNN` 后，首页会自动显示“课件”链接
4. `draft: true` 的内容不会出现在正式构建中

改完运行 `npm run build`，即可预览/部署更新。

## 目录结构

```
├── src/                     # 草稿内容（纯 Markdown，无 frontmatter，源内容）
├── website/                 # Astro 课程网站
│   ├── src/content/         # Astro 实际消费的内容（带 frontmatter）
│   ├── src/config.ts        # 站点名称 / 学期 / 描述（唯一需要手改的配置）
│   ├── astro.config.mjs     # site、base、Shiki、rehype 插件
│   └── netlify.toml         # 可选的 Netlify 部署配置
├── slides/                  # Slidev 课件
│   ├── lectureNN.md         # 每节课一套幻灯片
│   └── package.json         # @slidev/cli
├── .github/workflows/       # GitHub Pages 自动部署
└── site/                    # 构建产物（勿手改，npm run build 自动生成）
```

## 部署

### GitHub Pages（默认）

推送到 `main` 分支后，`.github/workflows/deploy.yml` 会自动构建并部署 `site/` 目录到 GitHub Pages。

**一次性设置**：仓库 Settings → Pages → Source 选择 **GitHub Actions**。

### Netlify（可选）

如需改用 Netlify，直接导入仓库即可，构建命令与发布目录已写在 `website/netlify.toml` 中。

## 从模板新建课程

1. 修改 `website/src/config.ts`：`site.title`、`site.term`、`site.description`
2. 按需修改 `website/astro.config.mjs` 中的 `site` / `base`（默认指向 GitHub Pages 的子路径 `/course-template/`）
3. 编写讲义与作业（见上方“内容怎么改”）
4. 可选：编写 Slidev 课件并设置 `slidevUrl`
5. 将 `draft` 改为 `false` 后构建、推送，即可发布

## 许可证

本项目目前未指定开源许可证（All rights reserved）。
