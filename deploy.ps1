<#
.SYNOPSIS
    Deploys the TravelAccess application to a remote server by building the Docker image
    directly on the server (no Docker Hub required).

.EXAMPLE (full deploy - uploads source + builds on server)
    .\deploy.ps1 `
      -RemoteUser <ssh-user> `
      -RemoteHost <server-hostname> `
      -SshKeyPath "<path-to-ssh-key>"

.EXAMPLE (skip re-uploading certs/wallet/env - faster redeploy when only code changed)
    .\deploy.ps1 `
      -RemoteUser <ssh-user> `
      -RemoteHost <server-hostname> `
      -SshKeyPath "<path-to-ssh-key>" `
      -SkipRuntimeFiles
#>
param(
    [Parameter(Mandatory)][string]$RemoteUser,
    [Parameter(Mandatory)][string]$RemoteHost,
    [Parameter(Mandatory)][string]$SshKeyPath,
    [string]$ImageName = "travelaccess",
    [string]$Tag = "latest",
    [string]$RemoteDir = "~/TravelAccess",
    [switch]$SkipRuntimeFiles  # skip certs/wallet/env upload (already on server)
)

$LocalDir = $PSScriptRoot

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
    # Added -n to prevent ssh from consuming stdin, which often causes PowerShell scripts to intermittently stall
    & ssh -n -i $script:LocalKeyPath `
        -o StrictHostKeyChecking=no `
        -o BatchMode=yes `
        -o ConnectTimeout=15 `
        -o ServerAliveInterval=10 `
        -o ServerAliveCountMax=3 `
        "$RemoteUser@$RemoteHost" $Cmd
}
function Invoke-SCP {
    param([string]$Src, [string]$Dst, [switch]$Recurse)
    $scpArgs = @(
        "-i", $script:LocalKeyPath,
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=15"
    )
    if ($Recurse) { $scpArgs += "-r" }
    $scpArgs += $Src, "${RemoteUser}@${RemoteHost}:${Dst}"
    & scp @scpArgs
}

# ============================================================
Write-Step "Preflight checks"
# ============================================================

foreach ($tool in @("ssh", "scp", "docker", "tar")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Fail "$tool not found in PATH."
        exit 1
    }
}
Write-OK "ssh, scp, docker, tar available"

if (-not (Test-Path $SshKeyPath)) { Write-Fail "SSH key not found: $SshKeyPath"; exit 1 }
Write-OK "SSH key found"

# Stage key to ~/.ssh/ - Windows OpenSSH rejects quoted IdentityFile paths,
# so the key must live somewhere without spaces in the path.
$sshDir = Join-Path $env:USERPROFILE ".ssh"
$safeKeyName = "deploy_${RemoteHost}.key"
$script:LocalKeyPath = Join-Path $sshDir $safeKeyName

if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir | Out-Null }

if (Test-Path $script:LocalKeyPath) {
    icacls $script:LocalKeyPath /grant:r "${env:USERNAME}:(F)" | Out-Null
}
Copy-Item -Path $SshKeyPath -Destination $script:LocalKeyPath -Force
icacls $script:LocalKeyPath /inheritance:r /grant:r "${env:USERNAME}:(R)" | Out-Null
Write-OK "Key staged at ~/.ssh/$safeKeyName"

# Pre-flight: verify SSH works before doing any real work.
# BatchMode=yes means SSH fails immediately instead of hanging on a password prompt.
Write-Host "    Testing SSH connection to $RemoteHost ..." -ForegroundColor DarkGray
$connected = $false
for ($attempt = 1; $attempt -le 3; $attempt++) {
    & ssh -n -i $script:LocalKeyPath `
        -o StrictHostKeyChecking=no `
        -o BatchMode=yes `
        -o ConnectTimeout=10 `
        "$RemoteUser@$RemoteHost" "echo ok" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $connected = $true; break }
    Write-Warn "SSH attempt $attempt/3 failed (exit $LASTEXITCODE) - retrying in 3s ..."
    Start-Sleep -Seconds 3
}
if (-not $connected) {
    Write-Fail "Cannot connect to $RemoteHost after 3 attempts."
    Write-Fail "Common causes:"
    Write-Fail "  - Wrong SSH key (-SshKeyPath)"
    Write-Fail "  - Server firewall blocking port 22"
    Write-Fail "  - Server not running / unreachable"
    Write-Fail "  - Key not in server's ~/.ssh/authorized_keys"
    exit 1
}
Write-OK "SSH connection verified"

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

    Write-Step "Step 4 - Upload Oracle Wallet (Compressed)"
    $walletDir = "oracle_wallet"
    $localWalletPath = Join-Path $LocalDir $walletDir
    if (Test-Path $localWalletPath) {
        $tempWalletArchive = Join-Path $env:TEMP "oracle_wallet.tar.gz"
        $remoteWalletArchive = "/tmp/oracle_wallet.tar.gz"

        Write-Host "    Archiving Oracle wallet..." -ForegroundColor DarkGray
        & tar -czf $tempWalletArchive -C $LocalDir $walletDir
        if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to archive Oracle wallet"; exit 1 }

        Write-Host "    Uploading Oracle wallet archive..." -ForegroundColor DarkGray
        Invoke-SCP -Src $tempWalletArchive -Dst $remoteWalletArchive
        if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to upload Oracle wallet archive"; exit 1 }

        Write-Host "    Extracting Oracle wallet on server..." -ForegroundColor DarkGray
        # -C specifies the directory to extract into, -z for gzip
        Invoke-SSH "tar -xzf $remoteWalletArchive -C $RemoteDir && rm -f $remoteWalletArchive"
        if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to extract Oracle wallet on server"; exit 1 }

        Remove-Item $tempWalletArchive -Force
        Write-OK "Oracle wallet uploaded and extracted"
    }
    else {
        Write-Warn "oracle_wallet directory not found locally - skipping"
    }
}
else {
    Write-Host ""
    Write-Host "  [SKIP] Runtime files (-SkipRuntimeFiles)" -ForegroundColor DarkGray
}

# ============================================================
Write-Step "Step 5 - Upload source code for server-side build"
# ============================================================
# We tar the project (excluding node_modules, .next, .git) and build on the server.
# This works on any server architecture (ARM64, x86, etc.) - no Docker Hub needed.

$SrcDir = $RemoteDir + "/src"
$TarFile = "/tmp/travelaccess-src.tar.gz"
$localTar = Join-Path $env:TEMP "travelaccess-src.tar.gz"

Write-Host "    Creating archive of source files ..." -ForegroundColor DarkGray
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

# ============================================================
Write-Step "Step 6 - Build Docker image on server"
# ============================================================

$buildCmd = "set -e" +
"; rm -rf $SrcDir" +
"; mkdir -p $SrcDir" +
"; cd $SrcDir" +
"; tar -xzf $TarFile" +
"; docker build -t ${ImageName}:${Tag} ." +
"; rm -f $TarFile"
Invoke-SSH $buildCmd
if ($LASTEXITCODE -ne 0) { Write-Fail "Remote docker build failed"; exit 1 }
Write-OK "Image built on server: ${ImageName}:${Tag}"

# ============================================================
Write-Step "Step 7 - Start container via Proxy Deploy"
# ============================================================

$ProxyDeployScript = "C:\code\proxy\deploy.ps1"

if (Test-Path $ProxyDeployScript) {
    Write-Host "    Delegating to Proxy deployment script..." -ForegroundColor DarkGray
    & $ProxyDeployScript -RemoteUser $RemoteUser -RemoteHost $RemoteHost -SshKeyPath $SshKeyPath -LogContainer travelaccess-web
    if ($LASTEXITCODE -ne 0) { Write-Fail "Proxy deploy failed"; exit 1 }
}
else {
    Write-Fail "Could not find proxy deploy script at $ProxyDeployScript"
    exit 1
}