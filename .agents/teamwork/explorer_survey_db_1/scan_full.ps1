$files = Get-ChildItem -Path "supabase\migrations\*.sql" | Sort-Object Name
$results = @()

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    # Pattern to match full CREATE FUNCTION up to $$ ... $$ (options before or after)
    $pattern = '(?si)CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?("?[a-zA-Z0-9_]+"?)?\s*\((.*?)\)\s*RETURNS\s+.*?(?:\$\$(?:.*?)\$\$|\$fn\$(?:.*?)\$fn\$)\s*([a-zA-Z0-9_\s]*);?'
    $matches = [regex]::Matches($content, $pattern)
    foreach ($m in $matches) {
        $wholeFunc = $m.Value
        if ($wholeFunc -match '(?i)SECURITY\s+DEFINER') {
            $funcName = ($m.Groups[1].Value -replace '"', '').Trim()
            $params = ($m.Groups[2].Value -replace '\s+', ' ').Trim()
            $hasSearchPath = $wholeFunc -match '(?i)SET\s+search_path\s*='
            $searchPath = ""
            if ($wholeFunc -match '(?i)SET\s+search_path\s*=\s*([^;$\n\r]+)') {
                $searchPath = $Matches[1].Trim()
            }
            $results += [PSCustomObject]@{
                File = $f.Name
                Function = $funcName
                Params = $params
                HasSearchPath = $hasSearchPath
                SearchPath = $searchPath
            }
        }
    }
}

$grouped = $results | Group-Object Function
$inventory = @()
foreach ($g in $grouped) {
    $last = $g.Group[-1]
    $inventory += [PSCustomObject]@{
        Function = $g.Name
        Count = $g.Count
        LastFile = $last.File
        HasSearchPath = $last.HasSearchPath
        SearchPath = $last.SearchPath
        Params = $last.Params
    }
}

$inventory | ConvertTo-Json -Depth 3 | Set-Content -Path ".agents\teamwork\explorer_survey_db_1\security_definer_inventory_full.json" -Encoding UTF8
Write-Output "Found $($inventory.Count) unique functions with full regex."
if ($inventory | Where-Object { $_.Function -eq "claim_reward_points" }) {
    Write-Output "claim_reward_points FOUND!"
} else {
    Write-Output "claim_reward_points still not found by regex."
}
