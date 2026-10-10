$inv = Get-Content ".agents\teamwork\explorer_survey_db_1\security_definer_inventory.json" -Raw | ConvertFrom-Json
$alterSearchPaths = @{}

$files = Get-ChildItem -Path "supabase\migrations\*.sql" | Sort-Object Name
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $matches = [regex]::Matches($content, 'ALTER\s+FUNCTION\s+public\.([a-zA-Z0-9_]+)\s*\([^)]*\)\s+SET\s+search_path\s*=\s*([^;\r\n]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($m in $matches) {
        $alterSearchPaths[$m.Groups[1].Value] = [PSCustomObject]@{
            File = $f.Name
            SearchPath = $m.Groups[2].Value.Trim()
        }
    }
}

$summary = foreach ($item in $inv) {
    $effectiveSp = $item.SearchPath
    $source = "CREATE ($($item.LastFile))"
    if ($alterSearchPaths.ContainsKey($item.Function)) {
        $alter = $alterSearchPaths[$item.Function]
        # if alter was after creation or if creation had no sp
        $effectiveSp = $alter.SearchPath
        $source = "ALTER ($($alter.File))"
    }
    
    [PSCustomObject]@{
        Function = $item.Function
        EffectiveSearchPath = if ($effectiveSp) { $effectiveSp } else { "NONE (VULNERABLE)" }
        Source = $source
        Params = $item.Params
    }
}

$summary | Export-Csv -Path ".agents\teamwork\explorer_survey_db_1\search_path_audit.csv" -NoTypeInformation -Encoding UTF8
$vuln = $summary | Where-Object { $_.EffectiveSearchPath -eq "NONE (VULNERABLE)" }
$ext = $summary | Where-Object { $_.EffectiveSearchPath -match "extensions" }
$pgtemp = $summary | Where-Object { $_.EffectiveSearchPath -match "pg_temp" }
$pubOnly = $summary | Where-Object { $_.EffectiveSearchPath -eq "public" }

Write-Output "Total SECURITY DEFINER functions: $($summary.Count)"
Write-Output "With NO search_path: $($vuln.Count)"
Write-Output "With 'public, extensions' (Phase 1): $($ext.Count)"
Write-Output "With 'public, pg_temp' (Secure / Target R1): $($pgtemp.Count)"
Write-Output "With 'public' only: $($pubOnly.Count)"

Write-Output "`n--- Sample NO search_path ---"
$vuln | Select-Object -First 15 Function, Source | Format-Table -AutoSize | Out-String

Write-Output "`n--- Sample 'public, extensions' ---"
$ext | Select-Object -First 15 Function, Source | Format-Table -AutoSize | Out-String
