import { escapeAttr, escapeHtml, renderLayout } from "./html.mjs";

export function renderAlbumsPage(albums, { innerMode = false, uploadOrigin = "" } = {}) {
    const body = `
        <section class="albums-page" aria-labelledby="albums-title" data-album-mode="${innerMode ? "inner" : "public"}">
            <header class="albums-header">
                <div>
                    <p class="eyebrow">Shared memories</p>
                    <h1 id="albums-title">集体相册</h1>
                    <p>把同一次相聚的照片放在一起，也可以让它们同时出现在多个相册里。</p>
                </div>
                <div class="album-header-actions">
                    <button class="button secondary" type="button" data-open-dialog="create-album-dialog">新建相册</button>
                    <button class="button primary" type="button" data-open-dialog="upload-dialog">上传照片</button>
                </div>
            </header>

            ${renderModeSwitch(innerMode)}

            <div class="album-grid" id="album-grid">
                ${albums.length > 0 ? albums.map((album) => renderAlbumCard(album, innerMode)).join("") : `
                    <div class="album-empty">
                        <h2>还没有相册</h2>
                        <p>新建第一个相册，收下大家的第一批照片。</p>
                    </div>
                `}
            </div>
            ${renderCreateAlbumDialog()}
            ${renderUploadDialog(albums)}
            ${renderModePasswordDialog()}
        </section>
    `;
    return renderAlbumLayout("集体相册", body);
}

export function renderAlbumPage(album, albums, { innerMode = false, uploadOrigin = "" } = {}) {
    if (!album) {
        return renderAlbumLayout("相册不存在", `
            <section class="album-empty">
                <h1>相册不存在</h1>
                <p>它可能已经被移除，或者链接不完整。</p>
                <a class="button primary" href="/album/${innerMode ? "?view=inner" : ""}">返回全部相册</a>
            </section>
        `);
    }

    const body = `
        <section class="album-detail" aria-labelledby="album-title" data-album-mode="${innerMode ? "inner" : "public"}">
            <a class="album-back" href="/album/${innerMode ? "?view=inner" : ""}">← 全部相册</a>
            <header class="album-detail-header">
                <div>
                    <p class="eyebrow">${album.photoCount} 张照片 · ${album.uploadCount} 次分享</p>
                    <h1 id="album-title">${escapeHtml(album.name)}</h1>
                </div>
                <button class="button primary" type="button" data-open-dialog="upload-dialog">添加照片</button>
            </header>

            ${renderModeSwitch(innerMode)}

            <div class="album-gallery" id="album-gallery" aria-label="相册照片">
                ${album.photoCount > 0
                    ? album.uploads.flatMap((upload) => upload.photos.map((photo) => renderGalleryPhoto(photo, upload))).join("")
                    : `<div class="album-empty"><h2>这里还没有照片</h2><p>成为第一个分享照片的人。</p></div>`}
            </div>
            ${renderUploadDialog(albums, album.id)}
            ${renderModePasswordDialog()}
            ${renderLightbox()}
        </section>
    `;
    return renderAlbumLayout(`${album.name} - 集体相册`, body);
}

function renderAlbumLayout(title, body) {
    return renderLayout({
        title,
        body,
        active: "/album/",
        showTitle: false,
        styles: ["/album.css?v=20260927a"],
        scripts: ["/album.js?v=20260927a"],
    });
}

function renderAlbumCard(album, innerMode) {
    return `
        <article class="album-card">
            <a href="/album/${album.id}/${innerMode ? "?view=inner" : ""}" aria-label="打开相册 ${escapeAttr(album.name)}">
                <img src="${escapeAttr(album.coverUrl || "/defaultCover.png")}" alt="" loading="lazy" />
                <div class="album-card-body">
                    <h2>${escapeHtml(album.name)}</h2>
                    <p>${album.photoCount} 张照片 · ${album.uploadCount} 次分享</p>
                </div>
            </a>
        </article>
    `;
}

function renderGalleryPhoto(photo, upload) {
    const label = `${upload.nickname} · ${formatDateTime(upload.createdAt)}`;
    return `
        <button class="album-gallery-item" type="button"
            data-lightbox-src="${escapeAttr(photo.url)}"
            data-lightbox-alt="${escapeAttr(photo.originalName || "相册照片") }"
            data-lightbox-label="${escapeAttr(label)}"
            data-lightbox-upload-id="${upload.id}"
            data-lightbox-likes="${escapeAttr(JSON.stringify(upload.likes.map((like) => like.nickname)))}"
            data-lightbox-comments="${escapeAttr(JSON.stringify(upload.comments.map((comment) => ({ id: comment.id, nickname: comment.nickname, content: comment.content }))))}"
            aria-label="查看 ${escapeAttr(photo.originalName || "相册照片")}">
            <img src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.originalName || "相册照片")}" loading="lazy" />
        </button>
    `;
}

function renderReactionForm(type, uploadId) {
    const isComment = type === "comment";
    return `
        <form class="reaction-form" data-reaction-form="${type}" data-upload-id="${uploadId}" hidden>
            <input name="nickname" maxlength="24" required placeholder="你的昵称" aria-label="你的昵称" />
            ${isComment ? '<input name="content" maxlength="240" required placeholder="写下评论" aria-label="评论内容" />' : ""}
            <button type="submit">${isComment ? "发送" : "确认点赞"}</button>
            <p class="inline-status" role="status"></p>
        </form>
    `;
}

function renderComment(comment) {
    return `<p data-comment-id="${comment.id}"><strong>${escapeHtml(comment.nickname)}：</strong>${escapeHtml(comment.content)}</p>`;
}

function renderCreateAlbumDialog() {
    return `
        <dialog class="album-dialog compact-dialog" id="create-album-dialog">
            <form class="dialog-panel" id="create-album-form">
                <header class="dialog-header">
                    <div><p class="eyebrow">New album</p><h2>新建相册</h2></div>
                    <button class="dialog-close" type="button" data-close-dialog aria-label="关闭">×</button>
                </header>
                <label>相册名称<input name="name" maxlength="40" required placeholder="例如：2026 夏日旅行" /></label>
                <footer class="dialog-footer">
                    <p class="dialog-status" role="status"></p>
                    <button class="button primary" type="submit">创建相册</button>
                </footer>
            </form>
        </dialog>
    `;
}

function renderUploadDialog(albums, selectedAlbumId = null) {
    return `
        <dialog class="album-dialog" id="upload-dialog">
            <form class="dialog-panel upload-form" id="album-upload-form" enctype="multipart/form-data">
                <header class="dialog-header">
                    <div><p class="eyebrow">Share photos</p><h2>上传照片</h2></div>
                    <button class="dialog-close" type="button" data-close-dialog aria-label="关闭">×</button>
                </header>

                <div class="upload-section">
                    <h3>照片类型（必选）</h3>
                    <div class="visibility-options">
                        <label>
                            <input type="radio" name="visibility" value="public" required />
                            <span><strong>表图</strong><small>所有访客都能看到</small></span>
                        </label>
                        <label>
                            <input type="radio" name="visibility" value="inner" required />
                            <span><strong>里图</strong><small>仅在里图模式中显示</small></span>
                        </label>
                    </div>
                </div>

                <div class="upload-section">
                    <h3>照片</h3>
                    <label class="file-picker">
                        <input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple required />
                        <span>选择照片</span>
                        <small>最多 20 张，单次总量不超过 90 MB</small>
                    </label>
                    <div class="photo-preview" id="photo-preview" aria-live="polite"></div>
                    <p class="photo-selection-summary" id="photo-selection-summary" aria-live="polite"></p>
                </div>

                <div class="upload-section">
                    <h3>收录到相册</h3>
                    <div class="album-options">
                        ${albums.map((album) => `
                            <label class="check-option">
                                <input type="checkbox" name="albumIds" value="${album.id}" ${album.id === selectedAlbumId ? "checked" : ""} />
                                <span>${escapeHtml(album.name)}</span>
                            </label>
                        `).join("") || "<p>目前还没有相册，请在下方新建。</p>"}
                    </div>
                    <label>同时新建相册（可选）<input name="newAlbumName" maxlength="40" placeholder="输入一个新相册名称" /></label>
                </div>

                <div class="upload-section form-grid">
                    <h3>上传者</h3>
                    <label>昵称（必填）<input name="nickname" maxlength="24" required autocomplete="nickname" placeholder="你的昵称" /></label>
                    <label>头像 <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></label>
                    <p class="avatar-hint" id="avatar-hint">昵称第一次上传时必须选择头像。</p>
                </div>

                <div class="upload-section form-grid">
                    <h3>这次分享</h3>
                    <label>人物（可选）<input name="people" maxlength="80" placeholder="照片里有谁" /></label>
                    <label>地点（可选）<input name="location" maxlength="80" placeholder="照片在哪里拍摄" /></label>
                    <label class="full-width">想写的话（可选）<textarea name="message" maxlength="500" placeholder="记录这一刻"></textarea></label>
                </div>

                <footer class="dialog-footer">
                    <div class="upload-status-wrap">
                        <p class="dialog-status" role="status"></p>
                        <progress class="upload-progress" id="upload-progress" max="100" value="0" hidden></progress>
                    </div>
                    <button class="button primary" type="submit">开始上传</button>
                </footer>
            </form>
        </dialog>
    `;
}

function renderModeSwitch(innerMode) {
    return `
        <div class="album-mode-bar">
            <span>显示范围</span>
            <div class="album-mode-switch" role="group" aria-label="相册显示范围">
                <button type="button" data-album-view="public" class="${innerMode ? "" : "active"}" aria-pressed="${innerMode ? "false" : "true"}">表图</button>
                <button type="button" data-album-view="inner" class="${innerMode ? "active" : ""}" aria-pressed="${innerMode ? "true" : "false"}">里图</button>
            </div>
            <small>${innerMode ? "正在显示表图与里图" : "仅显示表图"}</small>
        </div>
    `;
}

function renderModePasswordDialog() {
    return `
        <dialog class="album-dialog compact-dialog" id="album-mode-dialog">
            <form class="dialog-panel" id="album-mode-form">
                <header class="dialog-header">
                    <div><p class="eyebrow">Private view</p><h2>进入里图模式</h2></div>
                    <button class="dialog-close" type="button" data-close-dialog aria-label="关闭">×</button>
                </header>
                <p class="mode-password-hint">fmy的网名是？</p>
                <label>密码<input name="password" type="text" inputmode="text" required autocomplete="off" autocapitalize="none" spellcheck="false" /></label>
                <footer class="dialog-footer">
                    <p class="dialog-status" role="status"></p>
                    <button class="button primary" type="submit">确认进入</button>
                </footer>
            </form>
        </dialog>
    `;
}

function renderLightbox() {
    return `
        <dialog class="photo-lightbox" id="photo-lightbox">
            <div class="photo-lightbox-panel">
                <header class="photo-lightbox-header">
                    <p class="photo-lightbox-counter" id="photo-lightbox-counter" aria-live="polite"></p>
                    <button class="photo-lightbox-close" type="button" data-close-dialog aria-label="关闭照片">×</button>
                </header>
                <div class="photo-lightbox-stage" data-lightbox-stage>
                    <button class="photo-lightbox-nav previous" type="button" data-lightbox-nav="previous" aria-label="上一张">‹</button>
                    <img src="" alt="" draggable="false" />
                    <button class="photo-lightbox-nav next" type="button" data-lightbox-nav="next" aria-label="下一张">›</button>
                </div>
                <footer class="photo-lightbox-footer">
                    <div class="photo-lightbox-details">
                        <p class="photo-lightbox-caption" id="photo-lightbox-caption"></p>
                        <div class="photo-lightbox-reactions" id="photo-lightbox-reactions" hidden>
                            <div class="photo-lightbox-reaction-actions">
                                <button type="button" data-lightbox-reaction="like" aria-expanded="false">♡ 点赞</button>
                                <button type="button" data-lightbox-reaction="comment" aria-expanded="false">评论</button>
                            </div>
                            <div class="photo-lightbox-reaction-box">
                                <p class="lightbox-like-list" hidden>♥ <span></span></p>
                                <div class="lightbox-comment-list"></div>
                            </div>
                            <form class="lightbox-reaction-form" data-lightbox-reaction-form="like" hidden>
                                <input name="nickname" maxlength="24" required placeholder="你的昵称" aria-label="你的昵称" />
                                <button type="submit">确认点赞</button>
                                <p class="inline-status" role="status"></p>
                            </form>
                            <form class="lightbox-reaction-form" data-lightbox-reaction-form="comment" hidden>
                                <input name="nickname" maxlength="24" required placeholder="你的昵称" aria-label="你的昵称" />
                                <input name="content" maxlength="240" required placeholder="写下评论" aria-label="评论内容" />
                                <button type="submit">发送</button>
                                <p class="inline-status" role="status"></p>
                            </form>
                        </div>
                    </div>
                    <div class="photo-lightbox-tools" role="toolbar" aria-label="照片预览工具">
                        <button type="button" data-lightbox-action="zoom-out" aria-label="缩小">−</button>
                        <button type="button" data-lightbox-action="reset" aria-label="重置视图">100%</button>
                        <button type="button" data-lightbox-action="zoom-in" aria-label="放大">＋</button>
                        <button type="button" data-lightbox-action="rotate" aria-label="旋转">↻</button>
                        <button type="button" data-lightbox-action="download" aria-label="保存照片">保存</button>
                    </div>
                    <p class="photo-lightbox-status" id="photo-lightbox-status" role="status" aria-live="polite"></p>
                </footer>
            </div>
        </dialog>
    `;
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
        return "";
    }
    return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}
