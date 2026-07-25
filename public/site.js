const applyTheme = () => {
    const savedTheme = localStorage.getItem("theme");
    const theme = ["dark", "light"].includes(savedTheme)
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
};

applyTheme();

document.querySelector(".menu")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const isExpanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!isExpanded));
});

document.querySelectorAll(".nav-group-toggle").forEach((button) => {
    button.addEventListener("click", () => {
        const group = button.closest(".nav-group");
        const isExpanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!isExpanded));
        group?.classList.toggle("open", !isExpanded);
    });
});

document.querySelector("#themeToggle")?.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
});

const searchInput = document.querySelector("#site-search");
const searchResults = document.querySelector("#search-results");
let searchPosts = [];

const clearResults = () => {
    if (!searchResults) {
        return;
    }
    searchResults.innerHTML = "";
    searchResults.hidden = true;
};

const renderResults = (posts) => {
    if (!searchResults) {
        return;
    }

    if (posts.length === 0) {
        searchResults.innerHTML = '<p class="search-empty">没有找到文章</p>';
        searchResults.hidden = false;
        return;
    }

    searchResults.innerHTML = posts
        .map(
            (post) => `
                <a class="search-result" href="${post.url}">
                    <span>${post.title}</span>
                    <small>${post.author} · ${post.category ?? "未分类"} · ${post.pubDate}</small>
                </a>
            `,
        )
        .join("");
    searchResults.hidden = false;
};

const search = (keyword) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
        clearResults();
        return;
    }

    const results = searchPosts
        .filter((post) => {
            const haystack = [
                post.title,
                post.author,
                post.category,
                post.description,
                ...(post.tags ?? []),
            ]
                .join(" ")
                .toLowerCase();
            return haystack.includes(normalizedKeyword);
        })
        .slice(0, 6);

    renderResults(results);
};

if (searchInput && searchResults) {
    fetch("/search.json")
        .then((response) => response.json())
        .then((posts) => {
            searchPosts = posts;
        })
        .catch(() => {
            searchPosts = [];
        });

    searchInput.addEventListener("input", () => search(searchInput.value));
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            searchInput.value = "";
            clearResults();
        }
    });
}

const guestbookForm = document.querySelector("#guestbook-form");
const guestbookSky = document.querySelector("#guestbook-sky");
const guestbookStatus = document.querySelector("#guestbook-status");

const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[char]);

const hashText = (value) => {
    let hash = 0;
    for (const char of String(value)) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return hash;
};

const renderGuestbookCloud = (message, index, layout) => {
    const seed = hashText(message.id || `${message.createdAt}-${message.content}`);
    const tone = (seed % 5) + 1;
    const scale = 86 + (seed % 34);
    const drift = index % 2 === 0 ? "normal" : "reverse";
    const nickname = escapeHtml(message.nickname || "匿名小猫");
    const content = escapeHtml(message.content || "");

    return `
        <article
            class="guestbook-cloud tone-${tone}"
            style="--x:${layout.x}; --y:${layout.y}; --scale:${scale}; --drift:${drift};"
            title="${nickname}"
            data-author="${nickname}"
        >
            <p>${content}</p>
        </article>
    `;
};

const createGuestbookCloudLayouts = (messages) => {
    const placed = [];
    const skyHeight = Math.max(520, messages.length * 74);

    return messages.map((message, index) => {
        const seed = hashText(message.id || `${message.createdAt}-${message.content}`);
        const scale = 86 + (seed % 34);
        const box = estimateGuestbookCloudBox(message, scale, skyHeight);

        for (let attempt = 0; attempt < 140; attempt += 1) {
            const candidate = {
                x: randomFloat(4 + box.width / 2, 96 - box.width / 2),
                y: randomFloat(5 + box.height / 2, 95 - box.height / 2),
                ...box,
            };

            if (!placed.some((item) => overlaps(candidate, item))) {
                placed.push(candidate);
                return candidate;
            }
        }

        const fallback = createGuestbookGridPosition(index, messages.length, box);
        placed.push(fallback);
        return fallback;
    });
};

const estimateGuestbookCloudBox = (message, scale, skyHeight) => {
    const visualLength = [...String(message.content ?? "")].reduce(
        (total, char) => total + (char.charCodeAt(0) > 255 ? 2 : 1),
        0,
    );
    const widthPx = Math.min(300, Math.max(120, 72 + visualLength * 10)) * (scale / 100);
    const heightPx = (visualLength > 34 ? 92 : visualLength > 18 ? 74 : 58) * (scale / 100);

    return {
        width: (widthPx / 650) * 100,
        height: (heightPx / skyHeight) * 100,
    };
};

const createGuestbookGridPosition = (index, total, box) => {
    const columns = 3;
    const rows = Math.max(1, Math.ceil(total / columns));
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
        x: clamp(((column + 0.5) / columns) * 88 + 6 + randomFloat(-3, 3), 4 + box.width / 2, 96 - box.width / 2),
        y: clamp(((row + 0.5) / rows) * 90 + 5 + randomFloat(-2, 2), 5 + box.height / 2, 95 - box.height / 2),
        ...box,
    };
};

const overlaps = (a, b) => {
    const gap = 1.5;
    return Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap
        && Math.abs(a.y - b.y) < (a.height + b.height) / 2 + gap;
};

const randomFloat = (min, max) => Number((Math.random() * (max - min) + min).toFixed(2));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const renderGuestbookMessages = (messages) => {
    if (!guestbookSky) {
        return;
    }

    guestbookSky.style.setProperty("--cloud-count", String(messages.length));
    const cloudLayouts = createGuestbookCloudLayouts(messages);
    guestbookSky.innerHTML = messages.length > 0
        ? messages.map((message, index) => renderGuestbookCloud(message, index, cloudLayouts[index])).join("")
        : '<p class="guestbook-empty">还没有留言，第一朵云等你来放飞。</p>';
};

if (guestbookForm && guestbookSky) {
    guestbookForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = guestbookForm.querySelector('button[type="submit"]');
        const formData = new FormData(guestbookForm);
        const payload = {
            nickname: formData.get("nickname"),
            content: formData.get("content"),
        };

        if (guestbookStatus) {
            guestbookStatus.textContent = "正在放飞留言...";
        }
        submitButton.disabled = true;

        try {
            const response = await fetch("/api/guestbook", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "留言失败");
            }

            const listResponse = await fetch("/api/guestbook");
            const listResult = await listResponse.json();
            renderGuestbookMessages(listResult.messages || [result.message]);
            guestbookForm.reset();
            if (guestbookStatus) {
                guestbookStatus.textContent = "留言已经变成云啦。";
            }
        } catch (error) {
            if (guestbookStatus) {
                guestbookStatus.textContent = error.message || "留言失败，请稍后再试。";
            }
        } finally {
            submitButton.disabled = false;
        }
    });
}
