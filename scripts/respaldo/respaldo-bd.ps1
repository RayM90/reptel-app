# Respaldo de la base de datos de RepTel: copia comprimida en la PC (7 dias)
# y en Amazon S3 (30 dias, se borra sola). Uso: .\respaldo-bd.ps1
. (Join-Path $PSScriptRoot 'comun.ps1')

$cnf = $null
try {
    $con = Leer-Conexion
    $cnf = Crear-Cnf $con
    if (-not (Test-Path $Script:Carpeta)) { New-Item -ItemType Directory -Path $Script:Carpeta | Out-Null }

    $nombre = "reptel-{0}" -f (Get-Date -Format 'yyyy-MM-dd_HHmm')
    $sql = Join-Path $Script:Carpeta "$nombre.sql"
    $zip = Join-Path $Script:Carpeta "$nombre.zip"

    Escribir-Log "Inicio del respaldo de la base '$($con.Base)'"
    & (Join-Path $Script:MySqlBin 'mysqldump.exe') "--defaults-extra-file=$cnf" --single-transaction --routines --triggers --set-gtid-purged=OFF --default-character-set=utf8mb4 "--result-file=$sql" --databases $con.Base
    if ($LASTEXITCODE -ne 0) { throw "mysqldump termino con codigo $LASTEXITCODE" }

    Compress-Archive -Path $sql -DestinationPath $zip -Force
    Remove-Item $sql
    Escribir-Log ("Copia local: {0} ({1:N1} KB)" -f $zip, ((Get-Item $zip).Length / 1KB))

    & aws s3 cp $zip "s3://$($Script:Bucket)/mysql/$nombre.zip" --profile $Script:Perfil --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw "La subida a S3 fallo (codigo $LASTEXITCODE)" }
    Escribir-Log "Subido a S3: s3://$($Script:Bucket)/mysql/$nombre.zip"

    Get-ChildItem $Script:Carpeta -Filter 'reptel-*.zip' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | ForEach-Object {
        Remove-Item $_.FullName
        Escribir-Log "Copia local antigua borrada: $($_.Name)"
    }
    Escribir-Log 'Respaldo terminado correctamente'
    exit 0
} catch {
    Escribir-Log "ERROR: $($_.Exception.Message)"
    exit 1
} finally {
    if ($cnf -and (Test-Path $cnf)) { Remove-Item $cnf -Force }
}
