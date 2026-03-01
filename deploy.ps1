param (
    [Parameter(Mandatory=$true)]
    [string]$User,

    [Parameter(Mandatory=$true)]
    [string]$HostName,

    [string]$RemoteDir = "~/travelaccess",
    [string]$EnvFile = ".env.local"
)

$ErrorActionPreference = "Stop"
$SshTarget = "$User@$HostName"

Write-Host "🚀 Starting deployment to $SshTarget..." -ForegroundColor Cyan

# 1. Create a tarball of the project (excluding node_modules and .git)
$TarFile = "deploy_archive.tar.gz"
Write-Host "📦 Creating project archive ($TarFile)..." -ForegroundColor Yellow

# Use tar to compress the project. The .dockerignore exclusions are roughly mimicked here.
# Note: Windows 10+ has tar natively installed!
tar.exe --exclude="node_modules" --exclude=".git" --exclude=".next" --exclude="deploy_archive.tar.gz" -czf $TarFile .

# 2. Setup Remote Directory
Write-Host "📁 Preparing remote directory $RemoteDir..." -ForegroundColor Yellow
ssh $SshTarget "mkdir -p $RemoteDir/certificates"

# 3. Transfer Archive and specific files
Write-Host "📤 Transferring files to remote server (this may take a minute)..." -ForegroundColor Yellow
scp $TarFile "$SshTarget`:$RemoteDir/"
# We also copy the env file to act as the primary .env on the server
scp $EnvFile "$SshTarget`:$RemoteDir/.env"

# 4. Extract and Deploy on Remote Server
Write-Host "🛠️ Extracting and building with Docker Compose on remote server..." -ForegroundColor Yellow
ssh $SshTarget "cd $RemoteDir && tar -xzf $TarFile && docker compose up --build -d"

# 5. Cleanup
Write-Host "🧹 Cleaning up local archive..." -ForegroundColor Yellow
Remove-Item $TarFile

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌍 Your application should now be running on the remote Docker daemon." -ForegroundColor Green
