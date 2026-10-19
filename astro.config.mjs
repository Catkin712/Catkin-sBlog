// @ts-check
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import preact from "@astrojs/preact";

// https://astro.build/config
export default defineConfig({
    site: "https://www.catkins.vip/",
    integrations: [preact()],
    markdown: {
        processor: unified({
            remarkPlugins: [remarkMath],
            rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: "ignore" }]],
        }),
    },
});
