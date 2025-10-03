<?php
// Test deployment script
echo "<h1>Deployment Test</h1>";
echo "<h2>Current Directory:</h2>";
echo "<pre>" . getcwd() . "</pre>";

echo "<h2>Files in Current Directory:</h2>";
echo "<pre>";
$files = scandir('.');
foreach($files as $file) {
    if($file != '.' && $file != '..') {
        echo $file . " ";
        if(is_file($file)) {
            echo "(file, " . filesize($file) . " bytes)";
        } elseif(is_dir($file)) {
            echo "(directory)";
        }
        echo "\n";
    }
}
echo "</pre>";

echo "<h2>PHP Info:</h2>";
echo "<pre>";
echo "PHP Version: " . phpversion() . "\n";
echo "Server: " . $_SERVER['SERVER_SOFTWARE'] . "\n";
echo "Document Root: " . $_SERVER['DOCUMENT_ROOT'] . "\n";
echo "</pre>";

echo "<h2>Check specific files:</h2>";
echo "<pre>";
$check_files = ['config.php', 'index.php', 'api.php', 'vendor/autoload.php'];
foreach($check_files as $file) {
    echo "$file: " . (file_exists($file) ? "EXISTS" : "MISSING") . "\n";
}
echo "</pre>";

if(file_exists('deploy.zip')) {
    echo "<h2>Deploy.zip found - checking contents:</h2>";
    echo "<pre>";
    $zip = new ZipArchive;
    if ($zip->open('deploy.zip') === TRUE) {
        for($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            if(strpos($filename, '/') === false) { // Only show root level files
                echo $filename . "\n";
            }
        }
        $zip->close();
    } else {
        echo "Failed to open deploy.zip\n";
    }
    echo "</pre>";
}
?>