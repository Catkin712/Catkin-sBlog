const reactionSection = document.querySelector("[data-post-reactions]");

if (reactionSection) {
    const slug = reactionSection.dataset.postSlug;

    reactionSection.querySelectorAll("[data-post-action]").forEach((button) => {
        button.addEventListener("click", () => {
            const type = button.dataset.postAction;
            const form = reactionSection.querySelector(`[data-post-reaction-form="${type}"]`);
            if (!form) return;
            const willOpen = form.hidden;
            reactionSection.querySelectorAll("[data-post-reaction-form]").forEach((item) => {
                item.hidden = true;
            });
            reactionSection.querySelectorAll("[data-post-action]").forEach((item) => {
                item.setAttribute("aria-expanded", "false");
            });
            form.hidden = !willOpen;
            button.setAttribute("aria-expanded", String(willOpen));
            if (willOpen) form.elements.nickname.focus();
        });
    });

    reactionSection.querySelectorAll("[data-post-reaction-form]").forEach((form) => {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const type = form.dataset.postReactionForm;
            const status = form.querySelector(".post-reaction-status");
            const submitButton = form.querySelector('button[type="submit"]');
            const formData = new FormData(form);
            const payload = { nickname: formData.get("nickname") };
            if (type === "comment") payload.content = formData.get("content");

            status.textContent = "正在提交...";
            submitButton.disabled = true;
            try {
                const endpoint = type === "like" ? "likes" : "comments";
                const response = await fetch(`/api/posts/${encodeURIComponent(slug)}/${endpoint}`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || "提交失败");

                if (type === "like") appendPostLike(result.like);
                else appendPostComment(result.comment);
                form.reset();
                form.hidden = true;
                reactionSection.querySelector(`[data-post-action="${type}"]`)?.setAttribute("aria-expanded", "false");
                status.textContent = "";
            } catch (error) {
                status.textContent = error.message || "提交失败，请稍后再试";
            } finally {
                submitButton.disabled = false;
            }
        });
    });
}

function appendPostLike(like) {
    const content = reactionSection.querySelector(".post-reaction-content");
    const list = reactionSection.querySelector("[data-like-list]");
    const names = list.querySelector("span");
    names.textContent = names.textContent ? `${names.textContent}、${like.nickname}` : like.nickname;
    list.hidden = false;
    content.classList.add("has-content");
    incrementCount("[data-like-count]");
}

function appendPostComment(comment) {
    const content = reactionSection.querySelector(".post-reaction-content");
    const list = reactionSection.querySelector("[data-comment-list]");
    const paragraph = document.createElement("p");
    paragraph.dataset.commentId = String(comment.id);
    const author = document.createElement("strong");
    author.textContent = `${comment.nickname}：`;
    const message = document.createElement("span");
    message.textContent = comment.content;
    paragraph.append(author, message);
    list.append(paragraph);
    content.classList.add("has-content");
    incrementCount("[data-comment-count]");
}

function incrementCount(selector) {
    const count = reactionSection.querySelector(selector);
    count.textContent = String(Number(count.textContent || 0) + 1);
}
