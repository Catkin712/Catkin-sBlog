const searchInput = document.querySelector("#site-search");
const searchResults = document.querySelector("#search-results");

let searchPosts = [];

const clearResults = () => {
    if (searchResults) {
        searchResults.innerHTML = "";
        searchResults.hidden = true;
    }
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
