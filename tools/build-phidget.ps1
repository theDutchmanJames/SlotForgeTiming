$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The .NET Framework 4 compiler is required to rebuild the Windows Phidget helper.' }
& $compiler /nologo /optimize+ /target:exe /platform:x64 /reference:System.Web.Extensions.dll "/out:$project\native\phidget\SlotForgePhidget.exe" "$project\native\phidget\SlotForgePhidget.cs"
if ($LASTEXITCODE -ne 0) { throw 'Phidget helper compilation failed.' }
