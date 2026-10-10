$inv = Get-Content ".agents\teamwork\explorer_survey_db_1\security_definer_inventory_full.json" -Raw | ConvertFrom-Json

# Gather all ALTER FUNCTION ... SET search_path
$alterSearchPaths = @{}
$revokeAnon = @{}
$revokeAuth = @{}
$grantService = @{}

$files = Get-ChildItem -Path "supabase\migrations\*.sql" | Sort-Object Name
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    
    # ALTER FUNCTION ... SET search_path
    $mSp = [regex]::Matches($content, 'ALTER\s+FUNCTION\s+public\.("?[a-zA-Z0-9_]+"?)?\s*\([^)]*\)\s+SET\s+search_path\s*=\s*([^;\r\n]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($m in $mSp) {
        $fn = ($m.Groups[1].Value -replace '"', '').Trim()
        $alterSearchPaths[$fn] = [PSCustomObject]@{
            File = $f.Name
            SearchPath = $m.Groups[2].Value.Trim()
        }
    }

    # REVOKE FROM anon
    $mRevAnon = [regex]::Matches($content, 'REVOKE\s+(?:ALL|EXECUTE)\s+(?:ON\s+FUNCTION\s+)?public\.("?[a-zA-Z0-9_]+"?)?\s*\([^)]*\)\s+FROM\s+[^;]*anon', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($m in $mRevAnon) {
        $fn = ($m.Groups[1].Value -replace '"', '').Trim()
        $revokeAnon[$fn] = $f.Name
    }

    # REVOKE FROM authenticated
    $mRevAuth = [regex]::Matches($content, 'REVOKE\s+(?:ALL|EXECUTE)\s+(?:ON\s+FUNCTION\s+)?public\.("?[a-zA-Z0-9_]+"?)?\s*\([^)]*\)\s+FROM\s+[^;]*authenticated', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($m in $mRevAuth) {
        $fn = ($m.Groups[1].Value -replace '"', '').Trim()
        $revokeAuth[$fn] = $f.Name
    }
}

# Now inspect body of each function for auth.uid() check
$bodyAuthCheck = @{}
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $pattern = '(?si)CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?("?[a-zA-Z0-9_]+"?)?\s*\((.*?)\)\s*RETURNS\s+.*?(?:\$\$(.*?)\$\$|\$fn\$(.*?)\$fn\$)\s*([a-zA-Z0-9_\s]*);?'
    $matches = [regex]::Matches($content, $pattern)
    foreach ($m in $matches) {
        $fn = ($m.Groups[1].Value -replace '"', '').Trim()
        $body = $m.Groups[3].Value + $m.Groups[4].Value
        $hasAuthCheck = ($body -match 'auth\.uid\(\)')
        $checksIdentity = ($body -match 'auth\.uid\(\)\s*(?:=|<>|IS\s+NULL|!=)\s*(?:p_[a-zA-Z0-9_]+|user_id|v_user_id)')
        $bodyAuthCheck[$fn] = [PSCustomObject]@{
            HasAuthUid = $hasAuthCheck
            ChecksIdentity = $checksIdentity
        }
    }
}

$report = foreach ($item in $inv) {
    $effectiveSp = $item.SearchPath
    $spSource = "CREATE ($($item.LastFile))"
    if ($alterSearchPaths.ContainsKey($item.Function)) {
        $effectiveSp = $alterSearchPaths[$item.Function].SearchPath
        $spSource = "ALTER ($($alterSearchPaths[$item.Function].File))"
    }

    $revAnon = $revokeAnon.ContainsKey($item.Function)
    $revAuth = $revokeAuth.ContainsKey($item.Function)

    $authCheck = if ($bodyAuthCheck.ContainsKey($item.Function)) { $bodyAuthCheck[$item.Function] } else { $null }

    [PSCustomObject]@{
        Function = $item.Function
        EffectiveSearchPath = if ($effectiveSp) { $effectiveSp } else { "NONE" }
        SearchPathStatus = if ($effectiveSp -match 'pg_temp') { "STRICT (public, pg_temp)" } elseif ($effectiveSp -match 'extensions') { "PHASE1 (public, extensions)" } elseif ($effectiveSp) { "PARTIAL ($effectiveSp)" } else { "MISSING" }
        RevokedAnon = $revAnon
        RevokedAuth = $revAuth
        HasAuthUid = if ($authCheck) { $authCheck.HasAuthUid } else { $false }
        ChecksIdentity = if ($authCheck) { $authCheck.ChecksIdentity } else { $false }
        LastFile = $item.LastFile
        Params = $item.Params
    }
}

$report | Export-Csv -Path ".agents\teamwork\explorer_survey_db_1\security_definer_full_audit.csv" -NoTypeInformation -Encoding UTF8

Write-Output "Audit complete. Total functions audited: $($report.Count)"
Write-Output "SearchPath Status Summary:"
$report | Group-Object SearchPathStatus | Select-Object Name, Count | Format-Table -AutoSize | Out-String

Write-Output "Target Focus Functions:"
$targetFns = @('claim_reward_points', 'award_progression_gain', 'toggle_community_post_like', 'request_withdrawal', 'process_pending_contribution', 'process_withdrawal', 'finalize_reward_period', 'sync_loyalty_points', 'update_loyalty_points')
$report | Where-Object { $targetFns -contains $_.Function } | Format-Table Function, EffectiveSearchPath, SearchPathStatus, RevokedAnon, RevokedAuth, HasAuthUid, ChecksIdentity, LastFile -AutoSize | Out-String
