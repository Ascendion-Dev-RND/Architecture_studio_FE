# PowerShell script to complete component refactoring
# This script creates HTML, CSS, and spec.ts files for remaining components

Write-Host "Starting component refactoring..." -ForegroundColor Green

# Function to extract template from TS file
function Extract-Template {
    param([string]$filePath)
    
    $content = Get-Content $filePath -Raw
    $pattern = '(?s)template:\s*`(.+?)`,'
    if ($content -match $pattern) {
        return $Matches[1].Trim()
    }
    return ""
}

# Components to process
$components = @(
    @{
        Name = "features-section"
        Path = "src/app/components/features-section"
        Selector = "app-features-section"
    },
    @{
        Name = "projects-section"
        Path = "src/app/components/projects-section"
        Selector = "app-projects-section"
    }
)

# Pages to process
$pages = @(
    @{
        Name = "home"
        Path = "src/app/pages/home"
        Selector = "app-home"
    },
    @{
        Name = "architecture-generator"
        Path = "src/app/pages/architecture-generator"
        Selector = "app-architecture-generator"
    },
    @{
        Name = "architecture-workspace"
        Path = "src/app/pages/architecture-workspace"
        Selector = "app-architecture-workspace"
    },
    @{
        Name = "architecture-assessment"
        Path = "src/app/pages/architecture-assessment"
        Selector = "app-architecture-assessment"
    },
    @{
        Name = "assessment-options"
        Path = "src/app/pages/assessment-options"
        Selector = "app-assessment-options"
    },
    @{
        Name = "architecture-assessment-report"
        Path = "src/app/pages/architecture-assessment-report"
        Selector = "app-architecture-assessment-report"
    },
    @{
        Name = "e2e-system-design"
        Path = "src/app/pages/e2e-system-design"
        Selector = "app-e2e-system-design"
    },
    @{
        Name = "e2e-system-design-output"
        Path = "src/app/pages/e2e-system-design-output"
        Selector = "app-e2e-system-design-output"
    }
)

Write-Host "`nProcessing components and pages..." -ForegroundColor Yellow

$allComponents = $components + $pages

foreach ($comp in $allComponents) {
    $tsFile = "$($comp.Path)/$($comp.Name).component.ts"
    $htmlFile = "$($comp.Path)/$($comp.Name).component.html"
    $cssFile = "$($comp.Path)/$($comp.Name).component.css"
    $specFile = "$($comp.Path)/$($comp.Name).component.spec.ts"
    
    Write-Host "`nProcessing: $($comp.Name)" -ForegroundColor Cyan
    
    # Check if files already exist
    if (Test-Path $htmlFile) {
        Write-Host "  ✓ HTML already exists" -ForegroundColor Gray
    } else {
        Write-Host "  → HTML needs to be created manually" -ForegroundColor Yellow
    }
    
    if (!(Test-Path $cssFile)) {
        # Create CSS file
        @"
/* $($comp.Name) component styles */
/* All styles handled by Tailwind utilities */
"@ | Out-File -FilePath $cssFile -Encoding UTF8
        Write-Host "  ✓ Created CSS file" -ForegroundColor Green
    }
    
    if (!(Test-Path $specFile)) {
        Write-Host "  → Spec file needs to be created" -ForegroundColor Yellow
    }
}

Write-Host "`n✓ Refactoring helper complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Manually extract templates from TS files to HTML files"
Write-Host "2. Update TS files to use templateUrl and styleUrls"
Write-Host "3. Create comprehensive spec.ts files for each component"
Write-Host "4. Run 'ng test' to verify all tests pass"
