<?php
// Simple zip extraction script
echo "Starting extraction...\n";

if (!file_exists('deploy_manual.zip')) {
    echo "ERROR: deploy_manual.zip not found\n";
    exit(1);
}

$zip = new ZipArchive;
$result = $zip->open('deploy_manual.zip');

if ($result === TRUE) {
    echo "Extracting " . $zip->numFiles . " files...\n";
    
    // Extract all files
    $zip->extractTo('./');
    $zip->close();
    
    echo "Extraction completed successfully!\n";
    
    // Clean up
    if (unlink('deploy_manual.zip')) {
        echo "Deployment zip removed\n";
    }
    
    echo "Deployment complete!\n";
} else {
    echo "ERROR: Failed to open deployment zip (code: $result)\n";
    exit(1);
}
?>