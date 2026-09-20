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
    );

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

/**
 * Block render callback. Maps the block's saved attributes onto the shared renderer.
 *
 * @param array $attributes
 * @return string
 */
function zinejs_render_block($attributes) {
    return zinejs_render_container(array(
        'pdf'        => isset($attributes['url']) ? $attributes['url'] : '',
        'images'     => array(),
        'spreadMode' => isset($attributes['spreadMode']) ? $attributes['spreadMode'] : 'cover',
        'controls'   => isset($attributes['controls']) ? $attributes['controls'] : true,
        'direction'  => isset($attributes['direction']) ? $attributes['direction'] : 'ltr',
        'fit'        => isset($attributes['fit']) ? $attributes['fit'] : 'contain',
        'maxWidth'   => isset($attributes['maxWidth']) ? $attributes['maxWidth'] : '900',
        'aspect'     => isset($attributes['aspect']) ? $attributes['aspect'] : '3/2',
    ));
}
