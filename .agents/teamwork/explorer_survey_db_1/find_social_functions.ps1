$sources = @("supabase\baseline\prod_schema_20260911.sql") + (Get-ChildItem -Path "supabase\migrations\*.sql" | Select-Object -ExpandProperty FullName)

$socialTables = @('community_posts', 'post_likes', 'post_comments', 'carnets', 'carnet_likes', 'carnet_comments', 'carnet_favorites', 'user_follows', 'comment_reports', 'clubs', 'club_members', 'club_topics')

$foundFunctions = @{}

foreach ($src in $sources) {
    $content = Get-Content $src -Raw
    $pattern = '(?si)CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?("?[a-zA-Z0-9_]+"?)?\s*\((.*?)\)\s*RETURNS\s+.*?(?:\$\$(.*?)\$\$|\$fn\$(.*?)\$fn\$)\s*([a-zA-Z0-9_\s]*);?'
    $matches = [regex]::Matches($content, $pattern)
    foreach ($m in $matches) {
        $fnName = ($m.Groups[1].Value -replace '"', '').Trim()
        $params = ($m.Groups[2].Value -replace '\s+', ' ').Trim()
        $body = $m.Groups[3].Value + $m.Groups[4].Value
        $headerAndOpts = $m.Groups[0].Value
        
        $touchesTable = $false
        $matchedTables = @()
        foreach ($t in $socialTables) {
            if ($body -match "\b$t\b") {
                $touchesTable = $true
                $matchedTables += $t
            }
        }
        
        if ($touchesTable) {
            $isSecDef = ($headerAndOpts -match 'SECURITY\s+DEFINER')
            $foundFunctions[$fnName] = [PSCustomObject]@{
                Function = $fnName
                Params = $params
                Source = Split-Path $src -Leaf
                IsSecurityDefiner = $isSecDef
                Tables = ($matchedTables -join ', ')
            }
        }
    }
}

$foundFunctions.Values | Sort-Object Function | Format-Table Function, IsSecurityDefiner, Source, Tables -AutoSize | Out-String -Width 160
