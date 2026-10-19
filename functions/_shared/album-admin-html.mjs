export function renderAlbumAdminPage() {
    return `<!doctype html>
<html lang="zh-CN">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>相册管理 - Catkin's Blog Admin</title>
        <style>
            :root { color-scheme: light; --bg: #f6f7f9; --panel: #fff; --line: #d9dee7; --text: #20242c; --muted: #687386; --brand: #216869; --danger: #a33f55; }
            * { box-sizing: border-box; }
            body { margin: 0; background: var(--bg); color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
            button, input, textarea { font: inherit; }
            button, .button-link { border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--text); cursor: pointer; padding: 0.5rem 0.75rem; text-decoration: none; }
            button.primary { border-color: var(--brand); background: var(--brand); color: #fff; }
            button.danger { border-color: color-mix(in srgb, var(--danger) 45%, var(--line)); color: var(--danger); }
            button:disabled { cursor: wait; opacity: 0.6; }
            .admin-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--line); background: var(--panel); padding: 0.8rem 1rem; }
            .admin-header h1 { margin: 0; font-size: 1.15rem; }
            .header-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
            .album-admin-layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: calc(100vh - 58px); }
            .upload-sidebar { border-right: 1px solid var(--line); background: var(--panel); padding: 1rem; }
            .upload-sidebar label { display: grid; gap: 0.35rem; color: var(--muted); font-size: 0.82rem; font-weight: 700; }
            .upload-sidebar input { width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 0.6rem; }
            .upload-list { display: grid; gap: 0.5rem; max-height: calc(100vh - 145px); margin-top: 0.8rem; overflow-y: auto; }
            .upload-list button { display: grid; gap: 0.2rem; width: 100%; text-align: left; }
            .upload-list button.active { border-color: var(--brand); }
            .upload-list strong { overflow-wrap: anywhere; }
            .upload-list span { color: var(--muted); font-size: 0.78rem; }
            .album-admin-main { min-width: 0; padding: 1rem; }
            .empty-state { color: var(--muted); padding: 2rem 0; }
            .editor-header { display: flex; justify-content: space-between; gap: 1rem; align-items: start; margin-bottom: 1rem; }
            .editor-header h2 { margin: 0; font-size: 1.2rem; }
            .editor-header p { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.82rem; }
            .upload-editor { display: grid; gap: 1rem; }
            .editor-section { display: grid; gap: 0.8rem; border-top: 1px solid var(--line); padding-top: 1rem; }
            .editor-section:first-of-type { border-top: 0; padding-top: 0; }
            .editor-section h3 { margin: 0; font-size: 0.95rem; }
            .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.8rem; }
            label { display: grid; gap: 0.35rem; color: var(--muted); font-size: 0.82rem; font-weight: 700; }
            input, textarea { width: 100%; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--text); padding: 0.62rem 0.7rem; }
            textarea { min-height: 6rem; resize: vertical; }
            input:focus, textarea:focus { border-color: var(--brand); outline: 2px solid color-mix(in srgb, var(--brand) 18%, transparent); }
            .full-width { grid-column: 1 / -1; }
            .visibility-options, .album-options { display: flex; flex-wrap: wrap; gap: 0.5rem; }
            .visibility-options label, .album-options label { display: inline-flex; align-items: center; gap: 0.4rem; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--text); padding: 0.5rem 0.65rem; }
            .visibility-options input, .album-options input { width: auto; }
            .editor-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
            .status { min-height: 1.2em; margin: 0; color: var(--muted); font-size: 0.82rem; }
            .status.error { color: var(--danger); }
            .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 0.8rem; }
            .photo-item { display: grid; gap: 0.65rem; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 0.7rem; }
            .photo-item img { display: block; width: 100%; aspect-ratio: 4 / 3; border-radius: 5px; object-fit: cover; background: var(--bg); }
            .photo-meta { margin: 0; color: var(--muted); font-size: 0.76rem; overflow-wrap: anywhere; }
            .photo-actions { display: flex; justify-content: space-between; gap: 0.5rem; }
            [hidden] { display: none !important; }
            @media (max-width: 820px) {
                .album-admin-layout { grid-template-columns: 1fr; }
                .upload-sidebar { border-right: 0; border-bottom: 1px solid var(--line); }
                .upload-list { grid-auto-columns: minmax(200px, 75%); grid-auto-flow: column; max-height: none; overflow-x: auto; overflow-y: hidden; }
                .form-grid { grid-template-columns: 1fr; }
                .full-width { grid-column: auto; }
                .editor-header, .editor-actions { align-items: stretch; flex-direction: column; }
            }
        </style>
    </head>
    <body>
        <header class="admin-header">
            <h1>相册管理</h1>
            <div class="header-actions">
                <a class="button-link" href="/admin/">管理文章</a>
                <a class="button-link" href="/album/">查看相册</a>
                <button id="refreshUploads" type="button">刷新</button>
                <button id="logout" type="button">退出</button>
            </div>
        </header>
        <div class="album-admin-layout">
            <aside class="upload-sidebar">
                <label>筛选上传记录<input id="uploadFilter" type="search" placeholder="昵称 / 相册 / 日期" /></label>
                <div class="upload-list" id="uploadList"></div>
            </aside>
            <main class="album-admin-main">
                <p class="empty-state" id="emptyState">正在加载上传记录...</p>
                <div id="uploadEditor" hidden>
                    <header class="editor-header">
                        <div><h2 id="editorTitle">编辑上传记录</h2><p id="editorSummary"></p></div>
                        <p class="status" id="pageStatus" role="status"></p>
                    </header>
                    <form class="upload-editor" id="uploadMetadataForm">
                        <section class="editor-section">
                            <h3>上传信息</h3>
                            <div class="form-grid">
                                <label>上传者昵称<input id="uploadNickname" maxlength="24" required /></label>
                                <label>上传时间<input id="uploadCreatedAt" type="datetime-local" required /></label>
                                <label>人物<input id="uploadPeople" maxlength="80" /></label>
                                <label>地点<input id="uploadLocation" maxlength="80" /></label>
                                <label class="full-width">想写的话<textarea id="uploadMessage" maxlength="500"></textarea></label>
                            </div>
                        </section>
                        <section class="editor-section">
                            <h3>显示范围</h3>
                            <div class="visibility-options">
                                <label><input type="radio" name="uploadVisibility" value="public" required />表图</label>
                                <label><input type="radio" name="uploadVisibility" value="inner" required />里图</label>
                            </div>
                        </section>
                        <section class="editor-section">
                            <h3>所属相册</h3>
                            <div class="album-options" id="albumOptions"></div>
                        </section>
                        <div class="editor-actions">
                            <p class="status" id="metadataStatus" role="status"></p>
                            <button class="primary" type="submit">保存上传信息</button>
                        </div>
                    </form>
                    <section class="editor-section">
                        <h3>照片</h3>
                        <div class="photo-grid" id="photoGrid"></div>
                    </section>
                </div>
            </main>
        </div>
        <script src="/album-admin.js?v=20260801a" defer></script>
    </body>
</html>`;
}
