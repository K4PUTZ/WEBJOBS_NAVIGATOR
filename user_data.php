<?php
// User data management functions
// Stores user preferences and data in JSON files

function get_user_id() {
    $email = get_account_email();
    return $email ? md5($email) : null;
}

function get_user_data_file($userId) {
    $dataDir = __DIR__ . '/user_data';
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }
    return $dataDir . '/user_' . $userId . '.json';
}

function load_user_data($userId) {
    if (!$userId) return [];
    
    $file = get_user_data_file($userId);
    if (!file_exists($file)) {
      return [
          'favorites' => [
                ['label' => 'Root Folder', 'path' => ''],
                ['label' => 'Trailer / Video IN', 'path' => '02-TRAILER/VIDEO IN'],
                ['label' => 'Artes', 'path' => 'EXPORT/03- ARTES'],
                ['label' => 'Marketing / Social', 'path' => 'EXPORT/03- ARTES/06- MARKETING/SOCIAL'],
                ['label' => 'Envio Direto', 'path' => 'EXPORT/03- ARTES/03- ENVIO DIRETO PLATAFORMA'],
                ['label' => 'Legendas', 'path' => 'EXPORT/02- LEGENDAS'],
                ['label' => 'Temp', 'path' => 'TEMP'],
                ['label' => 'Entrega', 'path' => 'EXPORT/04- ENTREGAS'],
            ],
            'recent_skus' => [],
          'settings' => [
              'theme' => 'dark',
              'console_font_size' => 11,
              'max_recent_skus' => 20,
              'sounds' => true,
              'auto_connect' => false,
              'auto_detect' => true,
              'auto_load_multiple' => false,
              'open_root_on_detect' => false,
              'show_welcome_on_startup' => false,
              'sku_suffix' => ''
          ]
      ];
    }
    
    $data = json_decode(file_get_contents($file), true);
    return $data ?: [];
}

function save_user_data($userId, $data) {
    if (!$userId) return false;
    
    $file = get_user_data_file($userId);
    $data['last_updated'] = date('Y-m-d H:i:s');
    
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT)) !== false;
}

function save_user_favorites($userId, $favorites) {
    $data = load_user_data($userId);
    $data['favorites'] = $favorites;
    return save_user_data($userId, $data);
}

function save_user_recent_skus($userId, $recentSkus) {
    $data = load_user_data($userId);
    $data['recent_skus'] = array_slice($recentSkus, 0, 20); // Limit to 20
    return save_user_data($userId, $data);
}

function save_user_settings($userId, $settings) {
    $data = load_user_data($userId);
    if (!is_array($data['settings'] ?? null)) {
        $data['settings'] = [];
    }
    // Whitelist expected keys
  $allowed = ['theme','console_font_size','max_recent_skus','sounds','auto_connect','auto_detect','auto_load_multiple','open_root_on_detect','show_welcome_on_startup','sku_suffix'];
    foreach ($settings as $k => $v) {
        if (in_array($k, $allowed, true)) {
            $data['settings'][$k] = $v;
        }
    }
    return save_user_data($userId, $data);
}

function get_user_favorites($userId) {
    $data = load_user_data($userId);
    return $data['favorites'] ?? [];
}

function get_user_recent_skus($userId) {
    $data = load_user_data($userId);
    return $data['recent_skus'] ?? [];
}

function get_user_info() {
    if (!is_connected()) return null;
    
    return [
        'id' => get_user_id(),
        'email' => get_account_email(),
        'connected' => true
    ];
}
?>
