<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/user_data.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

function json_response($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!is_connected()) {
    json_response(['error' => 'Not authenticated'], 401);
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = get_user_id();

if (!$userId) {
    json_response(['error' => 'User ID not available'], 400);
}

switch ($action) {
    case 'get_user_data':
        $data = load_user_data($userId);
        json_response([
            'user' => get_user_info(),
            'favorites' => $data['favorites'] ?? [],
            'recent_skus' => $data['recent_skus'] ?? [],
            'settings' => $data['settings'] ?? []
        ]);
        break;
        
    case 'save_favorites':
        $favorites = json_decode($_POST['favorites'] ?? '[]', true);
        if (!is_array($favorites)) {
            json_response(['error' => 'Invalid favorites data'], 400);
        }
        
        $success = save_user_favorites($userId, $favorites);
        json_response(['success' => $success]);
        break;
        
    case 'add_recent_sku':
        $sku = $_POST['sku'] ?? '';
        if (!$sku) {
            json_response(['error' => 'SKU required'], 400);
        }
        
        $data = load_user_data($userId);
        $recentSkus = $data['recent_skus'] ?? [];
        
        // Remove if already exists
        $recentSkus = array_filter($recentSkus, fn($s) => $s !== $sku);
        
        // Add to beginning
        array_unshift($recentSkus, $sku);
        
        // Limit to 20
        $recentSkus = array_slice($recentSkus, 0, 20);
        
        $success = save_user_recent_skus($userId, $recentSkus);
        json_response(['success' => $success, 'recent_skus' => $recentSkus]);
        break;
        
    case 'clear_recent_skus':
        $success = save_user_recent_skus($userId, []);
        json_response(['success' => $success]);
        break;
        
    default:
        json_response(['error' => 'Invalid action'], 400);
}
?>