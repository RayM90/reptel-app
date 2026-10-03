# Programa el respaldo diario de RepTel a las 23:00. Si la PC estaba apagada
# a esa hora, se ejecuta al encenderla. Uso: .\registrar-tarea.ps1 [-Hora '23:00']
param([string]$Hora = '23:00')
$script = Join-Path $PSScriptRoot 'respaldo-bd.ps1'
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$disparador = New-ScheduledTaskTrigger -Daily -At $Hora
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName 'RepTel - Respaldo diario BD' -Action $accion -Trigger $disparador -Settings $ajustes -Description 'Respaldo diario de la base de datos de RepTel en Amazon S3' -Force | Out-Null
Write-Host "Tarea programada: todos los dias a las $Hora."
