const albumEscapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
})[character]);
const maxClientUploadBytes = 90 * 1024 * 1024;

const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

document.querySelectorAll("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(button.dataset.openDialog)?.showModal());
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    });
});

const albumRoot = document.querySelector("[data-album-mode]");
const albumModeDialog = document.querySelector("#album-mode-dialog");
const albumModeForm = document.querySelector("#album-mode-form");

document.querySelectorAll("[data-album-view]").forEach((button) => {
    button.addEventListener("click", async () => {
        const requestedMode = button.dataset.albumView;
        const currentMode = albumRoot?.dataset.albumMode || "public";
        if (requestedMode === currentMode) return;
        if (requestedMode === "inner") {
            albumModeDialog?.showModal();
            albumModeForm?.elements.password.focus();
            return;
        }

        button.disabled = true;
        try {
            await fetch("/api/album-mode", { method: "DELETE" });
        } finally {
            location.href = location.pathname;
        }
    });
});

if (albumModeForm) {
    albumModeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = albumModeForm.querySelector(".dialog-status");
        const button = albumModeForm.querySelector('button[type="submit"]');
        status.textContent = "正在验证...";
        status.classList.remove("error");
        button.disabled = true;
        try {
            const response = await fetch("/api/album-mode", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ password: new FormData(albumModeForm).get("password") }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "验证失败");
            location.href = `${location.pathname}?view=inner`;
        } catch (error) {
            status.textContent = error.message || "验证失败，请稍后再试";
            status.classList.add("error");
            button.disabled = false;
        }
    });
}

if (albumRoot?.dataset.albumMode === "public" && new URLSearchParams(location.search).get("view") === "inner") {
    albumModeDialog?.showModal();
}

if (new URLSearchParams(location.search).get("uploaded") === "inner" && albumRoot) {
    const notice = document.createElement("p");
    notice.className = "album-notice";
    notice.textContent = "里图上传成功，进入里图模式后即可查看。";
    albumRoot.querySelector(".album-mode-bar")?.insertAdjacentElement("afterend", notice);
    history.replaceState(null, "", location.pathname);
}

const createAlbumForm = document.querySelector("#create-album-form");
if (createAlbumForm) {
    createAlbumForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = createAlbumForm.querySelector(".dialog-status");
        const button = createAlbumForm.querySelector('button[type="submit"]');
        status.textContent = "正在创建...";
        status.classList.remove("error");
        button.disabled = true;
        try {
            const response = await fetch("/api/albums", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name: new FormData(createAlbumForm).get("name") }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "创建失败");
            const modeQuery = albumRoot?.dataset.albumMode === "inner" ? "?view=inner" : "";
            location.href = `/album/${result.album.id}/${modeQuery}`;
        } catch (error) {
            status.textContent = error.message || "创建失败，请稍后再试";
            status.classList.add("error");
            button.disabled = false;
        }
    });
}

const uploadForm = document.querySelector("#album-upload-form");
if (uploadForm) {
    const photoInput = uploadForm.elements.photos;
    const nicknameInput = uploadForm.elements.nickname;
    const avatarInput = uploadForm.elements.avatar;
    const avatarHint = uploadForm.querySelector("#avatar-hint");
    const preview = uploadForm.querySelector("#photo-preview");
    const selectionSummary = uploadForm.querySelector("#photo-selection-summary");
    const uploadProgress = uploadForm.querySelector("#upload-progress");
    let previewUrls = [];

    photoInput.addEventListener("change", () => {
        previewUrls.forEach(URL.revokeObjectURL);
        previewUrls = [];
        const files = [...photoInput.files].slice(0, 20);
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        preview.innerHTML = files.map((file, index) => {
            const url = URL.createObjectURL(file);
            previewUrls.push(url);
            return `<div class="preview-item"><img src="${url}" alt="" /><span>${index + 1}</span></div>`;
        }).join("");
        selectionSummary.textContent = files.length
            ? `已选择 ${files.length} 张，共 ${formatFileSize(totalBytes)}${totalBytes > maxClientUploadBytes ? "，超过单次上传限制" : ""}`
            : "";
        selectionSummary.classList.toggle("error", totalBytes > maxClientUploadBytes);
    });

    let nicknameRequest = 0;
    const checkNickname = async () => {
        const nickname = nicknameInput.value.trim();
        const requestId = ++nicknameRequest;
        avatarInput.required = !nickname;
        avatarHint.classList.remove("ready");
        avatarHint.textContent = nickname ? "正在检查这个昵称..." : "昵称第一次上传时必须选择头像。";
        if (!nickname) return;
        try {
            const response = await fetch(`/api/album-uploaders?nickname=${encodeURIComponent(nickname)}`);
            const result = await response.json();
            if (requestId !== nicknameRequest || !response.ok) return;
            avatarInput.required = !result.hasAvatar;
            avatarHint.textContent = result.hasAvatar
                ? `已找到 ${result.nickname} 的头像；不选择新头像会继续使用原头像。`
                : "这个昵称是第一次上传，请选择一张头像。";
            avatarHint.classList.toggle("ready", result.hasAvatar);
        } catch {
            avatarInput.required = true;
            avatarHint.textContent = "暂时无法确认昵称，请选择头像后上传。";
        }
    };
    nicknameInput.addEventListener("blur", checkNickname);
    nicknameInput.addEventListener("change", checkNickname);

    uploadForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = uploadForm.querySelector(".dialog-status");
        const button = uploadForm.querySelector('button[type="submit"]');
        const files = [...photoInput.files];
        const data = new FormData(uploadForm);
        const hasAlbum = data.getAll("albumIds").length > 0 || String(data.get("newAlbumName") || "").trim();
        const visibility = String(data.get("visibility") || "");
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0) + ([...avatarInput.files][0]?.size || 0);

        status.classList.remove("error");
        if (!visibility) return showUploadError(status, "请选择上传表图还是里图");
        if (!hasAlbum) return showUploadError(status, "请至少选择或新建一个相册");
        if (files.length === 0) return showUploadError(status, "请至少选择一张照片");
        if (files.length > 20) return showUploadError(status, "每次最多上传 20 张照片");
        if (files.some((file) => file.size > 20 * 1024 * 1024)) return showUploadError(status, "单张照片不能超过 20 MB");
        if (totalBytes > maxClientUploadBytes) return showUploadError(status, `本批文件共 ${formatFileSize(totalBytes)}，单次上传不能超过 90 MB`);

        status.textContent = `正在上传 ${files.length} 张照片，请不要关闭页面...`;
        uploadProgress.hidden = false;
        uploadProgress.value = 0;
        button.disabled = true;
        try {
            const result = await uploadAlbumPhotos(data, files, avatarInput.files[0] || null, {
                onProgress: (percent) => {
                    uploadProgress.value = percent;
                    status.textContent = `正在上传 ${files.length} 张照片：${percent}%`;
                },
                onUploaded: () => {
                    uploadProgress.value = 100;
                    status.textContent = "照片已送达 VPS，正在写入相册...";
                },
            });
            const currentAlbum = location.pathname.match(/^\/album\/(\d+)\/?$/)?.[1];
            const targetAlbum = result.upload.albumIds.includes(Number(currentAlbum))
                ? currentAlbum
                : result.upload.albumIds[0];
            const currentMode = albumRoot?.dataset.albumMode || "public";
            const modeQuery = currentMode === "inner"
                ? "?view=inner"
                : result.upload.visibility === "inner"
                    ? "?uploaded=inner"
                    : "";
            location.href = `/album/${targetAlbum}/${modeQuery}`;
        } catch (error) {
            const message = error instanceof TypeError
                ? `上传连接中断（本批共 ${formatFileSize(totalBytes)}），请减少本次选择的照片后重试`
                : error.message || "上传失败，请稍后再试";
            showUploadError(status, message);
            button.disabled = false;
            uploadProgress.hidden = true;
        }
    });
}

async function uploadAlbumPhotos(data, files, avatar, { onProgress, onUploaded }) {
    const payload = {
        nickname: data.get("nickname"),
        people: data.get("people"),
        location: data.get("location"),
        message: data.get("message"),
        albumIds: data.getAll("albumIds"),
        newAlbumName: data.get("newAlbumName"),
        visibility: data.get("visibility"),
        photos: files.map((file) => ({ name: file.name, size: file.size, mimeType: file.type })),
        avatar: avatar ? { name: avatar.name, size: avatar.size, mimeType: avatar.type } : null,
    };
    const sessionResponse = await fetch("/api/album-upload-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    });
    const sessionResult = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok) throw new Error(sessionResult.error || `上传会话创建失败（HTTP ${sessionResponse.status}）`);
    const session = sessionResult.session;
    const totalBytes = session.uploads.reduce((sum, item) => sum + item.size, 0);
    let completedBytes = 0;
    const loadedByUpload = new Map();
    await Promise.all(session.uploads.map((item) => {
        const file = item.field === "avatar" ? avatar : files[item.index];
        return putCosObject(item.url, file, (loaded) => {
            loadedByUpload.set(`${item.field}:${item.index}`, loaded);
            const inFlightBytes = [...loadedByUpload.values()].reduce((sum, value) => sum + value, 0);
            onProgress(Math.min(99, Math.round(((completedBytes + inFlightBytes) / totalBytes) * 100)));
        }).then(() => {
            loadedByUpload.delete(`${item.field}:${item.index}`);
            completedBytes += item.size;
            onProgress(Math.min(99, Math.round((completedBytes / totalBytes) * 100)));
        });
    }));
    onUploaded();
    const completeResponse = await fetch(`/api/album-upload-sessions/${encodeURIComponent(session.sessionId)}/complete`, { method: "POST" });
    const completeResult = await completeResponse.json().catch(() => ({}));
    if (!completeResponse.ok) throw new Error(completeResult.error || `服务器保存失败（HTTP ${completeResponse.status}）`);
    return completeResult;
}

function putCosObject(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", url);
        request.timeout = 10 * 60 * 1000;
        request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        request.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) onProgress(event.loaded);
        });
        request.addEventListener("load", () => request.status >= 200 && request.status < 300
            ? resolve()
            : reject(new Error(`COS 上传失败（HTTP ${request.status}）`)));
        request.addEventListener("error", () => reject(new TypeError("COS 上传连接中断")));
        request.addEventListener("timeout", () => reject(new TypeError("COS 上传超时")));
        request.addEventListener("abort", () => reject(new TypeError("COS 上传已取消")));
        request.send(file);
    });
}

/* legacy upload removed */
/*
function uploadAlbumPhotosLegacy(data, { onProgress, onUploaded }) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        const uploadOrigin = String(albumRoot?.dataset.albumUploadOrigin || "").replace(/\/+$/, "");
        request.open("POST", `${uploadOrigin}/api/album-uploads`);
        request.timeout = 10 * 60 * 1000;
        request.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
                onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
            }
        });
        request.upload.addEventListener("load", onUploaded);
        request.addEventListener("load", () => {
            let result = {};
            try {
                result = JSON.parse(request.responseText || "{}");
            } catch {
                reject(new Error(`服务器返回了无法识别的响应（HTTP ${request.status || "未知"}）`));
                return;
            }
            if (request.status < 200 || request.status >= 300) {
                reject(new Error(result.error || `上传失败（HTTP ${request.status}）`));
                return;
            }
            resolve(result);
        });
        request.addEventListener("error", () => reject(new TypeError("上传连接中断")));
        request.addEventListener("timeout", () => reject(new Error("上传超过 10 分钟仍未完成，请减少照片数量后重试")));
        request.addEventListener("abort", () => reject(new Error("上传已取消")));
        request.send(data);
    });
}
*/

function showUploadError(status, message) {
    status.textContent = message;
    status.classList.add("error");
}

document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
        const moment = button.closest(".moment");
        const form = moment?.querySelector(`[data-reaction-form="${button.dataset.action}"]`);
        if (!form) return;
        const willOpen = form.hidden;
        moment.querySelectorAll(".reaction-form").forEach((item) => { item.hidden = true; });
        moment.querySelectorAll("[data-action]").forEach((item) => item.setAttribute("aria-expanded", "false"));
        form.hidden = !willOpen;
        button.setAttribute("aria-expanded", String(willOpen));
        if (willOpen) form.elements.nickname.focus();
    });
});

document.querySelectorAll("[data-reaction-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const type = form.dataset.reactionForm;
        const uploadId = form.dataset.uploadId;
        const status = form.querySelector(".inline-status");
        const button = form.querySelector('button[type="submit"]');
        const data = new FormData(form);
        const payload = { nickname: data.get("nickname") };
        if (type === "comment") payload.content = data.get("content");
        status.textContent = "正在提交...";
        button.disabled = true;
        try {
            const response = await fetch(`/api/album-uploads/${uploadId}/${type === "like" ? "likes" : "comments"}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "提交失败");
            const moment = form.closest(".moment");
            if (type === "like") appendLike(moment, result.like.nickname);
            else appendComment(moment, result.comment);
            form.reset();
            form.hidden = true;
            moment.querySelector(`[data-action="${type}"]`)?.setAttribute("aria-expanded", "false");
        } catch (error) {
            status.textContent = error.message || "提交失败，请稍后再试";
        } finally {
            button.disabled = false;
        }
    });
});

function appendLike(moment, nickname) {
    const box = moment.querySelector(".reaction-box");
    const list = box.querySelector(".like-list");
    const names = list.querySelector("span");
    names.textContent = names.textContent ? `${names.textContent}、${nickname}` : nickname;
    list.hidden = false;
    box.classList.add("has-content");
}

function appendComment(moment, comment) {
    const box = moment.querySelector(".reaction-box");
    const list = box.querySelector(".comment-list");
    list.insertAdjacentHTML("beforeend", `<p data-comment-id="${Number(comment.id)}"><strong>${albumEscapeHtml(comment.nickname)}：</strong>${albumEscapeHtml(comment.content)}</p>`);
    box.classList.add("has-content");
}

const lightbox = document.querySelector("#photo-lightbox");
document.querySelectorAll("[data-lightbox-src]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!lightbox) return;
        const image = lightbox.querySelector("img");
        image.src = button.dataset.lightboxSrc;
        image.alt = button.dataset.lightboxAlt || "相册照片";
        lightbox.showModal();
    });
});
