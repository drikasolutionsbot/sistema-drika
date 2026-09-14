$base = 'c:\Users\Lucas\.antigravity-ide\sistema-drika'
$files = @(
  'supabase\functions\deliver-order\index.ts',
  'supabase\functions\generate-sale-image\index.ts',
  'supabase\functions\discord-interactions\index.ts',
  'supabase\functions\expire-pending-orders\index.ts',
  'supabase\functions\send-ticket-log\index.ts'
)
foreach ($rel in $files) {
  $path = Join-Path $base $rel
  $c = [System.IO.File]::ReadAllText($path)
  $c = $c -replace 'toLocaleTimeString\("pt-BR", \{ hour: "2-digit", minute: "2-digit" \}\)', 'toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })'
  $c = $c -replace 'toLocaleDateString\("pt-BR"\)', 'toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })'
  $c = $c -replace 'toLocaleDateString\("pt-BR", \{ day: "2-digit", month: "2-digit" \}\)', 'toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })'
  [System.IO.File]::WriteAllText($path, $c)
  Write-Host "Fixed: $rel"
}
