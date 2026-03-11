CREATE TABLE IF NOT EXISTS masks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  modelId INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'polygon',
  operation VARCHAR(20) NOT NULL DEFAULT 'add',
  z_index INT NOT NULL DEFAULT 0,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  locked TINYINT(1) NOT NULL DEFAULT 0,
  layer_name VARCHAR(100) NOT NULL DEFAULT 'default',
  texture_type VARCHAR(20) NOT NULL DEFAULT 'color',
  texture_value VARCHAR(255) NOT NULL DEFAULT '#ffffff',
  opacity DOUBLE NOT NULL DEFAULT 1,
  points_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_masks_modelId_created ON masks (modelId, created_at);
CREATE INDEX idx_masks_modelId_zindex ON masks (modelId, z_index);
CREATE INDEX idx_masks_modelId_layername ON masks (modelId, layer_name);