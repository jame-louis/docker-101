#!/usr/bin/env python3
r"""audit-shots.py — 密度审计：检查每张幻灯片(镜)的文字密度,标记 DENSE。

依据许岑「留白」原则的可执行判据:
- 可见内容(regular text) ≤ ~6 行 且 ≤ ~200 字符(含标题、要点、一句图注)。
- 超过即报 DENSE → 把细节下放到讲者备注。

例外(视为「镜头」本身,可合理超长):
- `>` 引用块、表格行(含 `|`)、LaTeX 公式($…$ / $$…$$ / \[…\] / 反引号块)、
  代码块(```…```)、一行图注。

输入:
  Slidev markdown(以 `---` 分隔镜头,顶部 frontmatter 被跳过)
  或任意 markdown(作为一个整体镜头审计)

用法:
  python audit-shots.py <file.md>          # 审计文件
  cat content.md | python audit-shots.py    # 审计 stdin(若未直接含 ---,整段当一镜)
  python audit-shots.py <file.md> --json    # 结构化输出
"""

import re
import sys

LINE_MAX = 6      # 可见行数上限
CHAR_MAX = 200    # 可见字符数上限


def is_slide_separator(line):
    return re.fullmatch(r"\s*---+\s*", line) is not None


def looks_like_frontmatter(segment):
    """粗判 YAML frontmatter: 整段靠近文件头部且每写一行多为 key: value。"""
    lines = [l for l in segment.splitlines() if l.strip()]
    if not lines:
        return False
    scored = 0
    for l in lines:
        if re.match(r"^[-\w]+\s*:", l):
            scored += 1
            continue
        if l.startswith(("#", "keynote", "theme", "layout", "class", "transition",
                         "background", "colorSchema", "fonts", "title", "selectable")):
            scored += 1
    return scored / len(lines) >= 0.7


def split_slides(text):
    lines = text.splitlines()
    slides, cur = [], []
    for line in lines:
        if is_slide_separator(line):
            if cur:
                slides.append("\n".join(cur).strip())
                cur = []
        else:
            cur.append(line)
    if cur:
        slides.append("\n".join(cur).strip())
    slides = [s for s in slides if s.strip()]
    # Slidev 首段通常是 YAML frontmatter,跳过
    if slides and looks_like_frontmatter(slides[0]):
        slides.pop(0)
    return slides


def strip_notes_and_comments(segment):
    """去掉 <!-- 讲者备注 --> 及一切 HTML 注释,只留可见面。"""
    segment = re.sub(r"<!--.*?-->", "", segment, flags=re.S)
    return segment


def classify_line(line):
    """返回 ('regular' | 'exception' | 'blank' | 'img' | 'title')"""
    s = line.strip()
    if not s:
        return "blank"
    if s.startswith("```") or s.startswith("~~~"):
        return "fence"
    if re.match(r"^\s*!\[", line):          # 图片行(镜头)
        return "img"
    if s.startswith(">"):                    # 引用
        return "exception"
    if "|" in s and re.match(r"^\s*\|?[^|]+(\|[^|]+)+\|?\s*$", s):  # 表格行
        return "exception"
    if re.match(r"^\s*\$\$", s) or re.match(r"^\s*\\\[", s):        # 公式块首
        return "exception"
    return "regular"


def audit_segment(segment):
    notes = []
    in_fence = False
    regular_lines = 0
    regular_chars = 0
    exception_lines = 0
    has_title = False
    for raw in segment.splitlines():
        line = raw
        if line.strip().startswith("```") or line.strip().startswith("~~~"):
            in_fence = not in_fence
            continue                    # 代码块整体视为镜头,不数
        if in_fence:
            continue
        kind = classify_line(line)
        if kind == "blank":
            continue
        if kind == "exception":
            exception_lines += 1
            continue
        if kind == "img":
            continue
        # regular / caption-under-image / title
        if re.match(r"^\s*#{1,6}\s", line):     # 标题
            has_title = True
        regular_lines += 1
        regular_chars += len(re.sub(r"\s", "", line))
        notes.append(line)

    dense = regular_lines > LINE_MAX or regular_chars > CHAR_MAX
    return {
        "regular_lines": regular_lines,
        "regular_chars": regular_chars,
        "exception_lines": exception_lines,
        "has_title": has_title,
        "dense": dense,
    }


def audit(text):
    slides = split_slides(text)
    if not slides:
        slides = [text]   # 无 --- 分隔:整段当一镜
    results = []
    for i, seg in enumerate(slides, 1):
        visible = strip_notes_and_comments(seg)
        stats = audit_segment(visible)
        results.append({"slide": i, **stats})
    return results


def fmt(results):
    header = f"{'sld':<4}{'lines':<7}{'chars':<7}{'excLines':<9}{'title':<6}verdict"
    out = [header, "-" * len(header)]
    n_dense = 0
    for r in results:
        verdict = "DENSE" if r["dense"] else "ok"
        if r["dense"]:
            n_dense += 1
        out.append(
            f"{r['slide']:<4}{r['regular_lines']:<7}{r['regular_chars']:<7}"
            f"{r['exception_lines']:<9}{('Y' if r['has_title'] else '-'):<6}{verdict}"
        )
    out.append("-" * len(header))
    out.append(f"{len(results)} slides, {n_dense} DENSE")
    return "\n".join(out)


def main():
    argv = sys.argv[1:]
    as_json = "--json" in argv
    argv = [a for a in argv if a != "--json"]
    if argv:
        with open(argv[0], encoding="utf-8") as fh:
            text = fh.read()
    else:
        text = sys.stdin.read()
    results = audit(text)
    if as_json:
        import json
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print(fmt(results))


if __name__ == "__main__":
    main()