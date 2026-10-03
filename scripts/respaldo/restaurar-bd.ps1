# Restaura un respaldo de RepTel desde Amazon S3.
#   .\restaurar-bd.ps1                                  -> el mas reciente, sobre la base real (pide confirmacion)
#   .\restaurar-bd.ps1 -Archivo reptel-2026-10-03_2300.zip
#   .\restaurar-bd.ps1 -BaseDestino reptel_prueba       -> en otra base, sin tocar la real
param([string]$Archivo, [string]$BaseDestino)
. (Join-Path $PSScriptRoot 'comun.ps1')

$cnf = $null; $tmp = $null
try {
    $con = Leer-Conexion
    if (-not $BaseDestino) { $BaseDestino = $con.Base }

    if (-not $Archivo) {
        $lista = & aws s3 ls "s3://$($Script:Bucket)/mysql/" --profile $Script:Perfil
        $Archivo = $lista | Where-Object { $_ -match 'reptel-.*\.zip' } | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object | Select-Object -Last 1
        if (-not $Archivo) { throw 'No hay respaldos en S3' }
    }

    if ($BaseDestino -eq $con.Base) {
        $ok = Read-Host "Esto REEMPLAZA la base real '$BaseDestino' con $Archivo. Escribe RESTAURAR para continuar"
        if ($ok -ne 'RESTAURAR') { Write-Host 'Cancelado.'; exit 0 }
    }

    $tmp = Join-Path $env:TEMP ("reptel-restaurar-{0}" -f [guid]::NewGuid())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    $zip = Join-Path $tmp $Archivo
    & aws s3 cp "s3://$($Script:Bucket)/mysql/$Archivo" $zip --profile $Script:Perfil --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw "No se pudo bajar $Archivo de S3" }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $sql = Get-ChildItem $tmp -Filter '*.sql' | Select-Object -First 1
    if (-not $sql) { throw 'El respaldo no contiene un archivo .sql' }

    # Otra base de destino: se cambia el nombre de la base dentro del respaldo.
    if ($BaseDestino -ne $con.Base) {
        $texto = [System.IO.File]::ReadAllText($sql.FullName)
        $origen = '`' + $con.Base + '`'
        $destino = '`' + $BaseDestino + '`'
        $texto = $texto.Replace("CREATE DATABASE /*!32312 IF NOT EXISTS*/ $origen", "CREATE DATABASE /*!32312 IF NOT EXISTS*/ $destino").Replace("USE $origen;", "USE $destino;")
        [System.IO.File]::WriteAllText($sql.FullName, $texto, (New-Object System.Text.UTF8Encoding($false)))
    }

    $cnf = Crear-Cnf $con
    Escribir-Log "Restaurando $Archivo en la base '$BaseDestino'"
    $p = Start-Process -FilePath (Join-Path $Script:MySqlBin 'mysql.exe') -ArgumentList "--defaults-extra-file=`"$cnf`"", '--default-character-set=utf8mb4' -RedirectStandardInput $sql.FullName -NoNewWindow -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "mysql termino con codigo $($p.ExitCode)" }
    Escribir-Log "Restauracion terminada: $Archivo -> $BaseDestino"
    exit 0
} catch {
    Escribir-Log "ERROR al restaurar: $($_.Exception.Message)"
    exit 1
} finally {
    if ($cnf -and (Test-Path $cnf)) { Remove-Item $cnf -Force }
    if ($tmp -and (Test-Path $tmp)) { Remove-Item $tmp -Recurse -Force }
}
