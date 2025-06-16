# PowerShell script to convert SVG to PNG icons using Inkscape
# Make sure Inkscape is installed: https://inkscape.org/release/inkscape-1.2/

# Check if Inkscape exists in common locations
$inkscapePaths = @(
    "C:\Program Files\Inkscape\bin\inkscape.exe",
    "C:\Program Files\Inkscape\inkscape.exe",
    "C:\Program Files (x86)\Inkscape\bin\inkscape.exe",
    "C:\Program Files (x86)\Inkscape\inkscape.exe"
)

$inkscapePath = $null
foreach ($path in $inkscapePaths) {
    if (Test-Path $path) {
        $inkscapePath = $path
        break
    }
}

if ($null -eq $inkscapePath) {
    Write-Host "Inkscape not found. Please install Inkscape from https://inkscape.org/"
    Write-Host "After installing, run this script again."
    exit 1
}

# Set paths
$svgPath = Join-Path $PSScriptRoot "icons\icon.svg"
$outputDir = Join-Path $PSScriptRoot "icons"

# Define icon sizes to generate
$sizes = @(16, 32, 48, 128)

# Generate each icon size
foreach ($size in $sizes) {
    $outputFile = Join-Path $outputDir "icon$size.png"
    Write-Host "Generating $size x $size icon..."
    
    # Run Inkscape to convert the SVG to PNG
    & $inkscapePath --export-filename="$outputFile" --export-width=$size --export-height=$size "$svgPath"
    
    if (Test-Path $outputFile) {
        Write-Host "Created: $outputFile"
    } else {
        Write-Host "Failed to create: $outputFile" -ForegroundColor Red
    }
}

Write-Host "Icon generation complete!" 