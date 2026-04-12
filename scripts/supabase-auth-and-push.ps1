$ErrorActionPreference = 'Stop'

param(
  [string]$ProjectRef = 'zzeyflxnmolfoqrvlxwc',
  [switch]$Push
)

function Read-SecretText {
  param([string]$Prompt)

  $secureValue = Read-Host $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)

  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
  finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}

function Invoke-CheckedCommand {
  param([string]$Command)

  Write-Host "> $Command" -ForegroundColor Cyan
  Invoke-Expression $Command

  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE: $Command"
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  $token = if ($env:SUPABASE_ACCESS_TOKEN) { $env:SUPABASE_ACCESS_TOKEN } else { Read-SecretText 'Supabase access token' }
  $dbPassword = if ($env:SUPABASE_DB_PASSWORD) { $env:SUPABASE_DB_PASSWORD } else { Read-SecretText 'Remote database password' }

  if ([string]::IsNullOrWhiteSpace($token)) {
    throw 'Supabase access token is required.'
  }

  if ([string]::IsNullOrWhiteSpace($dbPassword)) {
    throw 'Remote database password is required.'
  }

  Invoke-CheckedCommand "npx supabase login --token \"$token\" --name saechachorom --no-browser --yes"
  Invoke-CheckedCommand "npx supabase link --project-ref $ProjectRef --password \"$dbPassword\" --yes"

  if ($Push) {
    Invoke-CheckedCommand "npx supabase db push --include-all --password \"$dbPassword\" --yes"
    Write-Host 'Supabase authentication, link, and migration push completed.' -ForegroundColor Green
  }
  else {
    Write-Host 'Supabase authentication and project link completed.' -ForegroundColor Green
    Write-Host 'Run npm run supabase:push when you want to apply remote migrations.' -ForegroundColor Yellow
  }
}
finally {
  Pop-Location
}