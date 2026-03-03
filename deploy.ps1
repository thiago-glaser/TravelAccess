<#
.SYNOPSIS
    Builds, pushes, and deploys the TravelAccess Docker image to a remote server.

.EXAMPLE
    .\deploy.ps1 `
      -RemoteUser <ssh-user> `
      -RemoteHost <server-hostname> `
      -SshKeyPath "<path-to-ssh-key>" `
      -DockerHubUser <dockerhub-username>

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
    [switch]$SkipBuild          # skip local build+push (re-deploy same image)
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
    & ssh -i $script:LocalKeyPath -o StrictHostKeyChecking=no "$RemoteUser@$RemoteHost" $Cmd
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
if (-not $SkipBuild) {

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
    # The build runs on YOUR machine (fast), not the slow VM.
    # DOCKERHUB_USER is passed so docker-compose.yml tags it correctly.
    # ============================================================

    # Pass DOCKERHUB_USER into the local build environment
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

# Ensure DOCKERHUB_USER is set in the remote .env.local
$remoteEnvLine = "DOCKERHUB_USER=$DockerHubUser"
Invoke-SSH "grep -q '^DOCKERHUB_USER=' $RemoteDir/.env.local && sed -i 's|^DOCKERHUB_USER=.*|$remoteEnvLine|' $RemoteDir/.env.local || echo '$remoteEnvLine' >> $RemoteDir/.env.local"

# Docker Compose V1 reads '.env' automatically (no --env-file flag support).
# Copy .env.local -> .env on the server so 'docker compose up' picks it up.
Invoke-SSH "cp $RemoteDir/.env.local $RemoteDir/.env"
Write-Host "    .env copied from .env.local on server" -ForegroundColor DarkGray

Write-Host "    Stopping old container ..." -ForegroundColor DarkGray
Invoke-SSH "cd $RemoteDir && docker compose down --remove-orphans 2>/dev/null; true"

Write-Host "    Pulling $FullImage ..." -ForegroundColor DarkGray
Invoke-SSH "docker pull $FullImage"
if ($LASTEXITCODE -ne 0) { Write-Fail "docker pull failed on remote"; exit 1 }
Write-OK "Image pulled on server"

Write-Host "    Starting container ..." -ForegroundColor DarkGray
Invoke-SSH "cd $RemoteDir && docker compose up -d"
if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose up failed"; exit 1 }
Write-OK "Container started"




# ============================================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor DarkGray
Write-OK "Deployment complete!"
Write-Host "  URL  : https://$RemoteHost" -ForegroundColor White
Write-Host "  Image: $FullImage" -ForegroundColor White
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor DarkGray
Write-Host "  Logs   : ssh -i '$($script:LocalKeyPath)' ${RemoteUser}@${RemoteHost} 'docker logs -f travelaccess-web'" -ForegroundColor DarkGray
Write-Host "  Stop   : ssh -i '$($script:LocalKeyPath)' ${RemoteUser}@${RemoteHost} 'cd $RemoteDir && docker compose down'" -ForegroundColor DarkGray
Write-Host "  Rollback: docker pull ${DockerHubUser}/${ImageName}:<prev-tag> then redeploy" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Fast redeploy (same certs/wallet, fresh build):" -ForegroundColor DarkGray
Write-Host "  .\deploy.ps1 -RemoteUser $RemoteUser -RemoteHost $RemoteHost -SshKeyPath '...' -DockerHubUser $DockerHubUser -SkipRuntimeFiles" -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor DarkGray
Write-Host ""
