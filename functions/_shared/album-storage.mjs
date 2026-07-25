import path from "node:path";

export function albumStoragePaths(env = {}) {
    const defaultDataRoot = process.platform === "win32"
        ? path.join(process.cwd(), "data", "albums")
        : "/var/lib/catkinsblog";
    const dataRoot = path.resolve(env.ALBUM_DATA_DIR || defaultDataRoot);
    const uploadsRoot = path.resolve(env.UPLOADS_DIR || path.join(dataRoot, "uploads"));

    return {
        dataRoot,
        databaseFile: path.resolve(env.ALBUM_DB_FILE || path.join(dataRoot, "catkinsblog.sqlite")),
        uploadsRoot,
        albumUploadsRoot: path.resolve(env.ALBUM_UPLOADS_DIR || path.join(uploadsRoot, "albums")),
        innerAlbumUploadsRoot: path.resolve(env.INNER_ALBUM_UPLOADS_DIR || path.join(uploadsRoot, "inner-albums")),
        avatarUploadsRoot: path.resolve(env.AVATAR_UPLOADS_DIR || path.join(uploadsRoot, "avatars")),
    };
}

export function resolveUploadedFile(env, pathname) {
    const { uploadsRoot } = albumStoragePaths(env);
    const relativePath = decodeURIComponent(pathname).replace(/^\/uploads\/?/, "");
    const filePath = path.resolve(uploadsRoot, relativePath);

    if (filePath !== uploadsRoot && !filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
        return null;
    }

    return filePath;
}

export function isInnerAlbumFile(env, filePath) {
    if (!filePath) {
        return false;
    }
    const { innerAlbumUploadsRoot } = albumStoragePaths(env);
    const relativePath = path.relative(innerAlbumUploadsRoot, path.resolve(filePath));
    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
