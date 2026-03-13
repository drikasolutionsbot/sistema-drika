UPDATE welcome_configs
SET content = '{user}'
WHERE content IS NULL OR content = '';