<?php
/**
 * The single markup path for both the block and the shortcode: normalize options, enqueue the
 * assets, and emit the container the front-end init script mounts a flipbook onto.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Render a flipbook container from a normalized options array.
 *
 * @param array $opts {
 *   @type string   pdf        PDF URL (takes precedence over images).
 *   @type string[] images     Image URLs (used when no pdf).
 *   @type string   spreadMode 'cover' | 'double' | 'single' | 'book'.
 *   @type bool     controls   Whether the toolbar shows.
 *   @type string   direction  'ltr' | 'rtl'.
 *   @type string   fit        'contain' | 'fill'.
 *   @type string   maxWidth   Max width in px (numeric string).
 *   @type string   aspect     CSS aspect-ratio, e.g. '3/2', or 'auto'.
 * }
 * @return string HTML, or an editor-only notice when nothing is configured.
 */
function zinejs_render_container($opts) {
    $pdf    = isset($opts['pdf']) ? trim((string) $opts['pdf']) : '';
    $images = isset($opts['images']) && is_array($opts['images']) ? $opts['images'] : array();

    if ($pdf === '' && empty($images)) {
        // Nothing to show. Stay silent on the front end; the block editor shows its own placeholder.
        return '';
    }

    zinejs_enqueue();

    // Options handed to `new ZineJS.Zine(el, { ... })` by the init script.
    $zine = array(
        'spreadMode' => in_array($opts['spreadMode'], array('cover', 'double', 'single', 'book'), true)
            ? $opts['spreadMode'] : 'cover',
        'direction' => ($opts['direction'] === 'rtl') ? 'rtl' : 'ltr',
        'fit'       => ($opts['fit'] === 'fill') ? 'fill' : 'contain',
        // Whether a container narrower than singlePageThreshold may drop to one page. Off holds the
        // chosen spread mode at every width (so 'cover'/'double' keep two-page spreads in a narrow
        // theme column). See https://zinejs.com/docs/.
        'responsiveSpread' => array_key_exists('responsiveSpread', $opts)
            ? (bool) $opts['responsiveSpread'] : true,
    );
    // Default the collapse-to-one-page breakpoint below a typical WordPress content column (often
    // ~620px), so 'cover'/'double' keep two-page spreads in a normal column and collapse only on
    // genuinely narrow screens (phones). Core's own default is 640; a WP embed wants it lower.
    $raw = isset($opts['singlePageThreshold']) ? $opts['singlePageThreshold'] : '';
    $threshold = ($raw === '' || $raw === null) ? 500 : intval($raw);
    if ($threshold > 0) {
        $zine['singlePageThreshold'] = $threshold;
    }

    // Interaction. Only set values that differ from the engine defaults, to keep the payload lean.
    if (isset($opts['clickToFlip']) && in_array($opts['clickToFlip'], array('edge', 'half', 'off'), true)) {
        $zine['clickToFlip'] = $opts['clickToFlip'];
    }
    // cone/simple resolve by name in the engine; roll/leaf/flick/silk are loaded on demand and
    // swapped for their model objects by the init script (see init.js). Keep this list in sync with
    // the engine and the block dropdown (see README, "Updating curl styles").
    if (isset($opts['curl']) &&
        in_array($opts['curl'], array('cone', 'simple', 'roll', 'leaf', 'flick', 'silk'), true)) {
        $zine['curl'] = $opts['curl'];
    }
    $flip = isset($opts['flipDuration']) ? intval($opts['flipDuration']) : 0;
    if ($flip > 0) {
        $zine['flipDuration'] = $flip;
    }
    $start = isset($opts['startPage']) ? intval($opts['startPage']) : 0;
    if ($start > 0) {
        $zine['startPage'] = $start;
    }

    // Zoom (nested); defaults are on, so only an explicit change is sent.
    $zoom = array();
    if (array_key_exists('zoomEnabled', $opts) && !$opts['zoomEnabled']) {
        $zoom['enabled'] = false;
    }
    $zoom_max = isset($opts['zoomMax']) ? floatval($opts['zoomMax']) : 0;
    if ($zoom_max > 1) {
        $zoom['max'] = $zoom_max;
    }
    if (array_key_exists('zoomWheel', $opts) && !$opts['zoomWheel']) {
        $zoom['wheel'] = false;
    }
    if (array_key_exists('zoomDoubleClick', $opts) && !$opts['zoomDoubleClick']) {
        $zoom['doubleClick'] = false;
    }
    if (!empty($zoom)) {
        $zine['zoom'] = $zoom;
    }

    // Controls: false turns the whole toolbar off; otherwise send an options object only for the
    // sub-options that differ from the engine defaults (position bottom, arrows on, scheme auto).
    if (empty($opts['controls'])) {
        $zine['controls'] = false;
    } else {
        $co = array();
        $pos = isset($opts['controlsPosition']) ? $opts['controlsPosition'] : 'bottom';
        if (in_array($pos, array('top', 'bottom', 'left', 'right'), true) && $pos !== 'bottom') {
            $co['position'] = $pos;
        }
        if (array_key_exists('controlsArrows', $opts) && !$opts['controlsArrows']) {
            $co['arrows'] = false;
        }
        $scheme = isset($opts['controlsColorScheme']) ? $opts['controlsColorScheme'] : 'auto';
        if (in_array($scheme, array('light', 'dark', 'auto'), true) && $scheme !== 'auto') {
            $co['colorScheme'] = $scheme;
        }
        if (!empty($co)) {
            $zine['controls'] = $co;
        }
    }

    // Chrome. All default on, so only an explicit off is sent.
    if (array_key_exists('contextMenu', $opts) && !$opts['contextMenu']) {
        $zine['contextMenu'] = false;
    }
    if (array_key_exists('loading', $opts) && !$opts['loading']) {
        $zine['loading'] = false;
    }
    if (array_key_exists('hints', $opts) && !$opts['hints']) {
        $zine['hints'] = false;
    }
    if (array_key_exists('deepLink', $opts) && !$opts['deepLink']) {
        $zine['deepLink'] = false;
    }

    // Permission toggles map to hidden toolbar controls (the reader can still not do what is hidden).
    $hidden = array();
    if (array_key_exists('allowDownload', $opts) && !$opts['allowDownload']) {
        $hidden[] = 'download';
    }
    if (array_key_exists('allowPrint', $opts) && !$opts['allowPrint']) {
        $hidden[] = 'print';
    }
    if (array_key_exists('allowShare', $opts) && !$opts['allowShare']) {
        $hidden[] = 'share';
    }
    if (!empty($hidden)) {
        $zine['hideControls'] = $hidden;
    }

    // Page-flip sound (opt-in). true uses the bundled clip; an object overrides volume and mute
    // behavior. Enabling it makes the engine show a mute control in the toolbar automatically.
    if (!empty($opts['sound'])) {
        $snd = array();
        $vol = isset($opts['soundVolume']) && $opts['soundVolume'] !== '' ? floatval($opts['soundVolume']) : -1;
        if ($vol >= 0 && $vol <= 1) {
            $snd['volume'] = $vol;
        }
        if (!empty($opts['soundMuted'])) {
            $snd['muted'] = true;
        }
        if (!empty($opts['soundPersist'])) {
            $snd['persist'] = true;
        }
        $zine['sound'] = empty($snd) ? true : $snd;
    }

    // Covers: image URLs prepended/appended as lone pages.
    if (!empty($opts['frontCover'])) {
        $zine['frontCover'] = esc_url_raw((string) $opts['frontCover']);
    }
    if (!empty($opts['backCover'])) {
        $zine['backCover'] = esc_url_raw((string) $opts['backCover']);
    }

    $config = array('zine' => $zine);
    if ($pdf !== '') {
        $config['pdf'] = esc_url_raw($pdf);
    } else {
        $config['images'] = array_map('esc_url_raw', $images);
    }

    // Sizing lives in CSS. By default the book fills its container (the theme column, or the block's
    // wide/full alignment). An optional max width caps it; an optional aspect ratio reserves a shape
    // before the first page loads (the engine sets the real aspect-ratio from the book after paint).
    $style = '';
    $max_width = preg_replace('/[^0-9]/', '', (string) $opts['maxWidth']);
    if ($max_width !== '') {
        $style .= 'max-width:' . esc_attr($max_width) . 'px;';
    }
    $aspect = (string) $opts['aspect'];
    if ($aspect !== '' && $aspect !== 'auto') {
        $style .= 'aspect-ratio:' . esc_attr($aspect) . ';';
    }

    $json = wp_json_encode($config);

    return sprintf(
        '<div class="zine-flipbook" style="%s" data-zine="%s"></div>',
        esc_attr($style),
        esc_attr($json)
    );
}

/** Map the options shared by both blocks (everything except the source) from block attributes. */
function zinejs_shared_block_opts($attributes) {
    $a = function ($key, $default) use ($attributes) {
        return array_key_exists($key, $attributes) ? $attributes[$key] : $default;
    };
    return array(
        'frontCover'          => $a('frontCover', ''),
        'backCover'           => $a('backCover', ''),
        'deepLink'            => $a('deepLink', true),
        'allowDownload'       => $a('allowDownload', true),
        'allowPrint'          => $a('allowPrint', true),
        'allowShare'          => $a('allowShare', true),
        'spreadMode'          => $a('spreadMode', 'cover'),
        'controls'            => $a('controls', true),
        'controlsPosition'    => $a('controlsPosition', 'bottom'),
        'controlsArrows'      => $a('controlsArrows', true),
        'controlsColorScheme' => $a('controlsColorScheme', 'auto'),
        'direction'           => $a('direction', 'ltr'),
        'fit'                 => $a('fit', 'contain'),
        'responsiveSpread'    => $a('responsiveSpread', true),
        'singlePageThreshold' => $a('singlePageThreshold', ''),
        'maxWidth'            => $a('maxWidth', ''),
        'aspect'              => $a('aspect', 'auto'),
        'clickToFlip'         => $a('clickToFlip', 'edge'),
        'curl'                => $a('curl', 'cone'),
        'flipDuration'        => $a('flipDuration', ''),
        'startPage'           => $a('startPage', 0),
        'zoomEnabled'         => $a('zoomEnabled', true),
        'zoomMax'             => $a('zoomMax', ''),
        'zoomWheel'           => $a('zoomWheel', true),
        'zoomDoubleClick'     => $a('zoomDoubleClick', true),
        'contextMenu'         => $a('contextMenu', true),
        'loading'             => $a('loading', true),
        'hints'               => $a('hints', true),
        'sound'               => $a('sound', false),
        'soundVolume'         => $a('soundVolume', ''),
        'soundMuted'          => $a('soundMuted', false),
        'soundPersist'        => $a('soundPersist', false),
    );
}

/** Render callback for the PDF block. */
function zinejs_render_pdf_block($attributes) {
    $opts = zinejs_shared_block_opts($attributes);
    $opts['pdf'] = isset($attributes['url']) ? $attributes['url'] : '';
    $opts['images'] = array();
    return zinejs_render_container($opts);
}

/** Render callback for the image block. */
function zinejs_render_image_block($attributes) {
    $opts = zinejs_shared_block_opts($attributes);
    $opts['pdf'] = '';
    $opts['images'] = isset($attributes['images']) && is_array($attributes['images'])
        ? $attributes['images'] : array();
    return zinejs_render_container($opts);
}
