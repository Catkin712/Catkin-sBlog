# VPS Deployment

This project uses Astro for static assets and Cloudflare Pages-style functions for the home page, posts, tags, categories, RSS, search, and admin APIs.

For a VPS, run the included Node server instead of serving `dist` directly with Nginx.

## 1. Prepare The Server

Install Node.js 22.13 or newer, Git, Nginx, and PM2:

```bash
sudo apt update
sudo apt install -y curl git nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
```

## 2. Upload Or Clone The Project

Put the whole project on the server, not only `dist`.

Example:

```bash
sudo mkdir -p /var/www/catkinsblog
sudo chown -R $USER:$USER /var/www/catkinsblog
```

Then upload the project files to `/var/www/catkinsblog`.

## 3. Configure Environment Variables

Create `/var/www/catkinsblog/.env`:

```bash
nano /var/www/catkinsblog/.env
```

Add:

```env
HOST=127.0.0.1
PORT=3000
ADMIN_USERNAME=catkin
ADMIN_PASSWORD=change-this-password
ADMIN_SESSION_SECRET=change-this-long-random-secret
GITHUB_TOKEN=your-github-token
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repo-name
GITHUB_BRANCH=main
ALBUM_DATA_DIR=/var/lib/catkinsblog
UPLOADS_DIR=/var/lib/catkinsblog/uploads
ALBUM_DB_FILE=/var/lib/catkinsblog/catkinsblog.sqlite
BLOG_DB_FILE=/var/lib/catkinsblog/catkinsblog.sqlite
MAX_ALBUM_UPLOAD_MB=100
ALBUM_INNER_PASSWORD=妄想清高
ALBUM_MODE_SESSION_SECRET=change-this-separate-long-random-secret
COS_SECRET_ID=你的腾讯云CAM子账号SecretId
COS_SECRET_KEY=你的腾讯云CAM子账号SecretKey
COS_BUCKET=你的存储桶名称-APPID
COS_REGION=ap-guangzhou
COS_UPLOAD_URL_TTL_SECONDS=600
COS_READ_URL_TTL_SECONDS=600
```

The GitHub variables are optional after the first SQLite migration. On the first start, the application imports the current Markdown posts from GitHub when these variables are present. The token only needs repository contents read access. If GitHub cannot be reached, the application imports the Markdown files bundled in `src/content/posts` instead. After verifying the imported posts, you can remove all four `GITHUB_*` variables; normal page views and admin saves no longer call GitHub.

Create the persistent album directories before starting the service. Replace `YOUR_USER` with the Linux account that runs PM2:

```bash
sudo mkdir -p /var/lib/catkinsblog/uploads/albums
sudo mkdir -p /var/lib/catkinsblog/uploads/inner-albums
sudo mkdir -p /var/lib/catkinsblog/uploads/avatars
sudo chown -R YOUR_USER:YOUR_USER /var/lib/catkinsblog
sudo chmod -R u=rwX,g=rX,o= /var/lib/catkinsblog
```

Posts, drafts, tags, categories, album metadata, visibility, upload groups, likes, and comments are stored in `/var/lib/catkinsblog/catkinsblog.sqlite`. New post covers, post body images, album photos, and avatars are stored in the private COS bucket. The local upload directories and existing `/covers/...` files remain readable for compatibility. These paths are outside the project directory, so deploying a new build does not overwrite user content.

COS credentials are used only by the VPS. Never put them in `public`, client-side code, or the repository.

`ALBUM_INNER_PASSWORD` controls entry to inner mode. `ALBUM_MODE_SESSION_SECRET` signs the four-hour HttpOnly session cookie and should be a long random value different from the password and admin session secret.

## 4. Install And Build

```bash
cd /var/www/catkinsblog
npm install
npm run build
```

## 5. Start The Node Server

```bash
pm2 start npm --name catkinsblog -- start
pm2 save
pm2 startup
```

After running `pm2 startup`, copy and run the command printed by PM2.

Check the local service:

```bash
curl http://127.0.0.1:3000
curl http://127.0.0.1:3000/album/
```

## 6. Configure Tencent Cloud COS

Create a private COS bucket in Tencent Cloud. Choose a region close to your visitors, record the bucket name including its `APPID` suffix, and keep public access disabled.

Create a CAM sub-user for this application. Give it only these permissions on the selected bucket: `GetObject`, `HeadObject`, `PutObject`, and `DeleteObject`. Do not use the Tencent Cloud root account keys. Generate a `SecretId` and `SecretKey` and place them in the VPS `.env` values above.

The bucket resource should be limited to this bucket, including its objects. The resource format is:

```text
qcs::cos:ap-guangzhou:uid/你的APPID:你的存储桶名称-APPID/*
```

Do not grant `ListBucket`, public read, or public write unless you have a separate operational reason.

In COS bucket **Security Management > CORS**, add:

```text
Allowed origins: https://www.catkins.vip, https://catkins.vip
Allowed methods: PUT, GET, HEAD, DELETE
Allowed headers: *
Expose headers: ETag, x-cos-request-id
Max age: 600
```

The application uses short-lived signed PUT URLs for browser uploads and short-lived signed GET URLs for private images. This applies to album media, post covers, and images inserted from the Markdown editor. The browser never receives the CAM credentials.

The old direct-upload hostname is no longer required. Remove the `upload.catkins.vip` A record and any Cloudflare Origin Rule created for VPS port `8889` after the COS deployment is verified.

## 7. Configure The Application

The browser uploads directly to COS. The VPS receives only metadata and verifies each COS object before writing SQLite. `npm run deploy:vps` deploys this code normally.

Run the deployment from the local project directory:

```powershell
cd "D:\Catkin'sBlog"
npm run deploy:vps
```

After deployment, restart PM2 with the updated environment:

```bash
pm2 restart catkinsblog --update-env
```

Verify the application page at `https://www.catkins.vip/album/`, then upload one small test image before migrating normal use.

## 8. Remove The Old Direct Upload Host

Delete the `upload.catkins.vip` DNS record and the Cloudflare Origin Rule for port `8889` after COS is verified. The normal site remains on the existing Cloudflare Tunnel.

## 9. Post Migration Check

The first request after this version starts creates the `posts` table and performs a one-time import. Check the PM2 output:

```bash
pm2 logs catkinsblog --lines 50
```

You should see one of these messages:

```text
Imported N posts from GitHub into SQLite
Imported N bundled posts into SQLite
```

Verify the home page, one article, and the admin post list before removing the `GITHUB_*` variables. Future posts are saved directly to SQLite and are not pushed to GitHub automatically.

## 10. Data Backups

Back up the SQLite database. This single backup includes posts and album metadata. COS is the source for media objects, so also enable COS versioning or a scheduled cross-region/object-storage backup if the media is important.

```bash
sudo apt install -y sqlite3
mkdir -p /var/lib/catkinsblog/backups
sqlite3 /var/lib/catkinsblog/catkinsblog.sqlite ".backup '/var/lib/catkinsblog/backups/catkinsblog.sqlite'"
```

## Updating The Site

After changing code:

```bash
cd /var/www/catkinsblog
npm install
npm run build
pm2 restart catkinsblog
```
