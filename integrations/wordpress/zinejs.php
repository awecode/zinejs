<?php
/**
 * Plugin Name:       zinejs Flipbook
 * Plugin URI:        https://zinejs.com
 * Description:       Turn a PDF or a set of images into an interactive page-flip book, via a block or the [zine] shortcode.
 * Version:           0.1.12
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            zinejs
 * Author URI:        https://zinejs.com
 * License:           PolyForm Noncommercial 1.0.0 (commercial license required for commercial use)
 * License URI:       https://zinejs.com/license
 * Text Domain:       zinejs
 *
 * Free for personal, educational and non-profit use. Commercial sites need a commercial license:
 * https://zinejs.com/license
 */

if (!defined('ABSPATH')) {
    exit; // No direct access.
}

define('ZINEJS_VERSION', '0.1.12');
define('ZINEJS_FILE', __FILE__);
define('ZINEJS_URL', plugin_dir_url(__FILE__));
define('ZINEJS_PATH', plugin_dir_path(__FILE__));
// The bundled engine and pdf.js versions, for cache-busting and support reports.
define('ZINEJS_ENGINE_VERSION', '0.9.2');
define('ZINEJS_PDFJS_VERSION', '6.2.108');

require_once ZINEJS_PATH . 'includes/render.php';

/**
 * Register (but do not enqueue) the front-end assets. They are enqueued only on pages that
 * actually contain a flipbook, so a page without one loads nothing.
 */
function zinejs_register_assets() {
    wp_register_style('zinejs', ZINEJS_URL . 'assets/css/zinejs.css', array(), ZINEJS_VERSION);

    wp_register_script(
        'zinejs-core',
        ZINEJS_URL . 'assets/vendor/zine-core.umd.js',
        array(),
        ZINEJS_ENGINE_VERSION,
        true
    );
    // The PDF source extends the same ZineJS global, so it loads after core.
    wp_register_script(
        'zinejs-pdf',
        ZINEJS_URL . 'assets/vendor/zine-pdf.umd.js',
        array('zinejs-core'),
        ZINEJS_ENGINE_VERSION,
        true
    );
    wp_register_script(
        'zinejs-init',
        ZINEJS_URL . 'assets/js/init.js',
        array('zinejs-core', 'zinejs-pdf'),
        ZINEJS_VERSION,
        true
    );
    // pdf.js has no bundler to resolve its worker here, so the init script is told where the
    // bundled pdf.js module and its worker live (see the worker notes in the plugin readme).
    wp_localize_script('zinejs-init', 'ZINEJS_WP', array(
        'pdfjs'  => ZINEJS_URL . 'assets/vendor/pdf.min.mjs',
        'worker' => ZINEJS_URL . 'assets/vendor/pdf.worker.min.mjs',
        // The non-bundled curls (roll/leaf/flick/silk) load on demand from here.
        'curls'  => ZINEJS_URL . 'assets/vendor/zine-curls.mjs',
    ));
}
add_action('wp_enqueue_scripts', 'zinejs_register_assets');
add_action('enqueue_block_editor_assets', 'zinejs_register_assets');

/** Pull the registered assets onto the current page. Called by the block and the shortcode when
 *  they render, so only pages with a flipbook pay for them. */
function zinejs_enqueue() {
    wp_enqueue_style('zinejs');
    wp_enqueue_script('zinejs-core');
    wp_enqueue_script('zinejs-pdf');
    wp_enqueue_script('zinejs-init');
}

/** Register the two blocks (dynamic: PHP renders them, so blocks and shortcode share one path).
 *  A PDF block and an image block, each with its own picker; all options are shared. */
function zinejs_register_block() {
    if (!function_exists('register_block_type')) {
        return; // Classic-only WordPress; the shortcode still works.
    }
    // One editor script registers both block types; each block.json points its editorScript here.
    wp_register_script(
        'zinejs-block',
        ZINEJS_URL . 'assets/js/block.js',
        array('wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n'),
        ZINEJS_VERSION,
        true
    );
    register_block_type(ZINEJS_PATH . 'block-pdf', array(
        'render_callback' => 'zinejs_render_pdf_block',
    ));
    register_block_type(ZINEJS_PATH . 'block-image', array(
        'render_callback' => 'zinejs_render_image_block',
    ));
}
add_action('init', 'zinejs_register_block');

/** The [zine] shortcode: [zine pdf="url" spread="cover" controls="true" max-width="800"] (max-width and aspect optional). */
function zinejs_shortcode($atts) {
    $atts = shortcode_atts(array(
        'pdf'        => '',
        'images'     => '',
        'spread'     => 'cover',
        'controls'   => 'true',
        'direction'  => 'ltr',
        'fit'        => 'contain',
        'responsive' => 'true',
        'threshold'  => '',
        'max-width'  => '',
        'aspect'     => 'auto',
    ), $atts, 'zine');

    return zinejs_render_container(array(
        'pdf'              => $atts['pdf'],
        'images'           => array_filter(array_map('trim', explode(',', $atts['images']))),
        'spreadMode'       => $atts['spread'],
        'controls'         => filter_var($atts['controls'], FILTER_VALIDATE_BOOLEAN),
        'direction'        => $atts['direction'],
        'fit'              => $atts['fit'],
        'responsiveSpread' => filter_var($atts['responsive'], FILTER_VALIDATE_BOOLEAN),
        'singlePageThreshold' => $atts['threshold'],
        'maxWidth'         => $atts['max-width'],
        'aspect'           => $atts['aspect'],
    ));
}
add_shortcode('zine', 'zinejs_shortcode');
