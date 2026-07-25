export const katexCssHref = "https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css";
export const katexScriptHref = "https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.js";

export const adminMarkdownToolbar = String.raw`<div class="markdown-toolbar" role="toolbar" aria-label="Markdown shortcuts">
    <button type="button" data-md-action="heading-1" title="Heading 1">H1</button>
    <button type="button" data-md-action="heading-2" title="Heading 2">H2</button>
    <button type="button" data-md-action="heading-3" title="Heading 3">H3</button>
    <span class="toolbar-separator" aria-hidden="true"></span>
    <button type="button" data-md-action="bold" title="Bold"><strong>B</strong></button>
    <button type="button" data-md-action="italic" title="Italic"><em>I</em></button>
    <button type="button" data-md-action="strike" title="Strikethrough"><s>S</s></button>
    <span class="toolbar-separator" aria-hidden="true"></span>
    <button type="button" data-md-action="link" title="Link">Link</button>
    <button type="button" data-md-action="image" title="Image">Img</button>
    <button type="button" data-md-action="code" title="Code">&lt;/&gt;</button>
    <button type="button" data-md-action="quote" title="Quote">Quote</button>
    <button type="button" data-md-action="hr" title="Horizontal rule">HR</button>
    <button type="button" data-md-action="ul" title="Bulleted list">UL</button>
    <button type="button" data-md-action="ol" title="Numbered list">OL</button>
    <details class="katex-toolbar">
        <summary>KaTeX</summary>
        <div class="katex-toolbar-grid" role="group" aria-label="KaTeX shortcuts">
            <button type="button" data-md-action="math-inline" title="Inline formula">$x$</button>
            <button type="button" data-md-action="math-block" title="Display formula">$$</button>
            <button type="button" data-md-action="math-frac" title="Fraction">\frac</button>
            <button type="button" data-md-action="math-sup" title="Superscript">x^2</button>
            <button type="button" data-md-action="math-sub" title="Subscript">x_i</button>
            <button type="button" data-md-action="math-sub-sup" title="Subscript and superscript">x_i^n</button>
            <button type="button" data-md-action="math-sum" title="Summation">\sum</button>
            <button type="button" data-md-action="math-ge" title="Greater than or equal">\ge</button>
            <button type="button" data-md-action="math-le" title="Less than or equal">\le</button>
            <button type="button" data-md-action="math-because" title="Because">\because</button>
            <button type="button" data-md-action="math-therefore" title="Therefore">\therefore</button>
        </div>
    </details>
</div>`;

export const adminEditorStyles = String.raw`
            .markdown-editor {
                display: grid;
                gap: 0.7rem;
                min-width: 0;
                padding: 0.9rem;
                border: 1px solid var(--line);
                border-radius: 10px;
                background: #ffffff;
            }

            .markdown-editor > label {
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
                margin: 0;
                color: var(--muted);
                font-size: 0.875rem;
                font-weight: 700;
            }

            .markdown-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem;
                padding: 0.45rem;
                border: 1px solid var(--line);
                border-radius: 6px;
                background: #f8fafc;
            }

            .markdown-toolbar button {
                min-width: 2.4rem;
                min-height: 2rem;
                padding: 0.2rem 0.55rem;
                border-radius: 5px;
                background: #ffffff;
                font-size: 0.84rem;
                line-height: 1;
            }

            .markdown-toolbar button strong,
            .markdown-toolbar button em,
            .markdown-toolbar button s {
                font: inherit;
            }

            .markdown-editor textarea {
                min-width: 0;
                min-height: 34rem;
                resize: vertical;
            }

            .toolbar-separator {
                width: 1px;
                background: var(--line);
                margin: 0 0.15rem;
            }

            .katex-toolbar {
                flex-basis: 100%;
                min-width: 0;
                border-top: 1px solid var(--line);
                padding-top: 0.45rem;
            }

            .katex-toolbar summary {
                display: inline-flex;
                align-items: center;
                min-height: 2rem;
                padding: 0.2rem 0.55rem;
                border: 1px solid var(--line);
                border-radius: 5px;
                background: #ffffff;
                cursor: pointer;
                color: var(--code);
                font-size: 0.84rem;
                font-weight: 700;
                list-style: none;
            }

            .katex-toolbar summary::-webkit-details-marker {
                display: none;
            }

            .katex-toolbar summary::after {
                content: "+";
                margin-left: 0.45rem;
                color: var(--muted);
            }

            .katex-toolbar[open] summary::after {
                content: "-";
            }

            .katex-toolbar-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem;
                padding-top: 0.45rem;
            }

            .editor-grid {
                display: grid;
                grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
                gap: 1.1rem;
                align-items: start;
            }

            .preview-panel {
                display: grid;
                gap: 0.45rem;
                min-width: 0;
                padding: 0.9rem;
                border: 1px solid var(--line);
                border-radius: 10px;
                background: #ffffff;
            }

            .preview-panel > p {
                margin: 0;
                color: var(--muted);
                font-size: 0.875rem;
                font-weight: 700;
            }

            .preview {
                min-height: 34rem;
                max-height: 72vh;
                overflow: auto;
                overflow-wrap: anywhere;
                line-height: 1.85;
                font-size: 0.98rem;
                padding-right: 0.25rem;
            }

            .preview h1,
            .preview h2,
            .preview h3,
            .preview h4,
            .preview h5,
            .preview h6 {
                margin: 1.2rem 0 0.65rem;
                line-height: 1.25;
            }

            .preview h1 {
                font-size: 1.6rem;
            }

            .preview h2 {
                font-size: 1.35rem;
            }

            .preview h3 {
                font-size: 1.15rem;
            }

            .preview p {
                margin: 0.85rem 0;
            }

            .preview hr {
                margin: 1.25rem 0;
                border: 0;
                border-top: 1px solid var(--line);
            }

            .preview strong {
                font-weight: 700;
            }

            .preview em {
                font-style: italic;
            }

            .preview blockquote {
                margin: 1rem 0;
                padding: 0.15rem 0 0.15rem 1rem;
                border-left: 3px solid var(--brand);
                background: #f8fafc;
                color: var(--muted);
            }

            .preview blockquote p {
                margin: 0.45rem 0;
            }

            .preview ul,
            .preview ol {
                margin: 0.85rem 0 0.85rem 1.25rem;
                padding: 0;
            }

            .preview li + li {
                margin-top: 0.35rem;
            }

            .preview a {
                color: var(--brand);
            }

            .preview img {
                display: block;
                max-width: 100%;
                height: auto;
                border-radius: 6px;
                margin: 0.75rem 0;
            }

            .preview code {
                padding: 0.12rem 0.32rem;
                border-radius: 4px;
                background: #eef2f7;
                color: var(--code);
                font-family:
                    ui-monospace,
                    SFMono-Regular,
                    Consolas,
                    "Liberation Mono",
                    monospace;
                font-size: 0.88rem;
            }

            .preview pre {
                margin: 1rem 0;
                overflow: auto;
                border-radius: 6px;
                background: #0f172a;
                color: #e2e8f0;
                padding: 0.9rem 1rem;
            }

            .preview pre code {
                padding: 0;
                border-radius: 0;
                background: transparent;
                color: inherit;
                font-size: 0.84rem;
            }

            .preview table {
                width: 100%;
                border-collapse: collapse;
                margin: 1rem 0;
            }

            .preview th,
            .preview td {
                border: 1px solid var(--line);
                padding: 0.45rem 0.55rem;
                text-align: left;
            }

            .preview th {
                background: #f8fafc;
            }

            .preview .katex-display {
                overflow-x: auto;
                overflow-y: hidden;
                padding: 0.25rem 0;
            }

            @media (max-width: 920px) {
                .editor-grid {
                    grid-template-columns: 1fr;
                }

                .markdown-editor,
                .preview-panel {
                    padding: 0.8rem;
                }
            }
`;

export const adminEditorScript = String.raw`
(() => {
    const textarea = document.querySelector("#body");
    const preview = document.querySelector("#preview");
    const toolbar = document.querySelector(".markdown-toolbar");
    const imageInput = document.querySelector("#bodyImageFile");

    if (!textarea || !preview || !toolbar) {
        return;
    }

    const escapeHtml = (value) =>
        String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        }[char]));

    const isBlockStart = (line) =>
        /^\s*(?:#{1,6}\s+|(?:-{3,}|\*{3,}|_{3,}|\$\$|\\\[)\s*$|\x60\x60\x60|\s*> ?|\s*(?:[-*+]|\d+\.)\s+)/.test(line);

    const renderKatex = (formula, displayMode = false) => {
        if (!window.katex) {
            return (
                '<code class="math-fallback">' +
                escapeHtml(displayMode ? "$$" + formula + "$$" : "$" + formula + "$") +
                "</code>"
            );
        }

        try {
            return window.katex.renderToString(formula, {
                displayMode,
                throwOnError: false,
                strict: "ignore",
            });
        } catch {
            return '<code class="math-fallback">' + escapeHtml(formula) + "</code>";
        }
    };

    const renderInline = (value) => {
        const tokens = [];
        const store = (html) => {
            const token = "\u0000" + tokens.length + "\u0000";
            tokens.push(html);
            return token;
        };

        let text = String(value ?? "");
        text = text.replace(/\x60([^\x60]+)\x60/g, (_, code) =>
            store("<code>" + escapeHtml(code) + "</code>"),
        );
        text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, formula) =>
            store(renderKatex(formula, false)),
        );
        text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, formula) =>
            store(renderKatex(formula, true)),
        );
        text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula) =>
            store(renderKatex(formula, true)),
        );
        text = text.replace(/(^|[^\\])\$([^\s$](?:[\s\S]*?[^\s$])?)\$/g, (_, prefix, formula) =>
            prefix + store(renderKatex(formula, false)),
        );
        text = escapeHtml(text);
        text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) =>
            store(
                '<img src="' +
                    escapeHtml(src) +
                    '" alt="' +
                    alt +
                    '" loading="lazy" />',
            ),
        );
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) =>
            store('<a href="' + escapeHtml(href) + '">' + label + "</a>"),
        );
        text = text.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
        text = text.replace(/__([\s\S]+?)__/g, "<strong>$1</strong>");
        text = text.replace(/~~([\s\S]+?)~~/g, "<del>$1</del>");
        text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
        text = text.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1<em>$2</em>");

        return text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] ?? "");
    };

    const renderMarkdown = (markdown) => {
        const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
        const html = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            if (!line.trim()) {
                i += 1;
                continue;
            }

            if (/^\s*\$\$\s*$/.test(line) || /^\s*\\\[\s*$/.test(line)) {
                const closePattern = /^\s*\$\$\s*$/.test(line)
                    ? /^\s*\$\$\s*$/
                    : /^\s*\\\]\s*$/;
                const formula = [];
                i += 1;
                while (i < lines.length && !closePattern.test(lines[i])) {
                    formula.push(lines[i]);
                    i += 1;
                }
                if (i < lines.length) {
                    i += 1;
                }
                html.push(renderKatex(formula.join("\n"), true));
                continue;
            }

            const singleLineDisplayMath = /^\s*\$\$([\s\S]+)\$\$\s*$/.exec(line);
            if (singleLineDisplayMath) {
                html.push(renderKatex(singleLineDisplayMath[1], true));
                i += 1;
                continue;
            }

            const fence = /^\x60\x60\x60([\w-]*)\s*$/.exec(line);
            if (fence) {
                const code = [];
                i += 1;
                while (i < lines.length && !/^\x60\x60\x60\s*$/.test(lines[i])) {
                    code.push(lines[i]);
                    i += 1;
                }
                if (i < lines.length) {
                    i += 1;
                }
                html.push(
                    '<pre><code' +
                        (fence[1] ? ' class="language-' + escapeHtml(fence[1]) + '"' : "") +
                        ">" +
                        escapeHtml(code.join("\n")) +
                        "</code></pre>",
                );
                continue;
            }

            if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
                html.push("<hr />");
                i += 1;
                continue;
            }

            const heading = /^(#{1,6})\s+(.+)$/.exec(line);
            if (heading) {
                const level = heading[1].length;
                html.push(
                    "<h" + level + ">" + renderInline(heading[2]) + "</h" + level + ">",
                );
                i += 1;
                continue;
            }

            if (/^\s*> ?/.test(line)) {
                const quoteLines = [];
                while (i < lines.length && /^\s*> ?/.test(lines[i])) {
                    quoteLines.push(lines[i].replace(/^\s*> ?/, ""));
                    i += 1;
                }
                html.push("<blockquote><p>" + renderInline(quoteLines.join(" ")) + "</p></blockquote>");
                continue;
            }

            const listMatch = /^\s*([-*+]|\d+\.)\s+(.+)$/.exec(line);
            if (listMatch) {
                const ordered = /\d+\./.test(listMatch[1]);
                const tagName = ordered ? "ol" : "ul";
                const items = [];

                while (i < lines.length) {
                    const current = lines[i];
                    const match = /^\s*([-*+]|\d+\.)\s+(.+)$/.exec(current);
                    if (!match || (/\d+\./.test(match[1]) !== ordered)) {
                        break;
                    }
                    items.push(match[2]);
                    i += 1;
                }

                html.push(
                    "<" +
                        tagName +
                        ">" +
                        items.map((item) => "<li>" + renderInline(item) + "</li>").join("") +
                        "</" +
                        tagName +
                        ">",
                );
                continue;
            }

            const paragraphLines = [line.trim()];
            i += 1;
            while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
                paragraphLines.push(lines[i].trim());
                i += 1;
            }
            html.push("<p>" + renderInline(paragraphLines.join(" ")) + "</p>");
        }

        return html.join("");
    };

    const setPreview = () => {
        preview.innerHTML = renderMarkdown(textarea.value);
    };
    window.refreshMarkdownPreview = setPreview;

    const selection = () => ({
        start: textarea.selectionStart ?? textarea.value.length,
        end: textarea.selectionEnd ?? textarea.value.length,
        value: textarea.value,
    });

    const replaceRange = (start, end, replacement, cursorStart = null, cursorEnd = null) => {
        const nextValue = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);
        textarea.value = nextValue;
        const begin = cursorStart === null ? start + replacement.length : start + cursorStart;
        const finish = cursorEnd === null ? begin : start + cursorEnd;
        textarea.focus();
        textarea.setSelectionRange(begin, finish);
        setPreview();
    };

    const wrapSelection = (before, after, placeholder) => {
        const { start, end, value } = selection();
        const selected = value.slice(start, end);
        const insert = selected || placeholder;
        const replacement = before + insert + after;
        const cursorStart = before.length;
        const cursorEnd = before.length + insert.length;
        replaceRange(start, end, replacement, cursorStart, cursorEnd);
    };

    const prefixCurrentLines = (marker, fallback = marker) => {
        const { start, end, value } = selection();
        const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const lineEndIndex = value.indexOf("\n", end);
        const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
        const block = value.slice(lineStart, lineEnd);
        const lines = block ? block.split("\n") : [""];
        const next = lines
            .map((line) => (line.length ? marker + line : fallback))
            .join("\n");
        replaceRange(lineStart, lineEnd, next, next.length, next.length);
    };

    const insertAtCursor = (text, offset = text.length) => {
        const { start, end } = selection();
        replaceRange(start, end, text, offset, offset);
    };

    const uploadImage = () => {
        if (!imageInput || typeof window.uploadPostBodyImage !== "function") {
            wrapSelection("![", "](https://example.com/image.png)", "alt text");
            return;
        }
        imageInput.click();
    };

    imageInput?.addEventListener("change", async () => {
        const file = imageInput.files?.[0];
        imageInput.value = "";
        if (!file) return;
        try {
            const url = await window.uploadPostBodyImage(file);
            const alt = file.name.replace(/\.[^.]+$/, "").replace(/[\[\]]/g, "") || "图片";
            insertAtCursor("![" + alt + "](" + url + ")");
        } catch (error) {
            window.reportPostMediaError?.(error);
        }
    });

    const isInsideMath = (value, position) => {
        const before = value.slice(0, position);
        let dollarCount = 0;
        for (let i = 0; i < before.length; i += 1) {
            if (before[i] === "$" && before[i - 1] !== "\\") {
                dollarCount += 1;
            }
        }
        return dollarCount % 2 === 1 || /\\\([^\)]*$/.test(before) || /\\\[[^\]]*$/.test(before);
    };

    const insertMathSnippet = (snippet, cursorStart = snippet.length, cursorEnd = cursorStart) => {
        const { start, end, value } = selection();
        const needsWrapper = !isInsideMath(value, start);
        const replacement = needsWrapper ? "$" + snippet + "$" : snippet;
        const wrapperOffset = needsWrapper ? 1 : 0;
        replaceRange(
            start,
            end,
            replacement,
            wrapperOffset + cursorStart,
            wrapperOffset + cursorEnd,
        );
    };

    const insertFraction = () => {
        const { start, end, value } = selection();
        const selected = value.slice(start, end) || "a";
        const snippet = "\\frac{" + selected + "}{b}";
        const denominatorStart = snippet.length - 2;
        insertMathSnippet(snippet, denominatorStart, denominatorStart + 1);
    };

    const insertDisplayMath = () => {
        const { start, end, value } = selection();
        const selected = value.slice(start, end) || "x = y";
        const replacement = "$$\n" + selected + "\n$$";
        replaceRange(start, end, replacement, 3, 3 + selected.length);
    };

    const actions = {
        "heading-1": () => prefixCurrentLines("# ", "# "),
        "heading-2": () => prefixCurrentLines("## ", "## "),
        "heading-3": () => prefixCurrentLines("### ", "### "),
        bold: () => wrapSelection("**", "**", "bold text"),
        italic: () => wrapSelection("*", "*", "italic text"),
        strike: () => wrapSelection("~~", "~~", "strikethrough"),
        link: () => wrapSelection("[", "](https://example.com)", "link text"),
        image: uploadImage,
        code: () => wrapSelection("\x60", "\x60", "code"),
        quote: () => prefixCurrentLines("> ", "> "),
        hr: () => insertAtCursor("\n\n---\n\n", 2),
        ul: () => prefixCurrentLines("- ", "- "),
        ol: () => prefixCurrentLines("1. ", "1. "),
        "math-inline": () => wrapSelection("$", "$", "x"),
        "math-block": insertDisplayMath,
        "math-frac": insertFraction,
        "math-sup": () => insertMathSnippet("x^{2}", 3, 4),
        "math-sub": () => insertMathSnippet("x_{i}", 3, 4),
        "math-sub-sup": () => insertMathSnippet("x_{i}^{n}", 3, 4),
        "math-sum": () => insertMathSnippet("\\sum_{i=1}^{n}", 6, 9),
        "math-ge": () => insertMathSnippet("\\ge"),
        "math-le": () => insertMathSnippet("\\le"),
        "math-because": () => insertMathSnippet("\\because"),
        "math-therefore": () => insertMathSnippet("\\therefore"),
    };

    toolbar.querySelectorAll("button[data-md-action]").forEach((button) => {
        button.addEventListener("click", () => {
            const action = actions[button.dataset.mdAction || ""];
            if (action) {
                action();
            }
        });
    });

    textarea.addEventListener("input", setPreview);
    document.addEventListener("markdown-preview:refresh", setPreview);
    setPreview();
})();
`;
