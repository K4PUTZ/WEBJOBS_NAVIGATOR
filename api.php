<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

// Google API namespace imports
use Google\Service\Drive as Google_Service_Drive;
use Google\Service\Drive\DriveFile as Google_Service_Drive_DriveFile;
use Google\Service\Drive\FileList as Google_Service_Drive_FileList;

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function json_response($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Get authenticated Google Drive service instance
 * @return Google_Service_Drive|null Drive service or null if unavailable
 * @suppress PhanUndeclaredClassMethod
 */
function get_drive_service() {
    // Check if Google API client is available
    if (!class_exists('Google_Client') || !class_exists('Google_Service_Drive')) {
        return null;
    }
    
    $client = make_client();
    if (!$client) return null;
    
    $token = load_token();
    if (!$token) return null;
    
    try {
        $client->setAccessToken($token);
        if ($client->isAccessTokenExpired()) {
            if ($client->getRefreshToken()) {
                $token = $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                save_token($token);
            } else {
                return null;
            }
        }
        // @phpstan-ignore-next-line
        return new Google_Service_Drive($client);
    } catch (Exception $e) {
        error_log("Drive service error: " . $e->getMessage());
        return null;
    }
}

// Shared drive mapping (from Python reference_data.py)
function get_shared_drive_id(string $sku): ?string {
    if (empty($sku)) return null;
    
    $first_char = strtoupper($sku[0]);
    $mappings = [
        '0123456789' => '0AJmknNqOWBvjUk9PVA',
        'ABCDEF' => '0ALFcGfxuw7zqUk9PVA', 
        'GHIJKLMN' => '0AMvwxfXxfIqkUk9PVA',
        'OPQRS' => '0AGrHdqem4gtCUk9PVA',
        'TUVWXYZ' => '0ABuvdtBlCWzGUk9PVA'
    ];
    
    foreach ($mappings as $chars => $drive_id) {
        if (strpos($chars, $first_char) !== false) {
            return $drive_id;
        }
    }
    return null;
}

// API endpoint routing
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'detect_sku':
        $text = $_POST['text'] ?? '';
        if (empty($text)) {
            json_response(['error' => 'No text provided'], 400);
        }
        
        // SKU patterns from Python utils/sku.py
        $patterns = [
            '/[A-Z0-9_]+_SOFA_\d{8}_\d{4}/',
            '/[A-Z0-9]+_\d{4}_TT\d{7,8}_M/',
            '/[A-Z0-9_]+_\d{4}_TT\d{7,8}_S\d{3}_E\d{3}/'
        ];
        
        $matches = [];
        foreach ($patterns as $pattern) {
            if (preg_match_all($pattern, $text, $pattern_matches, PREG_OFFSET_CAPTURE)) {
                foreach ($pattern_matches[0] as $match) {
                    $matches[] = [
                        'sku' => $match[0],
                        'start' => $match[1],
                        'end' => $match[1] + strlen($match[0]),
                        'context' => substr($text, max($match[1] - 16, 0), 32)
                    ];
                }
            }
        }
        
        json_response([
            'matches' => $matches,
            'first' => $matches[0] ?? null
        ]);
        break;
        
    case 'resolve_path':
        if (!is_connected()) {
            json_response(['error' => 'Not authenticated'], 401);
        }
        
        // Check if Google API client is available
        if (!class_exists('Google_Service_Drive')) {
            json_response(['error' => 'Google API client not installed. Run: composer install'], 503);
        }
        
        $sku = $_POST['sku'] ?? '';
        $path = $_POST['path'] ?? '';
        
        if (empty($sku)) {
            json_response(['error' => 'SKU required'], 400);
        }
        
        $drive = get_drive_service();
        if (!$drive) {
            json_response(['error' => 'Drive service unavailable'], 503);
        }
        
        try {
            $shared_drive_id = get_shared_drive_id($sku);
            if (!$shared_drive_id) {
                json_response(['error' => 'No shared drive mapping for SKU'], 404);
            }
            
            // Find SKU root folder
            $query = "name = '{$sku}' and mimeType = 'application/vnd.google-apps.folder' and '{$shared_drive_id}' in parents";
            $results = $drive->files->listFiles([
                'q' => $query,
                'corpora' => 'drive',
                'driveId' => $shared_drive_id,
                'includeItemsFromAllDrives' => true,
                'supportsAllDrives' => true,
                'fields' => 'files(id,name)'
            ]);
            
            $files = $results->getFiles();
            if (empty($files)) {
                json_response(['error' => "SKU root folder '{$sku}' not found"], 404);
            }
            
            $folder_id = $files[0]->getId();
            
            // If path specified, traverse it
            if (!empty($path)) {
                $segments = array_filter(explode('/', $path));
                $current_id = $folder_id;
                
                foreach ($segments as $segment) {
                    $query = "name = '{$segment}' and mimeType = 'application/vnd.google-apps.folder' and '{$current_id}' in parents";
                    $results = $drive->files->listFiles([
                        'q' => $query,
                        'corpora' => 'drive', 
                        'driveId' => $shared_drive_id,
                        'includeItemsFromAllDrives' => true,
                        'supportsAllDrives' => true,
                        'fields' => 'files(id,name)'
                    ]);
                    
                    $files = $results->getFiles();
                    if (empty($files)) {
                        json_response(['error' => "Path segment '{$segment}' not found"], 404);
                    }
                    
                    $current_id = $files[0]->getId();
                }
                $folder_id = $current_id;
            }
            
            json_response([
                'sku' => $sku,
                'path' => $path,
                'folder_id' => $folder_id,
                'shared_drive_id' => $shared_drive_id,
                'drive_url' => "https://drive.google.com/drive/folders/{$folder_id}"
            ]);
            
        } catch (Exception $e) {
            error_log("Drive API error: " . $e->getMessage());
            json_response(['error' => 'Drive API error: ' . $e->getMessage()], 500);
        }
        break;
        
    case 'status':
        json_response([
            'connected' => is_connected(),
            'email' => get_account_email(),
            'timestamp' => date('c')
        ]);
        break;
        
    default:
        json_response(['error' => 'Unknown action'], 400);
}