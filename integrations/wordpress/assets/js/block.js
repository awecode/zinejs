/**
 * Editor UI for the Zine Flipbook block. Written in plain JS (no JSX/build step): it picks a PDF
 * from the Media Library and exposes a few options. The block is dynamic, so the front-end markup
 * comes from PHP (render_callback); `save` returns null.
 */
(function (blocks, element, blockEditor, components, i18n) {
  'use strict';
  var el = element.createElement;
  var __ = i18n.__;
  var useBlockProps = blockEditor.useBlockProps;
  var InspectorControls = blockEditor.InspectorControls;
  var MediaUpload = blockEditor.MediaUpload;
  var MediaUploadCheck = blockEditor.MediaUploadCheck;
  var PanelBody = components.PanelBody;
  var SelectControl = components.SelectControl;
  var ToggleControl = components.ToggleControl;
  var TextControl = components.TextControl;
  var Button = components.Button;
  var Placeholder = components.Placeholder;

  function edit(props) {
    var a = props.attributes;
    var set = props.setAttributes;

    var num = function (key) {
      return function (v) {
        var set2 = {}; set2[key] = v.replace(/[^0-9]/g, ''); set(set2);
      };
    };

    var layout = el(
      PanelBody,
      { title: __('Layout', 'zinejs'), initialOpen: true },
      el(SelectControl, {
        label: __('Spread mode', 'zinejs'),
        value: a.spreadMode,
        options: [
          { label: __('Cover (lone first page)', 'zinejs'), value: 'cover' },
          { label: __('Double (paired from page 1)', 'zinejs'), value: 'double' },
          { label: __('Single (one page)', 'zinejs'), value: 'single' },
          { label: __('Book (lone first and last)', 'zinejs'), value: 'book' },
        ],
        onChange: function (v) { set({ spreadMode: v }); },
      }),
      el(SelectControl, {
        label: __('Reading direction', 'zinejs'),
        value: a.direction,
        options: [
          { label: __('Left to right', 'zinejs'), value: 'ltr' },
          { label: __('Right to left', 'zinejs'), value: 'rtl' },
        ],
        onChange: function (v) { set({ direction: v }); },
      }),
      el(SelectControl, {
        label: __('Off-size pages', 'zinejs'),
        value: a.fit,
        options: [
          { label: __('Contain (no distortion)', 'zinejs'), value: 'contain' },
          { label: __('Fill (stretch)', 'zinejs'), value: 'fill' },
        ],
        onChange: function (v) { set({ fit: v }); },
      }),
      el(ToggleControl, {
        label: __('Collapse to one page on narrow screens', 'zinejs'),
        help: __('Off keeps the chosen spread mode at every width (e.g. cover stays two pages in a narrow column).', 'zinejs'),
        checked: a.responsiveSpread,
        onChange: function (v) { set({ responsiveSpread: v }); },
      }),
      a.responsiveSpread &&
        el(TextControl, {
          label: __('Collapse below width (px)', 'zinejs'),
          help: __('Screens narrower than this show one page. Blank uses the default (500).', 'zinejs'),
          value: a.singlePageThreshold,
          onChange: num('singlePageThreshold'),
        }),
      el(TextControl, {
        label: __('Max width (px)', 'zinejs'),
        value: a.maxWidth,
        onChange: num('maxWidth'),
      }),
      el(TextControl, {
        label: __('Aspect ratio', 'zinejs'),
        help: __('e.g. 3/2, or "auto" to let the pages decide.', 'zinejs'),
        value: a.aspect,
        onChange: function (v) { set({ aspect: v }); },
      })
    );

    var interaction = el(
      PanelBody,
      { title: __('Interaction', 'zinejs'), initialOpen: false },
      el(SelectControl, {
        label: __('Click to turn', 'zinejs'),
        value: a.clickToFlip,
        options: [
          { label: __('Near an edge', 'zinejs'), value: 'edge' },
          { label: __('By page half', 'zinejs'), value: 'half' },
          { label: __('Off', 'zinejs'), value: 'off' },
        ],
        onChange: function (v) { set({ clickToFlip: v }); },
      }),
      el(SelectControl, {
        label: __('Curl style', 'zinejs'),
        help: __('The page-turn effect (GPU renderer).', 'zinejs'),
        value: a.curl,
        options: [
          { label: __('Cone (realistic)', 'zinejs'), value: 'cone' },
          { label: __('Simple (flat fold)', 'zinejs'), value: 'simple' },
        ],
        onChange: function (v) { set({ curl: v }); },
      }),
      el(TextControl, {
        label: __('Flip duration (ms)', 'zinejs'),
        help: __('Blank uses the default (800).', 'zinejs'),
        value: a.flipDuration,
        onChange: num('flipDuration'),
      }),
      el(TextControl, {
        label: __('Start page', 'zinejs'),
        help: __('Zero-based page to open on.', 'zinejs'),
        value: String(a.startPage || 0),
        onChange: function (v) { set({ startPage: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 }); },
      })
    );

    var zoom = el(
      PanelBody,
      { title: __('Zoom', 'zinejs'), initialOpen: false },
      el(ToggleControl, {
        label: __('Allow zooming', 'zinejs'),
        checked: a.zoomEnabled,
        onChange: function (v) { set({ zoomEnabled: v }); },
      }),
      a.zoomEnabled &&
        el(TextControl, {
          label: __('Max zoom', 'zinejs'),
          help: __('Blank uses the default (4).', 'zinejs'),
          value: a.zoomMax,
          onChange: num('zoomMax'),
        }),
      a.zoomEnabled &&
        el(ToggleControl, {
          label: __('Ctrl/Cmd + wheel to zoom', 'zinejs'),
          checked: a.zoomWheel,
          onChange: function (v) { set({ zoomWheel: v }); },
        }),
      a.zoomEnabled &&
        el(ToggleControl, {
          label: __('Double-click to zoom', 'zinejs'),
          checked: a.zoomDoubleClick,
          onChange: function (v) { set({ zoomDoubleClick: v }); },
        })
    );

    var chrome = el(
      PanelBody,
      { title: __('Controls & chrome', 'zinejs'), initialOpen: false },
      el(ToggleControl, {
        label: __('Show toolbar', 'zinejs'),
        checked: a.controls,
        onChange: function (v) { set({ controls: v }); },
      }),
      el(ToggleControl, {
        label: __('Right-click menu', 'zinejs'),
        checked: a.contextMenu,
        onChange: function (v) { set({ contextMenu: v }); },
      }),
      el(ToggleControl, {
        label: __('Loading indicator', 'zinejs'),
        checked: a.loading,
        onChange: function (v) { set({ loading: v }); },
      }),
      el(ToggleControl, {
        label: __('On-book hints', 'zinejs'),
        help: __('Subtle first-time cues (corner peek, zoom caption).', 'zinejs'),
        checked: a.hints,
        onChange: function (v) { set({ hints: v }); },
      })
    );

    var settings = el(InspectorControls, {}, layout, interaction, zoom, chrome);

    var picker = el(
      MediaUploadCheck,
      {},
      el(MediaUpload, {
        onSelect: function (media) { set({ url: media.url }); },
        allowedTypes: ['application/pdf'],
        value: a.url,
        render: function (o) {
          return el(
            Button,
            { variant: 'primary', onClick: o.open },
            a.url ? __('Replace PDF', 'zinejs') : __('Select PDF', 'zinejs')
          );
        },
      })
    );

    var body = a.url
      ? el(
          'div',
          { className: 'zine-block-preview' },
          el('p', { className: 'zine-block-file' }, a.url.split('/').pop()),
          el(
            'p',
            { className: 'zine-block-note' },
            __('The flipbook renders on the published page.', 'zinejs')
          ),
          picker
        )
      : el(
          Placeholder,
          {
            icon: 'book-alt',
            label: __('Zine Flipbook', 'zinejs'),
            instructions: __('Choose a PDF to turn into a page-flip book.', 'zinejs'),
          },
          picker
        );

    return el('div', useBlockProps(), settings, body);
  }

  blocks.registerBlockType('zinejs/flipbook', {
    edit: edit,
    save: function () { return null; }, // dynamic: PHP renders the front end
  });
})(
  window.wp.blocks,
  window.wp.element,
  window.wp.blockEditor,
  window.wp.components,
  window.wp.i18n
);
