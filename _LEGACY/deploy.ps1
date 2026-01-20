$ErrorActionPreference = "Stop"

$file = "$PSScriptRoot\index.html"
$content = Get-Content $file -Raw -Encoding UTF8

# Find version pattern in APP_VERSION constant
if ($content -match 'const APP_VERSION = "(\d+)\.(\d+)\.(\d+)"') {
    $major = $matches[1]
    $minor = $matches[2]
    $patch = $matches[3]

    # Increment patch
    $newPatch = [int]$patch + 1
    
    $oldVersion = "$major.$minor.$patch"
    $newVersion = "$major.$minor.$newPatch"
    $newVersionTag = "v$newVersion"

    # Replace in constant
    $content = $content -replace "const APP_VERSION = `"$oldVersion`"", "const APP_VERSION = `"$newVersion`""

    Set-Content $file $content -Encoding UTF8 -NoNewline
    
    Write-Host "Bumped version: v$oldVersion -> $newVersionTag" -ForegroundColor Green

    # Git Operations
    Write-Host "Adding files..." -ForegroundColor Cyan
    git add .

    $commitMsg = "Update to $newVersionTag"
    Write-Host "Committing: $commitMsg" -ForegroundColor Cyan
    git commit -m "$commitMsg"

    Write-Host "Tagging: $newVersionTag" -ForegroundColor Cyan
    git tag $newVersionTag

    Write-Host "Pushing to origin..." -ForegroundColor Cyan
    git push origin main --tags

    Write-Host "Deployment Complete!" -ForegroundColor Green
}
else {
    Write-Error "Could not find version pattern 'vX.X.X' in $file"
}
