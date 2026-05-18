<?php

class ENDTrack_AI
{
    private static function log($message)
    {
        $log_file = dirname(dirname(__FILE__)) . '/endtrack_debug.log';
        $timestamp = date('Y-m-d H:i:s');
        @file_put_contents($log_file, "[$timestamp] $message\n", FILE_APPEND);
    }

    /**
     * Generate AI copy for a specific page
     * 
     * @param int $post_id WordPress post ID
     * @param string $page_type Type of page: 'ventas', 'registro', 'gracias', 'gracias_registro', 'general'
     * @param string $user_prompt User's instructions for the AI
     * @return array|WP_Error Success message or error
     */
    public static function generate_copy_for_page($post_id, $page_type, $user_prompt)
    {
        self::log("--- START AI GENERATION (Claude) ---");
        self::log("Post ID: $post_id, Page Type: $page_type");
        self::log("User Prompt: $user_prompt");

        // Get Anthropic API key and model
        $texts = get_option('endtrack_texts', array());
        $api_key = isset($texts['anthropic_key']) ? $texts['anthropic_key'] : '';

        if (empty($api_key)) {
            self::log("Error: Missing Anthropic API Key");
            return new WP_Error('missing_api_key', 'No se ha configurado la API Key de Claude (Anthropic).');
        }

        // Get FULL Elementor JSON for smart editing
        $elementor_data = get_post_meta($post_id, '_elementor_data', true);
        $full_json = !empty($elementor_data) ? json_decode($elementor_data, true) : array();

        // Extract readable text map for context
        $current_texts = self::extract_elementor_text($post_id);
        $page_settings = get_post_meta($post_id, '_elementor_page_settings', true);

        // Build a concise widget map
        $widget_map = array();
        foreach ($current_texts as $item) {
            $widget_map[] = array(
                'id' => $item['id'],
                'type' => $item['type'],
                'parent_block' => $item['bloque_padre'],
                'label' => $item['nombre_elemento'],
                'current_content' => mb_substr($item['content'], 0, 200)
            );
        }

        $context_json = json_encode(array(
            'widget_map' => $widget_map,
            'page_settings' => is_array($page_settings) ? $page_settings : array(),
            'total_sections' => count($full_json),
            'full_elementor_json' => $full_json
        ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        $is_empty_page = empty($full_json);
        $system_prompt = self::get_system_prompt($page_type, $is_empty_page);

        if ($is_empty_page) {
            $user_message = "INSTRUCCIÓN DEL USUARIO:\n" . $user_prompt . "\n\n---\n\nLa página está VACÍA. Genera la estructura completa usando MODO 2 (full_elementor_json).";
        }
        else {
            $user_message = "INSTRUCCIÓN DEL USUARIO:\n" . $user_prompt . "\n\n---\n\nCONTEXTO COMPLETO DE LA PÁGINA (Elementor JSON + widget map):\n" . $context_json;
        }

        // Call Claude API — migrate old model IDs to current ones
        $claude_model = !empty($texts['claude_model']) ? $texts['claude_model'] : 'claude-sonnet-4-6';
        $model_migration = array(
            'claude-sonnet-4-5-20250514' => 'claude-sonnet-4-6',
            'claude-sonnet-4-20250514' => 'claude-sonnet-4-6',
        );
        if (isset($model_migration[$claude_model])) {
            $claude_model = $model_migration[$claude_model];
            $texts['claude_model'] = $claude_model;
            update_option('endtrack_texts', $texts);
            self::log("Migrated obsolete model to: $claude_model");
        }
        $ai_response = self::call_claude_api($api_key, $system_prompt, $user_message, $claude_model);

        if (is_wp_error($ai_response)) {
            self::log("API Error: " . $ai_response->get_error_message());
            return $ai_response;
        }

        // Update Elementor content with AI-generated data
        $update_result = self::update_elementor_text($post_id, $ai_response);

        if (is_wp_error($update_result)) {
            self::log("Update Error: " . $update_result->get_error_message());
            return $update_result;
        }

        self::log("--- SUCCESS ---");
        return array('success' => true, 'message' => 'Cambios aplicados correctamente por Claude.');
    }

    public static function extract_elementor_text($post_id)
    {
        $elementor_data = get_post_meta($post_id, '_elementor_data', true);
        if (empty($elementor_data))
            return array();
        $data = json_decode($elementor_data, true);
        if (!is_array($data))
            return array();
        $texts = array();
        self::recursive_extract_text($data, $texts);
        return $texts;
    }

    public static function update_elementor_text($post_id, $new_content)
    {
        $elementor_data = get_post_meta($post_id, '_elementor_data', true);
        $data = !empty($elementor_data) ? json_decode($elementor_data, true) : array();

        if (isset($new_content['full_elementor_json']) && is_array($new_content['full_elementor_json'])) {
            $updated_data = $new_content['full_elementor_json'];
            self::log("Full JSON replacement mode. Sections: " . count($updated_data));
            $validation_error = self::validate_elementor_data_verbose($updated_data);
            if ($validation_error !== true) {
                self::log("Validation failed (full JSON): $validation_error");
                return new WP_Error('invalid_structure', "La estructura JSON completa generada por Claude es inválida: $validation_error");
            }
            update_post_meta($post_id, '_elementor_data', wp_slash(wp_json_encode($updated_data)));
        }
        else {
            // If page is empty and Claude didn't use full_elementor_json, try to interpret the response
            if (empty($data) && !isset($new_content['texts']) && !isset($new_content['append_blocks'])) {
                self::log("Warning: Page is empty but Claude didn't use full_elementor_json mode. Keys received: " . implode(', ', array_keys($new_content)));
                return new WP_Error('wrong_mode', 'La página está vacía pero Claude no generó la estructura completa (full_elementor_json). Intenta de nuevo.');
            }

            $update_count = 0;
            $updated_data = self::recursive_update_text($data, $new_content, $update_count);

            if (isset($new_content['append_blocks']) && is_array($new_content['append_blocks'])) {
                foreach ($new_content['append_blocks'] as $new_block) {
                    if (is_array($new_block) && isset($new_block['elType']) && in_array($new_block['elType'], array('container', 'section', 'widget'))) {
                        $updated_data[] = $new_block;
                        $update_count++;
                    }
                }
            }

            if (isset($new_content['insert_blocks']) && is_array($new_content['insert_blocks'])) {
                foreach ($new_content['insert_blocks'] as $insert) {
                    if (isset($insert['after_index']) && isset($insert['block']) && is_array($insert['block'])) {
                        array_splice($updated_data, intval($insert['after_index']) + 1, 0, array($insert['block']));
                        $update_count++;
                    }
                }
            }

            if (isset($new_content['delete_blocks']) && is_array($new_content['delete_blocks'])) {
                $updated_data = self::recursive_delete_by_label($updated_data, $new_content['delete_blocks']);
            }

            if (empty($updated_data)) {
                self::log("Validation failed: updated_data is empty after surgical update.");
                return new WP_Error('invalid_structure', 'La estructura generada por Claude es inválida (resultado vacío).');
            }

            $validation_error = self::validate_elementor_data_verbose($updated_data);
            if ($validation_error !== true) {
                self::log("Validation failed (surgical): $validation_error");
                return new WP_Error('invalid_structure', "La estructura generada por Claude es inválida: $validation_error");
            }

            update_post_meta($post_id, '_elementor_data', wp_slash(wp_json_encode($updated_data)));
            self::log("Surgical update: $update_count changes.");
        }

        $current_settings = get_post_meta($post_id, '_elementor_page_settings', true);
        if (!is_array($current_settings))
            $current_settings = array();

        if (isset($new_content['page_settings']) && is_array($new_content['page_settings'])) {
            $current_settings = array_merge($current_settings, $new_content['page_settings']);
        }
        if (isset($new_content['custom_css'])) {
            $current_settings['custom_css'] = $new_content['custom_css'];
        }

        update_post_meta($post_id, '_elementor_page_settings', $current_settings);

        if (class_exists('\\Elementor\\Plugin')) {
            \Elementor\Plugin::$instance->files_manager->clear_cache();
            delete_post_meta($post_id, '_elementor_css');
        }

        return true;
    }

    private static function call_claude_api($api_key, $system_prompt, $user_message, $model = 'claude-sonnet-4-6')
    {
        $response = wp_remote_post('https://api.anthropic.com/v1/messages', array(
            'headers' => array(
                'x-api-key' => $api_key,
                'anthropic-version' => '2023-06-01',
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode(array(
                'model' => $model,
                'max_tokens' => 16384,
                'system' => $system_prompt,
                'messages' => array(
                        array('role' => 'user', 'content' => $user_message)
                )
            )),
            'timeout' => 180
        ));

        if (is_wp_error($response)) {
            return new WP_Error('api_error', 'Error al conectar con Claude: ' . $response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $result = json_decode($body, true);

        if ($code !== 200) {
            $error_msg = isset($result['error']['message']) ? $result['error']['message'] : 'Error desconocido';
            $error_type = isset($result['error']['type']) ? $result['error']['type'] : 'unknown';
            return new WP_Error('claude_error', "Error de Claude ($code - $error_type): $error_msg");
        }

        if (!isset($result['content'][0]['text'])) {
            return new WP_Error('invalid_response', 'Respuesta inválida de Claude.');
        }

        $ai_content = $result['content'][0]['text'];
        $stop_reason = isset($result['stop_reason']) ? $result['stop_reason'] : 'unknown';
        self::log("Raw Claude Response length: " . strlen($ai_content) . " | stop_reason: $stop_reason");

        // Step 1: Try to extract JSON from markdown code blocks (with or without closing ```)
        $clean_content = $ai_content;
        if (preg_match('/```(?:json)?\s*(.*?)\s*```/s', $ai_content, $matches)) {
            $clean_content = $matches[1];
        }
        elseif (preg_match('/```(?:json)?\s*(.*)/s', $ai_content, $matches)) {
            // Truncated response: no closing ```, extract everything after opening ```
            $clean_content = $matches[1];
            self::log("Warning: Response appears truncated (no closing ```). Attempting repair.");
        }

        // Step 2: Try to parse as JSON
        $parsed_content = json_decode($clean_content, true);
        if (is_array($parsed_content)) {
            self::log("Parsed Claude response: " . count($parsed_content) . " keys.");
            return $parsed_content;
        }

        // Step 3: If JSON is invalid (likely truncated), try to repair it
        $repaired = self::repair_truncated_json($clean_content);
        if ($repaired !== null) {
            self::log("Repaired truncated JSON successfully: " . count($repaired) . " keys.");
            return $repaired;
        }

        self::log("Error: Could not parse or repair JSON. Raw: " . mb_substr($ai_content, 0, 500));
        return new WP_Error('invalid_json', 'Claude generó una respuesta que no se pudo interpretar como JSON válido. Intenta de nuevo o simplifica la instrucción.');
    }

    /**
     * Attempt to repair truncated JSON by closing open brackets/braces
     */
    private static function repair_truncated_json($json_str)
    {
        // Remove any trailing incomplete string (cut mid-value)
        $json_str = preg_replace('/,\s*"[^"]*$/', '', $json_str);
        $json_str = preg_replace('/,\s*$/', '', $json_str);

        // Count open/close brackets and braces
        $open_braces = substr_count($json_str, '{');
        $close_braces = substr_count($json_str, '}');
        $open_brackets = substr_count($json_str, '[');
        $close_brackets = substr_count($json_str, ']');

        // Close unclosed structures
        $json_str .= str_repeat('}', max(0, $open_braces - $close_braces));
        $json_str .= str_repeat(']', max(0, $open_brackets - $close_brackets));

        // Try multiple repair strategies
        $attempts = array($json_str);

        // Also try removing the last potentially incomplete element
        $trimmed = preg_replace('/,\s*\{[^{}]*$/', '', $json_str);
        if ($trimmed !== $json_str) {
            $open_b = substr_count($trimmed, '{');
            $close_b = substr_count($trimmed, '}');
            $open_br = substr_count($trimmed, '[');
            $close_br = substr_count($trimmed, ']');
            $trimmed .= str_repeat('}', max(0, $open_b - $close_b));
            $trimmed .= str_repeat(']', max(0, $open_br - $close_br));
            $attempts[] = $trimmed;
        }

        foreach ($attempts as $attempt) {
            $parsed = json_decode($attempt, true);
            if (is_array($parsed)) {
                return $parsed;
            }
        }

        return null;
    }

    private static function get_system_prompt($page_type, $is_empty_page = false)
    {
        $base = 'Eres un experto en diseño web con Elementor y copywriting de alto nivel. Generas páginas profesionales y visualmente atractivas.

RESPUESTA: Devuelve SOLO JSON puro. Sin texto extra, sin markdown, sin ```.

MODOS DE OPERACIÓN:
MODO 1 — Cambios quirúrgicos: {"texts":[{"id":"ID","content":"texto"}],"custom_css":"...","page_settings":{...}}
MODO 2 — Estructura completa (OBLIGATORIO si página vacía): {"full_elementor_json":[...]}
MODO 3 — Añadir: {"append_blocks":[...]}
MODO 4 — Insertar: {"insert_blocks":[{"after_index":N,"block":{...}}]}
MODO 5 — Eliminar: {"delete_blocks":["label"]}

ESTRUCTURA ELEMENTOR MODERNA (Containers Flexbox — NO uses section/column que son obsoletos):
=====================
Usa SOLO elType:"container". NUNCA uses elType:"section" ni elType:"column".

Container full-width (fila):
{"id":"end_xxx","elType":"container","settings":{"content_width":"full","flex_direction":"column","padding":{"top":"60","bottom":"60","left":"30","right":"30","unit":"px"},"background_background":"classic","background_color":"#0F172A"},"elements":[widgets o containers hijos]}

Container hijo (para columnas lado a lado):
{"id":"end_xxx","elType":"container","settings":{"content_width":"full","flex_direction":"row","flex_gap":{"size":30,"unit":"px"}},"elements":[container_col_1, container_col_2]}

Container columna individual dentro de row:
{"id":"end_xxx","elType":"container","settings":{"flex_direction":"column","width":{"size":50,"unit":"%"}},"elements":[widgets]}

Widget heading:
{"id":"end_xxx","elType":"widget","widgetType":"heading","settings":{"title":"Texto","header_size":"h2","title_color":"#FFFFFF","typography_typography":"custom","typography_font_size":{"size":42,"unit":"px"},"typography_font_weight":"700"}}

Widget text-editor:
{"id":"end_xxx","elType":"widget","widgetType":"text-editor","settings":{"editor":"<p>HTML aquí</p>","text_color":"#CBD5E1","typography_typography":"custom","typography_font_size":{"size":18,"unit":"px"}}}

Widget button:
{"id":"end_xxx","elType":"widget","widgetType":"button","settings":{"text":"TEXTO BOTÓN","button_type":"","background_color":"#6366F1","button_text_color":"#FFFFFF","border_radius":{"top":"12","right":"12","bottom":"12","left":"12","unit":"px"},"typography_typography":"custom","typography_font_size":{"size":18,"unit":"px"},"typography_font_weight":"700","button_css_id":"add_suscrito"}}

Widget spacer:
{"id":"end_xxx","elType":"widget","widgetType":"spacer","settings":{"space":{"size":30,"unit":"px"}}}

REGLAS DE DISEÑO (MUY IMPORTANTE):
1. CONTRASTE: Fondo oscuro (#0F172A, #1E293B) = texto claro (#FFFFFF, #F1F5F9, #CBD5E1). Fondo claro (#F8FAFC, #FFFFFF) = texto oscuro (#0F172A, #1E293B, #334155).
2. NUNCA texto blanco sobre fondo blanco. NUNCA texto oscuro sobre fondo oscuro.
3. Alterna secciones oscuras y claras para dar ritmo visual.
4. Tipografía: títulos grandes (36-48px, font-weight 700-800), subtítulos (20-24px, 600), cuerpo (16-18px, 400).
5. Botones con color de acento vibrante (#6366F1 indigo, #EF4444 rojo, #10B981 verde) y texto blanco, con border-radius.
6. Padding generoso en containers: mínimo 60px arriba/abajo, 30px laterales.
7. Espaciado entre elementos usando spacers o flex_gap.
8. Usa 5-7 containers principales máximo para no exceder el límite de respuesta.

REGLAS TÉCNICAS:
1. Cada elemento DEBE tener: "id" (string único "end_" + 7 chars), "elType" ("container"|"widget"), "elements" (array, vacío [] para widgets).
2. Widgets DEBEN tener "widgetType".
3. NO uses elType "section" ni "column" — están deprecados.
4. Si la página está vacía, SIEMPRE usa MODO 2.
5. Si no entiendes: {"error":"descripción"}.';

        if ($is_empty_page) {
            $base .= '

PÁGINA VACÍA — Usa MODO 2. Genera landing profesional con esta estructura tipo:
{"full_elementor_json":[
  {container HERO: fondo oscuro degradado, heading grande + subtítulo + botón CTA},
  {container BENEFICIOS: fondo claro, 3 columnas con icon-box o heading+texto},
  {container SOCIAL PROOF: fondo oscuro, testimonios o datos},
  {container DETALLES: fondo claro, qué incluye o cómo funciona},
  {container CTA FINAL: fondo con color de acento, heading urgencia + botón}
]}
Máximo 6 containers principales. Prioriza que el JSON esté COMPLETO.';
        }

        $contexts = array(
            'ventas' => '

CONTEXTO: Página de VENTAS.
- Hero impactante con propuesta de valor clara y precio
- Sección de beneficios (qué consigue el alumno)
- Prueba social o credibilidad del instructor
- Detalles del contenido/módulos
- CTA final con urgencia
- Tono: persuasivo, profesional, con urgencia sutil
- El botón de compra debe tener button_css_id:"add_suscrito"',

            'registro' => '

CONTEXTO: Página de REGISTRO (captación de leads).
- Hero directo: qué es y por qué registrarse
- 3 beneficios clave de registrarse
- CTA con formulario o botón de registro
- Tono: directo, valor gratuito, FOMO
- Máximo 4 containers (es una página corta)
- El botón de registro debe tener button_css_id:"add_suscrito"',

            'gracias' => '

CONTEXTO: Página GRACIAS POR COMPRAR.
- Mensaje de felicitación entusiasta
- Próximos pasos claros (qué hacer ahora)
- Datos de acceso o instrucciones
- Tono: entusiasta, tranquilizador
- Máximo 3 containers (página corta y simple)',

            'gracias_registro' => '

CONTEXTO: Página GRACIAS POR REGISTRARTE.
- Confirmación del registro
- Qué esperar (cuándo empieza, dónde revisar email)
- Tono: acogedor, expectativa
- Máximo 3 containers (página corta)',

            'general' => '

CONTEXTO: Página genérica. Adapta el diseño según el contenido existente y la instrucción del usuario.'
        );

        return $base . (isset($contexts[$page_type]) ? $contexts[$page_type] : $contexts['general']);
    }

    public static function extract_elementor_structure($post_id)
    {
        $elementor_data = get_post_meta($post_id, '_elementor_data', true);
        if (empty($elementor_data))
            return array();
        $data = json_decode($elementor_data, true);
        if (!is_array($data))
            return array();
        $structure = array();
        self::recursive_extract_structure($data, $structure);
        return $structure;
    }

    private static function recursive_extract_structure($elements, &$structure)
    {
        if (!is_array($elements))
            return;
        foreach ($elements as $element) {
            $label = isset($element['settings']['_admin_label']) ? $element['settings']['_admin_label'] : '';
            if (!empty($label))
                $structure[$label] = $element;
            if (isset($element['elements']))
                self::recursive_extract_structure($element['elements'], $structure);
        }
    }

    private static function recursive_extract_text($elements, &$texts, $parent_label = '')
    {
        if (!is_array($elements))
            return;
        foreach ($elements as $element) {
            if (!is_array($element))
                continue;
            $my_label = isset($element['settings']['_admin_label']) ? $element['settings']['_admin_label'] : '';
            if (isset($element['widgetType'])) {
                $widget_id = isset($element['id']) ? $element['id'] : uniqid();
                $s = $element['settings'];
                $w_type = $element['widgetType'];
                $base_item = array('id' => $widget_id, 'type' => $w_type, 'bloque_padre' => $parent_label, 'nombre_elemento' => $my_label);

                switch ($w_type) {
                    case 'heading':
                        if (isset($s['title']))
                            $texts[] = array_merge($base_item, array('content' => $s['title']));
                        break;
                    case 'text-editor':
                        if (isset($s['editor']))
                            $texts[] = array_merge($base_item, array('content' => $s['editor']));
                        break;
                    case 'button':
                        if (isset($s['text']))
                            $texts[] = array_merge($base_item, array('content' => $s['text']));
                        break;
                    case 'icon-box':
                    case 'image-box':
                        if (isset($s['title_text']))
                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|title_text', 'content' => $s['title_text']));
                        if (isset($s['description_text']))
                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|description_text', 'content' => $s['description_text']));
                        break;
                    case 'testimonial':
                        if (isset($s['testimonial_content']))
                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|testimonial_content', 'content' => $s['testimonial_content']));
                        if (isset($s['testimonial_name']))
                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|testimonial_name', 'content' => $s['testimonial_name']));
                        break;
                    case 'accordion':
                    case 'toggle':
                        foreach (array('tabs', 'accordion', 'items') as $rk) {
                            if (isset($s[$rk]) && is_array($s[$rk])) {
                                foreach ($s[$rk] as $idx => $item) {
                                    foreach (array('tab_title', 'title', 'label') as $tk) {
                                        if (isset($item[$tk])) {
                                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|' . $rk . '|' . $idx . '|' . $tk, 'content' => $item[$tk]));
                                            break;
                                        }
                                    }
                                    foreach (array('tab_content', 'content', 'description') as $ck) {
                                        if (isset($item[$ck])) {
                                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|' . $rk . '|' . $idx . '|' . $ck, 'content' => $item[$ck]));
                                            break;
                                        }
                                    }
                                }
                                break;
                            }
                        }
                        break;
                    case 'icon-list':
                        if (isset($s['icon_list']) && is_array($s['icon_list'])) {
                            foreach ($s['icon_list'] as $idx => $item) {
                                if (isset($item['text']))
                                    $texts[] = array_merge($base_item, array('id' => $widget_id . '|icon_list|' . $idx . '|text', 'content' => $item['text']));
                            }
                        }
                        break;
                    case 'alert':
                        if (isset($s['alert_title']))
                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|alert_title', 'content' => $s['alert_title']));
                        if (isset($s['alert_description']))
                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|alert_description', 'content' => $s['alert_description']));
                        break;
                    case 'call-to-action':
                        if (isset($s['title']))
                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|title', 'content' => $s['title']));
                        if (isset($s['description']))
                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|description', 'content' => $s['description']));
                        if (isset($s['button_text']))
                            $texts[] = array_merge($base_item, array('id' => $widget_id . '|button_text', 'content' => $s['button_text']));
                        break;
                }
            }
            if (isset($element['elements'])) {
                self::recursive_extract_text($element['elements'], $texts, !empty($my_label) ? $my_label : $parent_label);
            }
        }
    }

    private static function recursive_update_text($elements, $new_content, &$update_count = 0)
    {
        if (!is_array($elements))
            return $elements;
        foreach ($elements as &$element) {
            if (!is_array($element))
                continue;
            $label = isset($element['settings']['_admin_label']) ? $element['settings']['_admin_label'] : '';
            if (!empty($label) && isset($new_content['blocks'][$label]) && is_array($new_content['blocks'][$label])) {
                $element = $new_content['blocks'][$label];
                $update_count++;
                continue;
            }
            if (isset($element['widgetType']) && isset($element['id']) && isset($new_content['texts']) && is_array($new_content['texts'])) {
                foreach ($new_content['texts'] as $text_item) {
                    $id_parts = explode('|', $text_item['id']);
                    if ($id_parts[0] !== $element['id'])
                        continue;
                    $update_count++;
                    if (count($id_parts) === 1) {
                        switch ($element['widgetType']) {
                            case 'heading':
                                $element['settings']['title'] = $text_item['content'];
                                break;
                            case 'text-editor':
                                $element['settings']['editor'] = $text_item['content'];
                                break;
                            case 'button':
                                $element['settings']['text'] = $text_item['content'];
                                break;
                        }
                    }
                    elseif (count($id_parts) === 2) {
                        $element['settings'][$id_parts[1]] = $text_item['content'];
                    }
                    elseif (count($id_parts) === 4) {
                        if (isset($element['settings'][$id_parts[1]][(int)$id_parts[2]])) {
                            $element['settings'][$id_parts[1]][(int)$id_parts[2]][$id_parts[3]] = $text_item['content'];
                        }
                    }
                }
            }
            if (isset($element['elements'])) {
                $element['elements'] = self::recursive_update_text($element['elements'], $new_content, $update_count);
            }
        }
        return $elements;
    }

    private static function recursive_delete_by_label($elements, $labels)
    {
        if (!is_array($elements))
            return $elements;
        $filtered = array();
        foreach ($elements as $el) {
            $label = isset($el['settings']['_admin_label']) ? $el['settings']['_admin_label'] : '';
            if (!empty($label) && in_array($label, $labels))
                continue;
            if (isset($el['elements']))
                $el['elements'] = self::recursive_delete_by_label($el['elements'], $labels);
            $filtered[] = $el;
        }
        return $filtered;
    }

    /**
     * Verbose validation: returns true on success, or error string on failure
     */
    private static function validate_elementor_data_verbose($data)
    {
        if (!is_array($data))
            return 'Los datos no son un array';
        if (empty($data))
            return 'El array de secciones está vacío';
        foreach ($data as $idx => $el) {
            $error = self::recursive_validate_element_verbose($el, "sección[$idx]");
            if ($error !== true)
                return $error;
        }
        return true;
    }

    private static function recursive_validate_element_verbose($el, $path = '')
    {
        if (!is_array($el))
            return "Elemento en $path no es un array";
        if (empty($el['elType']))
            return "Elemento en $path no tiene 'elType' (keys: " . implode(',', array_keys($el)) . ")";
        $valid_types = array('container', 'widget', 'section', 'column');
        if (!in_array($el['elType'], $valid_types))
            return "Elemento en $path tiene elType inválido: '{$el['elType']}'";
        if ($el['elType'] === 'widget' && empty($el['widgetType']))
            return "Widget en $path no tiene 'widgetType'";
        if (isset($el['elements']) && is_array($el['elements'])) {
            foreach ($el['elements'] as $idx => $sub) {
                $error = self::recursive_validate_element_verbose($sub, "$path > {$el['elType']}[$idx]");
                if ($error !== true)
                    return $error;
            }
        }
        return true;
    }
}