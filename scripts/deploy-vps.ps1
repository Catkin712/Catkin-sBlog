param(
    [string]$SshHost = "catkinblog",
    [string]$RemoteDir = "/var/www/catkinsblog",
    [string]$ArchiveName = "catkinsblog-vps.tar.gz",
    [string]$Pm2Name = "catkinsblog"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ArchivePath = Join-Path $ProjectRoot $ArchiveName

function Step($Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Run($Command, $Arguments, $WorkingDirectory = $ProjectRoot) {
    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Command failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

Step "Checking SSH connection"
Run "ssh" @($SshHost, "echo connected")

Step "Building locally"
Run "npm" @("run", "build")

Step "Packing project"
if (Test-Path $ArchivePath) {
    Remove-Item -LiteralPath $ArchivePath -Force
}
Run "tar" @(
    "--exclude=node_modules",
    "--exclude=.git",
    "--exclude=$ArchiveName",
    "-czf",
    $ArchiveName,
    "."
)

Step "Uploading archive"
Run "scp" @($ArchivePath, "${SshHost}:${RemoteDir}/")

Step "Deploying on server"
$remoteScript = @"
set -e
cd "$RemoteDir"
tar -xzf "$ArchiveName"
npm install
npm run build
pm2 restart "$Pm2Name" || pm2 start npm --name "$Pm2Name" -- start
pm2 save
"@

Run "ssh" @($SshHost, $remoteScript)

Step "Deployment finished"
Write-Host "Open: http://123.99.201.167:8888/" -ForegroundColor Green
