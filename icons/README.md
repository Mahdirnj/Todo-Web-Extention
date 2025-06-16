# Todo Extension Icons

This directory contains the icon assets for the Sticky Todo extension.

## Icon Files

The extension requires the following icon sizes:

- `icon16.png` (16x16) - Used in browser's extension list and as favicon
- `icon32.png` (32x32) - For Windows computers and menus
- `icon48.png` (48x48) - For the Chrome Web Store
- `icon128.png` (128x128) - For the Chrome Web Store and installation
- `icon.svg` - Vector source file for the icons

## Generating Icons

There are two ways to generate the required PNG icons from the SVG source:

### Method 1: Using the Browser Generator (Easiest)

1. Open the `icon_generator.html` file in your web browser (located in the parent directory)
2. You'll see previews of all required icon sizes
3. Click either individual "Download" buttons or "Download All Icons"
4. Save the downloaded PNG files to this icons directory

### Method 2: Using PowerShell and Inkscape

If you have Inkscape installed:

1. Open PowerShell
2. Navigate to the Todo-Extension directory
3. Run `.\generate_icons.ps1`
4. The script will generate all icon sizes in this directory

## Customizing Icons

If you want to use a different icon:

1. Replace `icon.svg` with your new SVG file
2. Generate new PNGs using one of the methods above
3. Ensure your manifest.json references match the icon filenames

## Current Icon

The current icon is a purple checkmark with a circle and line, representing the todo functionality of the extension. 