$rows = Import-Csv .agents/teamwork/explorer_survey_db_1/security_definer_full_audit.csv
$legacy = $rows | Where-Object { $_.SearchPathStatus -eq 'PHASE1 (public, extensions)' }
foreach ($item in $legacy) {
    [PSCustomObject]@{
        Function = $item.Function
        Params = $item.Params
        LastFile = $item.LastFile
    } | Export-Csv -Path .agents/teamwork/worker_m1_db_1/legacy_functions.csv -Append -NoTypeInformation
}
