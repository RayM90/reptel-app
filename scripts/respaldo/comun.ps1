# Funciones compartidas por los scripts de respaldo de RepTel.
$ErrorActionPreference = 'Stop'

$Script:Bucket   = 'reptel-respaldos-369559608282'
$Script:Perfil   = 'reptel-backup'
$Script:Carpeta  = Join-Path $env:USERPROFILE 'Documents\RepTel-respaldos'
$Script:MySqlBin = 'C:\Program Files\MySQL\MySQL Server 8.0\bin'

function Escribir-Log([string]$mensaje) {
    if (-not (Test-Path $Script:Carpeta)) { New-Item -ItemType Directory -Path $Script:Carpeta | Out-Null }
    $linea = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $mensaje
    Add-Content -Path (Join-Path $Script:Carpeta 'respaldo.log') -Value $linea -Encoding UTF8
    Write-Host $linea
}

# Lee DATABASE_URL de server\.env (mysql://usuario:clave@host:puerto/base).
function Leer-Conexion {
    $envPath = Join-Path $PSScriptRoot '..\..\server\.env'
    if (-not (Test-Path $envPath)) { throw "No se encontro server\.env en $envPath" }
    $linea = Get-Content $envPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if (-not $linea) { throw 'server\.env no tiene DATABASE_URL' }
    $url = ($linea -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
    $uri = [System.Uri]$url
    $partes = $uri.UserInfo.Split(':', 2)
    [pscustomobject]@{
        Usuario = [System.Uri]::UnescapeDataString($partes[0])
        Clave   = if ($partes.Count -gt 1) { [System.Uri]::UnescapeDataString($partes[1]) } else { '' }
        Host    = $uri.Host
        Puerto  = if ($uri.Port -gt 0) { $uri.Port } else { 3306 }
        Base    = $uri.AbsolutePath.Trim('/').Split('?')[0]
    }
}

# Archivo temporal de opciones de MySQL: la clave nunca va en la linea de
# comandos. Solo el usuario actual puede leerlo; quien llama debe borrarlo.
function Crear-Cnf($con) {
    $cnf = Join-Path $env:TEMP ("reptel-{0}.cnf" -f [guid]::NewGuid())
    $contenido = "[client]`nuser=$($con.Usuario)`npassword=$($con.Clave)`nhost=$($con.Host)`nport=$($con.Puerto)`n"
    [System.IO.File]::WriteAllText($cnf, $contenido, (New-Object System.Text.UTF8Encoding($false)))
    icacls $cnf /inheritance:r /grant:r "$($env:USERNAME):(R,W,D)" | Out-Null
    return $cnf
}
