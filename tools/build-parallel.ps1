$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The .NET Framework 4 C# compiler is required to rebuild the Windows helper.' }
$source = Join-Path $project 'native\parallel\SlotForgeParallel.cs'
$binary = Join-Path $project 'native\parallel\SlotForgeParallel.exe'
& $compiler /nologo /optimize+ /target:exe /platform:anycpu "/out:$binary" $source
if ($LASTEXITCODE -ne 0) { throw 'Parallel-port helper compilation failed.' }
Write-Output "Built $binary"
