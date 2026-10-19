(() => {
    const state = {
        albums: [],
        uploads: [],
        selectedUploadId: null,
        filter: "",
    };

    const elements = {
        refresh: document.querySelector("#refreshUploads"),
        logout: document.querySelector("#logout"),
        filter: document.querySelector("#uploadFilter"),
        list: document.querySelector("#uploadList"),
        empty: document.querySelector("#emptyState"),
        editor: document.querySelector("#uploadEditor"),
        title: document.querySelector("#editorTitle"),
        summary: document.querySelector("#editorSummary"),
        pageStatus: document.querySelector("#pageStatus"),
        form: document.querySelector("#uploadMetadataForm"),
        nickname: document.querySelector("#uploadNickname"),
        createdAt: document.querySelector("#uploadCreatedAt"),
        people: document.querySelector("#uploadPeople"),
        location: document.querySelector("#uploadLocation"),
        message: document.querySelector("#uploadMessage"),
        albumOptions: document.querySelector("#albumOptions"),
        metadataStatus: document.querySelector("#metadataStatus"),
        photoGrid: document.querySelector("#photoGrid"),
    };

    elements.refresh.addEventListener("click", () => loadUploads(state.selectedUploadId));
    elements.filter.addEventListener("input", () => {
        state.filter = elements.filter.value.trim().toLocaleLowerCase("zh-CN");
        renderUploadList();
    });
    elements.form.addEventListener("submit", saveUploadMetadata);
    elements.logout.addEventListener("click", logout);

    loadUploads();

    async function loadUploads(preferredUploadId = null) {
        setPageStatus("正在加载...");
        elements.refresh.disabled = true;
        try {
            const data = await requestJson("/api/admin/album-uploads");
            state.albums = Array.isArray(data.albums) ? data.albums : [];
            state.uploads = Array.isArray(data.uploads) ? data.uploads : [];
            const preferredExists = state.uploads.some((upload) => upload.id === preferredUploadId);
            const selectedExists = state.uploads.some((upload) => upload.id === state.selectedUploadId);
            state.selectedUploadId = preferredExists
                ? preferredUploadId
                : selectedExists
                    ? state.selectedUploadId
                    : state.uploads[0]?.id ?? null;
            render();
            setPageStatus("");
        } catch (error) {
            showLoadError(error);
        } finally {
            elements.refresh.disabled = false;
        }
    }

    function render() {
        renderUploadList();
        renderEditor();
    }

    function renderUploadList() {
        elements.list.replaceChildren();
        const uploads = filteredUploads();
        if (uploads.length === 0) {
            const message = document.createElement("p");
            message.className = "status";
            message.textContent = state.uploads.length === 0 ? "暂无上传记录" : "没有匹配的上传记录";
            elements.list.append(message);
            return;
        }

        const fragment = document.createDocumentFragment();
        uploads.forEach((upload) => {
            const button = document.createElement("button");
            button.type = "button";
            button.classList.toggle("active", upload.id === state.selectedUploadId);
            button.setAttribute("aria-pressed", String(upload.id === state.selectedUploadId));

            const name = document.createElement("strong");
            name.textContent = `${upload.nickname} · ${upload.photos.length} 张`;
            const albums = document.createElement("span");
            albums.textContent = upload.albums.map((album) => album.name).join("、") || "未归入相册";
            const date = document.createElement("span");
            date.textContent = `${upload.visibility === "inner" ? "里图" : "表图"} · ${formatDate(upload.createdAt)}`;
            button.append(name, albums, date);
            button.addEventListener("click", () => {
                state.selectedUploadId = upload.id;
                render();
            });
            fragment.append(button);
        });
        elements.list.append(fragment);
    }

    function filteredUploads() {
        if (!state.filter) return state.uploads;
        return state.uploads.filter((upload) => [
            upload.nickname,
            upload.people,
            upload.location,
            upload.message,
            upload.createdAt,
            ...upload.albums.map((album) => album.name),
            ...upload.photos.map((photo) => photo.originalName),
        ].some((value) => String(value || "").toLocaleLowerCase("zh-CN").includes(state.filter)));
    }

    function renderEditor() {
        const upload = selectedUpload();
        elements.empty.hidden = Boolean(upload);
        elements.editor.hidden = !upload;
        if (!upload) {
            elements.empty.textContent = state.uploads.length === 0
                ? "暂无上传记录。"
                : "请选择一条上传记录。";
            return;
        }

        elements.title.textContent = `编辑上传记录 #${upload.id}`;
        elements.summary.textContent = `${upload.photos.length} 张照片 · ${upload.likeCount} 人点赞 · ${upload.commentCount} 条评论`;
        elements.nickname.value = upload.nickname || "";
        elements.createdAt.value = toDateTimeLocal(upload.createdAt);
        elements.people.value = upload.people || "";
        elements.location.value = upload.location || "";
        elements.message.value = upload.message || "";
        const visibility = elements.form.querySelector(`input[name="uploadVisibility"][value="${upload.visibility}"]`);
        if (visibility) visibility.checked = true;
        setMetadataStatus("");
        renderAlbumOptions(upload);
        renderPhotos(upload);
    }

    function renderAlbumOptions(upload) {
        const selectedIds = new Set(upload.albums.map((album) => album.id));
        elements.albumOptions.replaceChildren();
        state.albums.forEach((album) => {
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.name = "albumIds";
            input.value = String(album.id);
            input.checked = selectedIds.has(album.id);
            label.append(input, document.createTextNode(album.name));
            elements.albumOptions.append(label);
        });
    }

    function renderPhotos(upload) {
        elements.photoGrid.replaceChildren();
        upload.photos.forEach((photo) => {
            const item = document.createElement("article");
            item.className = "photo-item";

            const image = document.createElement("img");
            image.src = photo.url;
            image.alt = photo.originalName || "相册照片";
            image.loading = "lazy";

            const label = document.createElement("label");
            label.append(document.createTextNode("照片名称"));
            const input = document.createElement("input");
            input.value = photo.originalName || "";
            input.maxLength = 160;
            input.required = true;
            label.append(input);

            const meta = document.createElement("p");
            meta.className = "photo-meta";
            meta.textContent = `${photo.mimeType || "未知格式"} · ${formatBytes(photo.byteSize)}`;

            const actions = document.createElement("div");
            actions.className = "photo-actions";
            const save = document.createElement("button");
            save.type = "button";
            save.textContent = "保存名称";
            save.addEventListener("click", () => savePhotoName(upload.id, photo.id, input, save));
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "danger";
            remove.textContent = "删除照片";
            remove.addEventListener("click", () => deletePhoto(upload, photo, remove));
            actions.append(save, remove);

            const status = document.createElement("p");
            status.className = "status";
            status.dataset.photoStatus = String(photo.id);
            item.append(image, label, meta, actions, status);
            elements.photoGrid.append(item);
        });
    }

    async function saveUploadMetadata(event) {
        event.preventDefault();
        const upload = selectedUpload();
        if (!upload) return;
        const submit = elements.form.querySelector('button[type="submit"]');
        const albumIds = [...elements.form.querySelectorAll('input[name="albumIds"]:checked')]
            .map((input) => Number(input.value));
        const visibility = elements.form.querySelector('input[name="uploadVisibility"]:checked')?.value;
        setMetadataStatus("正在保存...");
        submit.disabled = true;
        try {
            const data = await requestJson(`/api/admin/album-uploads/${upload.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    nickname: elements.nickname.value,
                    createdAt: new Date(elements.createdAt.value).toISOString(),
                    people: elements.people.value,
                    location: elements.location.value,
                    message: elements.message.value,
                    visibility,
                    albumIds,
                }),
            });
            replaceUpload(data.upload);
            render();
            setMetadataStatus("已保存");
        } catch (error) {
            setMetadataStatus(error.message, true);
        } finally {
            submit.disabled = false;
        }
    }

    async function savePhotoName(uploadId, photoId, input, button) {
        const status = photoStatus(photoId);
        setStatus(status, "正在保存...");
        button.disabled = true;
        try {
            const data = await requestJson(`/api/admin/album-photos/${photoId}`, {
                method: "PATCH",
                body: JSON.stringify({ originalName: input.value }),
            });
            const upload = state.uploads.find((item) => item.id === uploadId);
            const index = upload?.photos.findIndex((photo) => photo.id === photoId) ?? -1;
            if (upload && index >= 0) upload.photos[index] = data.photo;
            input.value = data.photo.originalName;
            imageForPhotoStatus(status).alt = data.photo.originalName;
            setStatus(status, "已保存");
            renderUploadList();
        } catch (error) {
            setStatus(status, error.message, true);
        } finally {
            button.disabled = false;
        }
    }

    async function deletePhoto(upload, photo, button) {
        const isLastPhoto = upload.photos.length === 1;
        const suffix = isLastPhoto ? "这是该上传记录的最后一张照片，上传记录也会一并删除。" : "此操作不可撤销。";
        if (!window.confirm(`确定删除“${photo.originalName}”吗？\n${suffix}`)) return;

        const status = photoStatus(photo.id);
        setStatus(status, "正在删除...");
        button.disabled = true;
        try {
            const data = await requestJson(`/api/admin/album-photos/${photo.id}`, { method: "DELETE" });
            const nextPreferredId = data.result.uploadDeleted ? nextUploadId(upload.id) : upload.id;
            await loadUploads(nextPreferredId);
            if (data.result.cleanupWarning) setPageStatus(data.result.cleanupWarning, true);
            else setPageStatus("照片已删除");
        } catch (error) {
            setStatus(status, error.message, true);
            button.disabled = false;
        }
    }

    async function logout() {
        elements.logout.disabled = true;
        try {
            await requestJson("/api/logout", { method: "POST" });
        } catch {
            // Continue to the login page even if the session has already expired.
        }
        window.location.href = "/admin/";
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            headers: { "content-type": "application/json", ...(options.headers || {}) },
            ...options,
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            window.location.href = "/admin/";
            throw new Error("登录已失效");
        }
        if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
        return data;
    }

    function selectedUpload() {
        return state.uploads.find((upload) => upload.id === state.selectedUploadId) || null;
    }

    function replaceUpload(upload) {
        const index = state.uploads.findIndex((item) => item.id === upload.id);
        if (index >= 0) state.uploads[index] = upload;
        state.uploads.sort((left, right) => {
            const dateDifference = new Date(right.createdAt).valueOf() - new Date(left.createdAt).valueOf();
            return dateDifference || right.id - left.id;
        });
    }

    function nextUploadId(currentId) {
        const index = state.uploads.findIndex((upload) => upload.id === currentId);
        return state.uploads[index + 1]?.id ?? state.uploads[index - 1]?.id ?? null;
    }

    function photoStatus(photoId) {
        return elements.photoGrid.querySelector(`[data-photo-status="${photoId}"]`);
    }

    function imageForPhotoStatus(status) {
        return status.closest(".photo-item").querySelector("img");
    }

    function setPageStatus(message, isError = false) {
        setStatus(elements.pageStatus, message, isError);
    }

    function setMetadataStatus(message, isError = false) {
        setStatus(elements.metadataStatus, message, isError);
    }

    function setStatus(element, message, isError = false) {
        if (!element) return;
        element.textContent = message;
        element.classList.toggle("error", isError);
    }

    function showLoadError(error) {
        elements.editor.hidden = true;
        elements.empty.hidden = false;
        elements.empty.textContent = error.message || "上传记录加载失败";
        setPageStatus(error.message || "上传记录加载失败", true);
    }

    function toDateTimeLocal(value) {
        const date = new Date(value);
        if (Number.isNaN(date.valueOf())) return "";
        const pad = (number) => String(number).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function formatDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.valueOf()) ? String(value || "") : date.toLocaleString("zh-CN", { hour12: false });
    }

    function formatBytes(value) {
        const bytes = Number(value || 0);
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }
})();
