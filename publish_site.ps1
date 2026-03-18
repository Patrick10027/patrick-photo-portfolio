param(
    [string]$CommitMessage = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    throw "Run this from the static site repo root."
}

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes detected. Nothing to publish."
    exit 0
}

git add .

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No tracked changes to commit."
    exit 0
}

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    $CommitMessage = "Update portfolio site - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

git commit -m $CommitMessage
git push origin main

Write-Host "Site published successfully."