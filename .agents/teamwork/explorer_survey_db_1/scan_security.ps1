$files = Get-ChildItem -Path "supabase\migrations\*.sql" | Sort-Object Name
$results = @()

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    # Pattern to find function header and body options before AS $$
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

Write-Output "Found $($results.Count) definitions."
$grouped = $results | Group-Object Function
Write-Output "Unique functions: $($grouped.Count)"
$grouped | ForEach-Object {
    $last = $_.Group[-1]
    [PSCustomObject]@{
        Function = $_.Name
        Count = $_.Count
        LastFile = $last.File
        HasSearchPath = $last.HasSearchPath
        SearchPath = $last.SearchPath
        Params = if ($last.Params.Length -gt 40) { $last.Params.Substring(0, 37) + "..." } else { $last.Params }
    }
} | Format-Table -AutoSize | Out-String -Width 180
