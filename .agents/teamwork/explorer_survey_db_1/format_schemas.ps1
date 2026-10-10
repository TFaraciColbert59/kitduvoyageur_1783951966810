$json = Get-Content ".agents\teamwork\explorer_survey_db_1\existing_tables_schema.json" -Raw | ConvertFrom-Json
$report = New-Object System.Text.StringBuilder

foreach ($prop in $json.psobject.Properties) {
    [void]$report.AppendLine("==================================================")
    [void]$report.AppendLine("TABLE: " + $prop.Name)
    [void]$report.AppendLine("==================================================")
    $entries = $prop.Value
    foreach ($e in $entries) {
        if ($e.Def) {
            [void]$report.AppendLine("  [CREATED in " + $e.File + "]:")
            $lines = ($e.Def -split "`n") | ForEach-Object { "    " + $_.Trim() } | Where-Object { $_.Trim().Length -gt 0 }
            [void]$report.AppendLine(($lines -join "`n"))
        }
        if ($e.Alter) {
            [void]$report.AppendLine("  [ALTER in " + $e.File + "]: " + $e.Alter.Trim())
        }
    }
    [void]$report.AppendLine("")
}

$report.ToString() | Set-Content -Path ".agents\teamwork\explorer_survey_db_1\table_schemas_summary.txt" -Encoding UTF8
Write-Output "Saved table schemas summary to table_schemas_summary.txt"
