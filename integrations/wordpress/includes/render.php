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
        'controls'  => !empty($opts['controls']),
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
    if (isset($opts['curl']) && in_array($opts['curl'], array('cone', 'simple'), true)) {
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

    // Sizing lives in CSS: a max width and an aspect ratio (the engine also sets aspect-ratio from
    // the book, but a starting value avoids a layout jump before the first page loads).
    $max_width = preg_replace('/[^0-9]/', '', (string) $opts['maxWidth']);
    $max_width = $max_width !== '' ? $max_width : '900';
    $aspect = (string) $opts['aspect'];
    $aspect_css = ($aspect === '' || $aspect === 'auto') ? '' : 'aspect-ratio:' . esc_attr($aspect) . ';';
    $style = 'width:min(' . esc_attr($max_width) . 'px,100%);' . $aspect_css;

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
        'direction'           => $a('direction', 'ltr'),
        'fit'                 => $a('fit', 'contain'),
        'responsiveSpread'    => $a('responsiveSpread', true),
        'singlePageThreshold' => $a('singlePageThreshold', ''),
        'maxWidth'            => $a('maxWidth', '900'),
        'aspect'              => $a('aspect', '3/2'),
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
