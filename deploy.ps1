<#
.SYNOPSIS
    Builds, pushes, and deploys the TravelAccess Docker image to a remote server.

.EXAMPLE (default — build locally, push to Docker Hub, pull on server)
    .\deploy.ps1 `
      -RemoteUser <ssh-user> `
      -RemoteHost <server-hostname> `
      -SshKeyPath "<path-to-ssh-key>" `
      -DockerHubUser <dockerhub-username>

.EXAMPLE (BUILD ON SERVER — best for ARM64 servers; no Docker Hub needed)
    .\deploy.ps1 `
      -RemoteUser <ssh-user> `
      -RemoteHost <server-hostname> `
      -SshKeyPath "<path-to-ssh-key>" `
      -DockerHubUser <dockerhub-username> `
      -BuildOnServer

.EXAMPLE (skip re-uploading certs/wallet/env — faster redeploy)
    .\deploy.ps1 `
      -RemoteUser <ssh-user> `
      -RemoteHost <server-hostname> `
      -SshKeyPath "<path-to-ssh-key>" `
      -DockerHubUser <dockerhub-username> `
      -SkipRuntimeFiles

.EXAMPLE (redeploy already-pushed image without rebuilding)
    .\deploy.ps1 `
      -RemoteUser <ssh-user> `
      -RemoteHost <server-hostname> `
      -SshKeyPath "<path-to-ssh-key>" `
      -DockerHubUser <dockerhub-username> `
      -SkipBuild
#>
param(
    [Parameter(Mandatory)][string]$RemoteUser,
    [Parameter(Mandatory)][string]$RemoteHost,
    [Parameter(Mandatory)][string]$SshKeyPath,
    [Parameter(Mandatory)][string]$DockerHubUser,
    [string]$ImageName = "travelaccess",
    [string]$Tag = "latest",
    [string]$RemoteDir = "~/TravelAccess",
    [switch]$SkipRuntimeFiles,  # skip certs/wallet/env upload (already on server)
    [switch]$SkipBuild,         # skip local build+push (re-deploy same image)
    [switch]$BuildOnServer      # build Docker image on the server (required for ARM64 servers)
)

$LocalDir = $PSScriptRoot
$FullImage = "${DockerHubUser}/${ImageName}:${Tag}"

function TS { Get-Date -Format '[HH:mm:ss]' }
function Write-Step {
    param($msg)
    Write-Host ""
    Write-Host "$(TS) ------------------------------------------" -ForegroundColor DarkGray
    Write-Host "$(TS)   $msg" -ForegroundColor Cyan
    Write-Host "$(TS) ------------------------------------------" -ForegroundColor DarkGray
}
function Write-OK { param($msg) Write-Host "$(TS) [OK]   $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "$(TS) [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "$(TS) [FAIL] $msg" -ForegroundColor Red }

function Invoke-SSH {
    param([string]$Cmd)
    & ssh -i $script:LocalKeyPath `
        -o StrictHostKeyChecking=no `
        -o ConnectTimeout=15 `
        -o ServerAliveInterval=10 `
        -o ServerAliveCountMax=3 `
        "$RemoteUser@$RemoteHost" $Cmd
}
function Invoke-SCP {
    param([string]$Src, [string]$Dst, [switch]$Recurse)
    $scpArgs = @("-i", $script:LocalKeyPath, "-o", "StrictHostKeyChecking=no")
    if ($Recurse) { $scpArgs += "-r" }
    $scpArgs += $Src, "${RemoteUser}@${RemoteHost}:${Dst}"
    & scp @scpArgs
}

# ============================================================
Write-Step "Preflight checks"
# ============================================================

foreach ($tool in @("ssh", "scp", "docker")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Fail "$tool not found in PATH."
        exit 1
    }
}
Write-OK "ssh, scp, docker available"

if (-not (Test-Path $SshKeyPath)) { Write-Fail "SSH key not found: $SshKeyPath"; exit 1 }
Write-OK "SSH key found"

# Stage key to ~/.ssh/ — Windows OpenSSH rejects quoted IdentityFile paths,
# so the key must live somewhere without spaces in the path.
$sshDir = Join-Path $env:USERPROFILE ".ssh"
$sshConfig = Join-Path $sshDir "config"
$safeKeyName = "deploy_${RemoteHost}.key"
$script:LocalKeyPath = Join-Path $sshDir $safeKeyName

if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir | Out-Null }

# If the key was staged by a previous run it will be read-locked — unlock it first
if (Test-Path $script:LocalKeyPath) {
    icacls $script:LocalKeyPath /grant:r "${env:USERNAME}:(F)" | Out-Null
}
Copy-Item -Path $SshKeyPath -Destination $script:LocalKeyPath -Force
# Lock back to read-only (SSH requires the key file to not be world-readable)
icacls $script:LocalKeyPath /inheritance:r /grant:r "${env:USERNAME}:(R)" | Out-Null
Write-OK "Key staged at ~/.ssh/$safeKeyName"

# Update ~/.ssh/config before any SSH call
$hostBlock = (
    "",
    "Host $RemoteHost",
    "    IdentityFile $($script:LocalKeyPath -replace '\\','/')",
    "    StrictHostKeyChecking no",
    "    User $RemoteUser"
) -join "`n"

$currentConfig = if (Test-Path $sshConfig) { Get-Content $sshConfig -Raw } else { "" }
if ($currentConfig -match "Host $([regex]::Escape($RemoteHost))") {
    $esc = [regex]::Escape($RemoteHost)
    $currentConfig = $currentConfig -replace "(?ms)\r?\nHost $esc[^\r\n]*(?:\r?\n(?!Host )[^\r\n]*)*(\r?\n|$)", "`n"
    Set-Content -Path $sshConfig -Value $currentConfig.TrimEnd() -Encoding UTF8 -NoNewline
}
Add-Content -Path $sshConfig -Value $hostBlock
Write-OK "~/.ssh/config updated"

Write-Host "  Image : $FullImage" -ForegroundColor White

# ============================================================
Write-Step "Step 1 - Create remote directory structure"
# ============================================================

Invoke-SSH "mkdir -p $RemoteDir/certificates/Cloud $RemoteDir/oracle_wallet"
if ($LASTEXITCODE -ne 0) { Write-Fail "Cannot create remote dirs. Check SSH access."; exit 1 }
Write-OK "Remote directories ready"

# ============================================================
# Steps 2-4: Runtime-mounted files (only needed once / when changed)
# ============================================================

if (-not $SkipRuntimeFiles) {

    Write-Step "Step 2 - Upload .env.local"
    $envFile = Join-Path $LocalDir ".env.local"
    if (-not (Test-Path $envFile)) { Write-Fail ".env.local not found"; exit 1 }
    Invoke-SCP -Src $envFile -Dst "$RemoteDir/"
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to upload .env.local"; exit 1 }
    Write-OK ".env.local uploaded"

    Write-Step "Step 3 - Upload Cloud certificates"
    $certsDir = Join-Path $LocalDir "certificates\Cloud"
    if (-not (Test-Path $certsDir)) { Write-Fail "Not found: $certsDir"; exit 1 }
    foreach ($cf in (Get-ChildItem -Path $certsDir -File)) {
        Write-Host "    $($cf.Name)" -ForegroundColor DarkGray
        Invoke-SCP -Src $cf.FullName -Dst "$RemoteDir/certificates/Cloud/"
        if ($LASTEXITCODE -ne 0) { Write-Fail "Failed: $($cf.Name)"; exit 1 }
    }
    Write-OK "Certificates uploaded"

    Write-Step "Step 4 - Upload Oracle Wallet"
    $walletDir = Join-Path $LocalDir "oracle_wallet"
    if (Test-Path $walletDir) {
        foreach ($wf in (Get-ChildItem -Path $walletDir -File)) {
            Write-Host "    $($wf.Name)" -ForegroundColor DarkGray
            Invoke-SCP -Src $wf.FullName -Dst "$RemoteDir/oracle_wallet/"
            if ($LASTEXITCODE -ne 0) { Write-Fail "Failed: $($wf.Name)"; exit 1 }
        }
        Write-OK "Oracle wallet uploaded"
    }
    else {
        Write-Warn "oracle_wallet not found locally - skipping"
    }
}
else {
    Write-Host ""
    Write-Host "  [SKIP] Runtime files (-SkipRuntimeFiles)" -ForegroundColor DarkGray
}

# ============================================================
Write-Step "Step 5 - Upload docker-compose.yml"
# ============================================================

Invoke-SCP -Src (Join-Path $LocalDir "docker-compose.yml") -Dst "$RemoteDir/"
if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to upload docker-compose.yml"; exit 1 }
Write-OK "docker-compose.yml uploaded"

# ============================================================
if ($BuildOnServer) {

    Write-Step "Step 6 - Upload source code for server-side build"
    # ============================================================
    # Used when the server is ARM64 (or any arch that differs from your local machine).
    # We tar the project (excluding node_modules, .next, .git) and build on the server.
    # No Docker Hub account required.
    # ============================================================

    $SrcDir = $RemoteDir + "/src"
    $TarFile = "/tmp/travelaccess-src.tar.gz"

    Write-Host "    Creating archive of source files (tar - includes uncommitted changes) ..." -ForegroundColor DarkGray
    $localTar = Join-Path $env:TEMP "travelaccess-src.tar.gz"

    # Use Windows built-in tar (ships with Windows 10+) to archive the working tree.
    # Excludes heavy/generated dirs that should not be in the build context.
    # Unlike 'git archive HEAD', this includes uncommitted file changes.
    $excludes = @(
        "--exclude=node_modules",
        "--exclude=.next",
        "--exclude=.git",
        "--exclude=oracle_wallet",
        "--exclude=certificates",
        "--exclude=*.key",
        "--exclude=.env*"
    )
    & tar -czf $localTar @excludes -C $LocalDir .
    if ($LASTEXITCODE -ne 0) { Write-Fail "tar failed. Windows 10+ required."; exit 1 }
    Write-OK "Source archived: $localTar"

    Write-Host "    Uploading archive to server ..." -ForegroundColor DarkGray
    Invoke-SCP -Src $localTar -Dst $TarFile
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to upload source archive"; exit 1 }
    Remove-Item $localTar -Force
    Write-OK "Archive uploaded"

    Write-Step "Step 7 - Build Docker image on server"
    # ============================================================

    # NOTE: We use a single semicolon-joined line here (not a here-string) because
    # PowerShell here-strings on Windows use CRLF, and the \r chars corrupt every
    # command token when bash receives them over SSH.
    $buildCmd = "set -e" +
    "; mkdir -p $SrcDir" +
    "; cd $SrcDir" +
    "; tar -xzf $TarFile" +
    "; docker build -t ${DockerHubUser}/${ImageName}:${Tag} ." +
    "; rm -f $TarFile"
    Invoke-SSH $buildCmd
    if ($LASTEXITCODE -ne 0) { Write-Fail "Remote docker build failed"; exit 1 }
    Write-OK "Image built on server: ${DockerHubUser}/${ImageName}:${Tag}"

    Write-Host ""
    Write-Host "  [SKIP] Step 8 - No Docker Hub push needed (built locally on server)" -ForegroundColor DarkGray

}
elseif (-not $SkipBuild) {

    Write-Step "Step 6 - Run unit tests"
    # ============================================================

    Write-Host "    Running: npm test ..." -ForegroundColor DarkGray
    npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Unit tests failed. Fix them before deploying."
        exit 1
    }
    Write-OK "All tests passed"

    Write-Step "Step 7 - Build image locally"
    # ============================================================
    # The build runs on YOUR machine (same arch as server required!).
    # Use -BuildOnServer instead if the server is ARM64.
    # ============================================================

    $env:DOCKERHUB_USER = $DockerHubUser
    docker compose `
        --file (Join-Path $LocalDir "docker-compose.yml") `
        build

    if ($LASTEXITCODE -ne 0) { Write-Fail "Local build failed"; exit 1 }
    Write-OK "Image built: $FullImage"

    # ============================================================
    Write-Step "Step 8 - Push image to Docker Hub"
    # ============================================================

    Write-Host "    Pushing $FullImage ..." -ForegroundColor DarkGray
    docker push $FullImage
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker push failed. Are you logged in? Run: docker login"; exit 1 }
    Write-OK "Pushed $FullImage"
}
else {
    Write-Host ""
    Write-Host "  [SKIP] Build + push (-SkipBuild)" -ForegroundColor DarkGray
    Write-Host "  Using existing image: $FullImage" -ForegroundColor DarkGray
}

# ============================================================
Write-Step "Step 9 - Pull image on server and restart"
# ============================================================

if ($BuildOnServer) {
    # --- Single SSH session for everything ---
    # All sub-steps run in one connection (cp + stop + rm + run).
    # Using semicolons only (no && / ||) to avoid PowerShell 7 operator parsing.
    # 'docker stop/rm' may fail if no container exists yet — that is fine,
    # the subsequent docker run is what matters.
    $runCmd = "docker run -d" +
    " --name travelaccess-web" +
    " --restart unless-stopped" +
    " -p 443:443" +
    " --env-file $RemoteDir/.env" +
    " -e CLOUD_ORACLE_WALLET_DIR=/app/oracle_wallet" +
    " -e TNS_ADMIN=/app/oracle_wallet" +
    " -e NODE_ENV=production" +
    " -v $RemoteDir/certificates/Cloud:/app/certs:ro" +
    " -v $RemoteDir/oracle_wallet:/app/oracle_wallet:ro" +
    " ${DockerHubUser}/${ImageName}:${Tag}"

    # Safety net: strip surrounding double-quotes from .env values.
    # Docker --env-file does NOT strip quotes; Next.js does. If .env.local
    # has KEY="value", Docker would see "value" (with quotes) as the value.
    # $q avoids PowerShell string-escaping issues when embedding " in a command.
    $q = '"'
    $stripQuotes = "sed -i 's/^\([A-Za-z_][A-Za-z_0-9]*\)=$q\(.*\)$q" + '$' + "/\1=\2/' $RemoteDir/.env"

    $step9 = "cp $RemoteDir/.env.local $RemoteDir/.env" +
    "; $stripQuotes" +
    "; docker stop travelaccess-web 2>/dev/null" +
    "; docker rm travelaccess-web 2>/dev/null" +
    "; $runCmd"

    Write-Host "    [9] Copying env, stopping old container, starting new one (single SSH session) ..." -ForegroundColor DarkGray
    Invoke-SSH $step9
    if ($LASTEXITCODE -ne 0) { Write-Fail "Step 9 failed"; exit 1 }
    Write-OK "Container started"
}
else {
    # Standard compose flow
    $remoteEnvLine = "DOCKERHUB_USER=$DockerHubUser"
    Write-Host "    [9.1] Updating DOCKERHUB_USER in .env.local ..." -ForegroundColor DarkGray
    Invoke-SSH "grep -q '^DOCKERHUB_USER=' $RemoteDir/.env.local && sed -i 's|^DOCKERHUB_USER=.*|$remoteEnvLine|' $RemoteDir/.env.local || echo '$remoteEnvLine' >> $RemoteDir/.env.local"

    Write-Host "    [9.2] Copying .env.local -> .env ..." -ForegroundColor DarkGray
    Invoke-SSH "cp $RemoteDir/.env.local $RemoteDir/.env"
    Write-OK ".env ready on server"

    Write-Host "    [9.3] Running docker compose down ..." -ForegroundColor DarkGray
    Invoke-SSH "cd $RemoteDir && docker compose down --remove-orphans 2>/dev/null; true"
    Write-OK "Old container cleared"

    Write-Host "    [9.4] Pulling $FullImage from Docker Hub ..." -ForegroundColor DarkGray
    Invoke-SSH "docker pull $FullImage"
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker pull failed on remote"; exit 1 }
    Write-OK "Image pulled on server"

    Write-Host "    [9.5] Running docker compose up -d ..." -ForegroundColor DarkGray
    Invoke-SSH "cd $RemoteDir && docker compose up -d"
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose up failed"; exit 1 }
    Write-OK "Container started"
}

# ============================================================
Write-Host ""
Write-Host "=========================================="  -ForegroundColor DarkGray
Write-OK "Deployment complete!"
Write-Host "  URL  : https://$RemoteHost" -ForegroundColor White
Write-Host "  Image: $FullImage" -ForegroundColor White
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor DarkGray
Write-Host "  Logs   : ssh -i '$($script:LocalKeyPath)' ${RemoteUser}@${RemoteHost} 'docker logs -f travelaccess-web'" -ForegroundColor DarkGray
Write-Host "  Stop   : ssh -i '$($script:LocalKeyPath)' ${RemoteUser}@${RemoteHost} 'docker stop travelaccess-web'" -ForegroundColor DarkGray
Write-Host "  Rollback: rebuild with -BuildOnServer after reverting code" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Fast redeploy (skip certs/wallet, new build on server):" -ForegroundColor DarkGray
Write-Host "  .\deploy.ps1 -RemoteUser $RemoteUser -RemoteHost $RemoteHost -SshKeyPath '...' -DockerHubUser $DockerHubUser -BuildOnServer -SkipRuntimeFiles" -ForegroundColor DarkGray
Write-Host "=========================================="  -ForegroundColor DarkGray
Write-Host ""

# ============================================================
Write-Step "Live container logs  (Ctrl+C to exit - container keeps running)"
# ============================================================
Write-Host "  Streaming last 50 lines ..." -ForegroundColor DarkGray
Write-Host ""
Invoke-SSH "docker logs -f --tail 50 travelaccess-web"
