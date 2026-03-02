param(
    [Parameter(Mandatory)][string]$RemoteUser,
    [Parameter(Mandatory)][string]$RemoteHost,
    [Parameter(Mandatory)][string]$SshKeyPath,
    [string]$RemoteDir = "~/TravelAccess"
)

$LocalDir = $PSScriptRoot

function Write-Step {
    param($msg)
    Write-Host ""
    Write-Host "------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "------------------------------------------" -ForegroundColor DarkGray
}
function Write-OK { param($msg) Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red }

# Runs a command via SSH. Output streams directly to terminal.
# Do NOT assign to a variable for commands whose output you want visible.
# Check $LASTEXITCODE after calling.
function Invoke-SSH {
    param([string]$Cmd)
    $sshArgs = @("-o", "StrictHostKeyChecking=no")
    if ($SshKeyPath) { $sshArgs = @("-i", $SshKeyPath) + $sshArgs }
    $sshArgs += "$RemoteUser@$RemoteHost", $Cmd
    & ssh @sshArgs
    # intentionally no return — $LASTEXITCODE reflects ssh exit code
}

# Captures SSH output as a string (for when you need to parse the result).
function Invoke-SSH-Capture {
    param([string]$Cmd)
    $sshArgs = @("-o", "StrictHostKeyChecking=no")
    if ($SshKeyPath) { $sshArgs = @("-i", $SshKeyPath) + $sshArgs }
    $sshArgs += "$RemoteUser@$RemoteHost", $Cmd
    $out = & ssh @sshArgs 2>&1
    return $out
}

function Invoke-SCP {
    param([string]$Src, [string]$Dst, [switch]$Recurse)
    $scpArgs = @("-o", "StrictHostKeyChecking=no")
    if ($SshKeyPath) { $scpArgs = @("-i", $SshKeyPath) + $scpArgs }
    if ($Recurse) { $scpArgs += "-r" }
    $scpArgs += $Src, "${RemoteUser}@${RemoteHost}:${Dst}"
    & scp @scpArgs
    # intentionally no return — $LASTEXITCODE reflects scp exit code
}

# ------------------------------------------------------------------
Write-Step "Preflight checks"

foreach ($tool in @("ssh", "scp")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Fail "$tool not found. Enable OpenSSH Client in Windows Optional Features."
        exit 1
    }
}
Write-OK "ssh and scp available"

if (-not (Test-Path $SshKeyPath)) { Write-Fail "SSH key not found: $SshKeyPath"; exit 1 }
Write-OK "SSH key found: $SshKeyPath"

# ------------------------------------------------------------------
Write-Step "Step 1 - Create remote directory structure"

Invoke-SSH "mkdir -p $RemoteDir/certificates/Cloud $RemoteDir/oracle_wallet"
if ($LASTEXITCODE -ne 0) { Write-Fail "Cannot create remote dirs. Check SSH access."; exit 1 }
Write-OK "Remote directories ready"

# ------------------------------------------------------------------
Write-Step "Step 2 - Copy project source"

$files = @("Dockerfile", "docker-compose.yml", "server.js", "package.json", "package-lock.json", "next.config.mjs", ".env.local", "middleware.js")
foreach ($f in $files) {
    $fp = Join-Path $LocalDir $f
    if (-not (Test-Path $fp)) { Write-Warn "Skipping (not found): $f"; continue }
    Write-Host "    Uploading $f ..." -ForegroundColor DarkGray
    Invoke-SCP -Src $fp -Dst "$RemoteDir/"
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed: $f"; exit 1 }
}

$dirs = @("app", "lib", "components", "public", "scripts", "database")
foreach ($d in $dirs) {
    $dp = Join-Path $LocalDir $d
    if (-not (Test-Path $dp)) { Write-Warn "Skipping dir (not found): $d"; continue }
    Write-Host "    Uploading $d/ ..." -ForegroundColor DarkGray
    Invoke-SCP -Src $dp -Dst "$RemoteDir/" -Recurse
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed dir: $d"; exit 1 }
}
Write-OK "Project source uploaded"

# ------------------------------------------------------------------
Write-Step "Step 3 - Copy Cloud certificates"

$certsDir = Join-Path $LocalDir "certificates\Cloud"
if (-not (Test-Path $certsDir)) { Write-Fail "Not found: $certsDir"; exit 1 }

foreach ($cf in (Get-ChildItem -Path $certsDir -File)) {
    Write-Host "    Uploading $($cf.Name) ..." -ForegroundColor DarkGray
    Invoke-SCP -Src $cf.FullName -Dst "$RemoteDir/certificates/Cloud/"
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed: $($cf.Name)"; exit 1 }
}
Write-OK "Certificates uploaded"

# ------------------------------------------------------------------
Write-Step "Step 4 - Copy Oracle Wallet"

$walletDir = Join-Path $LocalDir "oracle_wallet"
if (-not (Test-Path $walletDir)) {
    Write-Warn "oracle_wallet not found locally - skipping"
}
else {
    foreach ($wf in (Get-ChildItem -Path $walletDir -File)) {
        Write-Host "    Uploading $($wf.Name) ..." -ForegroundColor DarkGray
        Invoke-SCP -Src $wf.FullName -Dst "$RemoteDir/oracle_wallet/"
        if ($LASTEXITCODE -ne 0) { Write-Fail "Failed: $($wf.Name)"; exit 1 }
    }
    Write-OK "Oracle wallet uploaded"
}

# ------------------------------------------------------------------
Write-Step "Step 5 - Build and start container on $RemoteHost"

# Detect docker compose version (capture output to parse it)
$cv = Invoke-SSH-Capture "docker compose version > /dev/null 2>&1 && echo V2 || echo V1"
if ($cv -match "V2") {
    $compose = "docker compose"
    Write-Host "    Docker Compose V2 detected" -ForegroundColor DarkGray
}
else {
    $compose = "docker-compose"
    Write-Host "    Docker Compose V1 detected" -ForegroundColor DarkGray
}

# Tear down old container (suppress output)
Invoke-SSH "cd $RemoteDir && $compose --env-file .env.local down --remove-orphans 2>/dev/null" | Out-Null

# Build with --no-cache to ensure fresh COPY of uploaded source files
Write-Host "    Running docker build (nice -n 19 - low CPU priority)..." -ForegroundColor DarkGray
Invoke-SSH "cd $RemoteDir && nice -n 19 $compose --env-file .env.local build --no-cache"
if ($LASTEXITCODE -ne 0) { Write-Fail "Build failed - see output above"; exit 1 }
Write-OK "Build succeeded"

# Start container
Invoke-SSH "cd $RemoteDir && $compose --env-file .env.local up -d"
if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose up failed"; exit 1 }
Write-OK "Container started"

# ------------------------------------------------------------------
Write-Step "Step 6 - Smoke test"

Start-Sleep -Seconds 8

$pingUrl = "https://$RemoteHost"
Write-Host "    Testing $pingUrl ..." -ForegroundColor DarkGray

$resp = $null
$smokeErr = $null
try {
    $resp = Invoke-WebRequest -Uri $pingUrl -TimeoutSec 15 -UseBasicParsing -SkipCertificateCheck -ErrorAction Stop
}
catch {
    $smokeErr = $_.Exception.Message
}

if ($resp -and $resp.StatusCode -lt 500) {
    Write-OK "HTTPS $($resp.StatusCode) - site is up"
}
else {
    Write-Warn "Site not reachable yet (may still be starting)"
    if ($smokeErr) { Write-Host "    $smokeErr" -ForegroundColor DarkGray }
    Write-Host "    Logs: ssh -i '$SshKeyPath' ${RemoteUser}@${RemoteHost} 'docker logs travelaccess-web --tail 50'" -ForegroundColor DarkGray
}

# ------------------------------------------------------------------
Write-Host ""
Write-Host "==========================================" -ForegroundColor DarkGray
Write-OK "Deployment complete!"
Write-Host "  URL: https://$RemoteHost" -ForegroundColor White
Write-Host ""
Write-Host "  Logs  : ssh -i '$SshKeyPath' ${RemoteUser}@${RemoteHost} 'docker logs -f travelaccess-web'" -ForegroundColor DarkGray
Write-Host "  Stop  : ssh -i '$SshKeyPath' ${RemoteUser}@${RemoteHost} 'cd $RemoteDir && $compose down'" -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor DarkGray
Write-Host ""
