$tables = @(
    'community_posts', 'post_likes', 'post_comments', 'user_follows',
    'carnets', 'carnet_likes', 'carnet_comments', 'carnet_favorites',
    'user_profiles', 'clubs', 'club_members', 'club_topics', 'comment_reports'
)

$output = @{}

foreach ($t in $tables) {
    # Find columns in prod_schema or migrations
    $cols = @()
    # Check migrations
    $files = Get-ChildItem -Path "supabase\migrations\*.sql" | Sort-Object Name
    foreach ($f in $files) {
        $content = Get-Content $f.FullName -Raw
        if ($content -match "(?si)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.$t\s*\((.*?)\);") {
            $cols += [PSCustomObject]@{ File = $f.Name; Def = $Matches[1] }
        }
        if ($content -match "(?si)ALTER\s+TABLE\s+(?:ONLY\s+)?public\.$t\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([^;]+);") {
            $cols += [PSCustomObject]@{ File = $f.Name; Alter = $Matches[1] }
        }
    }
    $output[$t] = $cols
}

$output | ConvertTo-Json -Depth 4 | Set-Content -Path ".agents\teamwork\explorer_survey_db_1\existing_tables_schema.json" -Encoding UTF8
Write-Output "Extracted existing tables schema to JSON."
