# Divine Pride personal, on-demand ID lookups. Windows PowerShell 5.1 or PowerShell 7.
# The API key is requested interactively and never written to disk, ZIP, or output logs.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root 'data\divine-pride-cache.js'
$prefix = 'window.BorderDivinePrideCache = '
$groups = @{ monsters = @{}; items = @{}; skills = @{} }
$allowed = @{
  monsters = @(1002,1007,1063,1010,1004,1031)
  items = @(501,909)
  skills = @(5,6,7)
}
$jobs = @(
  @{ Group='monsters'; Type='Monster'; Id=1002 },
  @{ Group='monsters'; Type='Monster'; Id=1007 },
  @{ Group='monsters'; Type='Monster'; Id=1063 },
  @{ Group='monsters'; Type='Monster'; Id=1010 },
  @{ Group='monsters'; Type='Monster'; Id=1004 },
  @{ Group='monsters'; Type='Monster'; Id=1031 },
  @{ Group='items'; Type='Item'; Id=501 },
  @{ Group='items'; Type='Item'; Id=909 },
  @{ Group='skills'; Type='Skill'; Id=5 },
  @{ Group='skills'; Type='Skill'; Id=6 },
  @{ Group='skills'; Type='Skill'; Id=7 }
)
function CopyValue($source, [string]$field) {
  $property = $source.PSObject.Properties[$field]
  if ($null -eq $property -or $null -eq $property.Value) { return $null }
  $v = $property.Value
  if ($v -is [string]) { return $v.Substring(0, [Math]::Min(160, $v.Length)) }
  if ($v -is [bool] -or $v -is [int] -or $v -is [long] -or $v -is [double] -or $v -is [decimal]) { return $v }
  return $null
}
function Normalize($record, [string]$group, [int]$wantedId) {
  if ($null -eq $record -or $null -eq $record.id -or [int]$record.id -ne $wantedId) { return $null }
  $fields = switch ($group) {
    'monsters' { @('name','level','health','attackRange','def','mDef','element','elementLevel','race','size','dataUpdatedAtUtc') }
    'items' { @('name','type','subType','buyPrice','sellPrice','weight','dataUpdatedAtUtc') }
    'skills' { @('name','databaseName','maxLevel','spCost','range','cooldown','dataUpdatedAtUtc') }
  }
  $clean = [ordered]@{ id = $wantedId }
  foreach ($field in $fields) {
    $value = CopyValue $record $field
    if ($null -ne $value) { $clean[$field] = $value }
  }
  # Imported names are informational, not authoritative Pre-Renewal gameplay data.
  return $clean
}
function WriteCache {
  $snapshot = [ordered]@{
    schema = 1; region = 'thROC'
    fetchedAt = ([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))
    monsters = $groups.monsters; items = $groups.items; skills = $groups.skills
  }
  $json = ConvertTo-Json -InputObject $snapshot -Depth 12 -Compress
  $tmp = "$target.tmp"
  [IO.File]::WriteAllText($tmp, ($prefix + $json + ';' + [Environment]::NewLine), (New-Object System.Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $tmp -Destination $target -Force
}
# Reuse only the explicitly selected IDs; copy only whitelisted fields from existing cache.
try {
  $text = [IO.File]::ReadAllText($target, [Text.Encoding]::UTF8)
  $at = $text.IndexOf($prefix)
  if ($at -ge 0) {
    $payload = $text.Substring($at + $prefix.Length).Trim().TrimEnd(';') | ConvertFrom-Json
    if ($payload.schema -eq 1 -and $payload.region -eq 'thROC') {
      foreach ($group in @('monsters','items','skills')) {
        foreach ($entry in $payload.$group.PSObject.Properties) {
          $id = 0
          if ([int]::TryParse($entry.Name, [ref]$id) -and ($allowed[$group] -contains $id)) {
            $normal = Normalize $entry.Value $group $id
            if ($null -ne $normal) { $groups[$group][$entry.Name] = $normal }
          }
        }
      }
    }
  }
} catch { Write-Host 'Cache unreadable; starting with a new curated cache.' -ForegroundColor Yellow }
$pending = @($jobs | Where-Object { -not $groups[$_.Group].ContainsKey([string]$_.Id) })
Write-Host 'Borderlands Classic: Divine Pride curated ID importer (thROC)' -ForegroundColor Cyan
Write-Host 'Only 6 named monsters, 2 named items and 3 known skills; no database crawling.'
Write-Host ('Cached: ' + ($jobs.Count - $pending.Count) + ' / ' + $jobs.Count)
if ($pending.Count -eq 0) { Write-Host 'All selected IDs cached. Open index.html -> Codex.' -ForegroundColor Green; exit 0 }
Write-Host 'API key stays in RAM. The generated cache contains only selected facts and no artwork.'
$secure = Read-Host 'Paste your API key (hidden)' -AsSecureString
if ($secure.Length -eq 0) { Write-Host 'Cancelled: empty key'; exit 1 }
$bstr = [IntPtr]::Zero
$key = $null
$requests = 0
$imported = 0
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  foreach ($job in $pending) {
    $record = $null
    for ($attempt = 0; $attempt -lt 2; $attempt++) {
      if ($requests -gt 0) { Start-Sleep -Milliseconds 1100 }
      $requests++
      $uri = 'https://www.divine-pride.net/api/database/' + $job.Type + '/' + $job.Id + '?apiKey=' + [Uri]::EscapeDataString($key)
      try {
        $result = Invoke-WebRequest -Uri $uri -Headers @{ 'x-server' = 'thROC'; 'Accept-Language' = 'th' } -UseBasicParsing -TimeoutSec 25 -ErrorAction Stop
        $record = $result.Content | ConvertFrom-Json
        break
      } catch {
        $response = $_.Exception.Response
        $code = 0
        if ($null -ne $response) { $code = [int]$response.StatusCode }
        if ($code -eq 404) { Write-Host ('Not found: ' + $job.Type + ' #' + $job.Id); break }
        if ($code -eq 401 -or $code -eq 403) { throw 'API authorization failed. Check your key/account. No key was saved.' }
        if ($code -eq 429) {
          if ($attempt -eq 1) { throw 'API rate limit persists; stop now and retry later. Saved records are cached.' }
          $retry = 30
          if ($null -ne $response) {
            $raw = $response.Headers['Retry-After']
            $seconds = 0
            if ([int]::TryParse([string]$raw,[ref]$seconds)) { $retry = [Math]::Max(1,[Math]::Min(120,$seconds)) }
          }
          Write-Host ('Rate limited. Pausing ' + $retry + ' seconds once.') -ForegroundColor Yellow
          Start-Sleep -Seconds $retry
          continue
        }
        throw ('Request stopped for ' + $job.Type + ' #' + $job.Id + ' (HTTP ' + $code + '). Re-run later; successful records are cached.')
      } finally { $uri = $null }
    }
    if ($null -eq $record) { continue }
    $clean = Normalize $record $job.Group ([int]$job.Id)
    if ($null -eq $clean) { Write-Host ('Unexpected response for ' + $job.Type + ' #' + $job.Id + '; skipped') -ForegroundColor Yellow; continue }
    $groups[$job.Group][[string]$job.Id] = $clean
    WriteCache
    $imported++
    Write-Host ('Cached ' + $job.Type + ' #' + $job.Id) -ForegroundColor Green
  }
  Write-Host ('Done: ' + $imported + ' new records. Open/reload index.html -> Codex.') -ForegroundColor Green
} catch {
  # Never print the request exception: on some PowerShell versions it includes ?apiKey=...
  Write-Host ([string]$_.Exception.Message -replace 'apiKey=[^&\s]+','apiKey=[REDACTED]') -ForegroundColor Red
  exit 1
} finally {
  $key = $null
  $secure = $null
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
