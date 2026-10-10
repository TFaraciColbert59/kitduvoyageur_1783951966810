$files = Get-ChildItem -Path "supabase\migrations\*.sql" | Sort-Object Name
$results = @()

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $pattern = '(?si)CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\((.*?)\).*?(?=AS\s+\$\$|\$\$)';
    $matches = [regex]::Matches($content, $pattern)
    foreach ($m in $matches) {
        $header = $m.Value
        if ($header -match '(?i)SECURITY\s+DEFINER') {
            $funcName = $m.Groups[1].Value
            $params = ($m.Groups[2].Value -replace '\s+', ' ').Trim()
            $hasSearchPath = $header -match '(?i)SET\s+search_path\s*='
            $searchPath = ""
            if ($header -match '(?i)SET\s+search_path\s*=\s*([^;\n\r]+)') {
                $searchPath = $matches[1].Trim()
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

$inventory | ConvertTo-Json -Depth 3 | Set-Content -Path ".agents\teamwork\explorer_survey_db_1\security_definer_inventory.json" -Encoding UTF8
Write-Output "Saved $($inventory.Count) unique functions to JSON."
