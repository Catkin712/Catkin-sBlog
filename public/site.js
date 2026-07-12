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
                    <small>${post.author} · ${post.pubDate}</small>
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
