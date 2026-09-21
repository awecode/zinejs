/**
 * Editor UI for the two Zine Flipbook blocks (PDF and Images). Written in plain JS (no JSX/build
 * step). Both blocks are dynamic (PHP renders the front end; `save` returns null) and share every
 * option panel; only the source picker differs.
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

  /** The option panels shared by both blocks. Returns an <InspectorControls>. */
  function sharedSettings(a, set) {
    var num = function (key) {
      return function (v) {
        var s = {}; s[key] = v.replace(/[^0-9]/g, ''); set(s);
      };
    };

    // The one commonly-changed control stands on its own at the top (no panel header); the rest of
    // the layout options are used rarely, so they live in the collapsed Layout panel below.
    var spread = el(
      'div',
      { style: { padding: '16px 16px 0' } },
      el(SelectControl, {
        label: __('Spread mode', 'zinejs-flipbook'),
        value: a.spreadMode,
        options: [
          { label: __('Cover (lone first page)', 'zinejs-flipbook'), value: 'cover' },
          { label: __('Double (paired from page 1)', 'zinejs-flipbook'), value: 'double' },
          { label: __('Single (one page)', 'zinejs-flipbook'), value: 'single' },
          { label: __('Book (lone first and last)', 'zinejs-flipbook'), value: 'book' },
        ],
        onChange: function (v) { set({ spreadMode: v }); },
      })
    );

    var layout = el(
      PanelBody,
      { title: __('Layout', 'zinejs-flipbook'), initialOpen: false },
      el(SelectControl, {
        label: __('Reading direction', 'zinejs-flipbook'),
        value: a.direction,
        options: [
          { label: __('Left to right', 'zinejs-flipbook'), value: 'ltr' },
          { label: __('Right to left', 'zinejs-flipbook'), value: 'rtl' },
        ],
        onChange: function (v) { set({ direction: v }); },
      }),
      el(SelectControl, {
        label: __('Off-size pages', 'zinejs-flipbook'),
        value: a.fit,
        options: [
          { label: __('Contain (no distortion)', 'zinejs-flipbook'), value: 'contain' },
          { label: __('Fill (stretch)', 'zinejs-flipbook'), value: 'fill' },
        ],
        onChange: function (v) { set({ fit: v }); },
      }),
      el(ToggleControl, {
        label: __('Collapse to one page on narrow screens', 'zinejs-flipbook'),
        help: __('Off keeps the chosen spread mode at every width (e.g. cover stays two pages in a narrow column).', 'zinejs-flipbook'),
        checked: a.responsiveSpread,
        onChange: function (v) { set({ responsiveSpread: v }); },
      }),
      a.responsiveSpread &&
        el(TextControl, {
          label: __('Collapse below width (px)', 'zinejs-flipbook'),
          help: __('Screens narrower than this show one page. Blank uses the default (500).', 'zinejs-flipbook'),
          value: a.singlePageThreshold,
          onChange: num('singlePageThreshold'),
        }),
      el(TextControl, {
        label: __('Max width (px)', 'zinejs-flipbook'),
        value: a.maxWidth,
        onChange: num('maxWidth'),
      }),
      el(TextControl, {
        label: __('Aspect ratio', 'zinejs-flipbook'),
        help: __('e.g. 3/2, or "auto" to let the pages decide.', 'zinejs-flipbook'),
        value: a.aspect,
        onChange: function (v) { set({ aspect: v }); },
      })
    );

    var interaction = el(
      PanelBody,
      { title: __('Interaction', 'zinejs-flipbook'), initialOpen: false },
      el(SelectControl, {
        label: __('Click to turn', 'zinejs-flipbook'),
        value: a.clickToFlip,
        options: [
          { label: __('Near an edge', 'zinejs-flipbook'), value: 'edge' },
          { label: __('By page half', 'zinejs-flipbook'), value: 'half' },
          { label: __('Off', 'zinejs-flipbook'), value: 'off' },
        ],
        onChange: function (v) { set({ clickToFlip: v }); },
      }),
      el(SelectControl, {
        label: __('Curl style', 'zinejs-flipbook'),
        help: __('The page-turn effect (GPU renderer).', 'zinejs-flipbook'),
        value: a.curl,
        // Keep in sync with the engine's curls and the render whitelist (see README, "Updating
        // curl styles"). cone/simple are bundled; the rest load on demand via init.js.
        options: [
          { label: __('Cone (realistic)', 'zinejs-flipbook'), value: 'cone' },
          { label: __('Simple (flat fold)', 'zinejs-flipbook'), value: 'simple' },
          { label: __('Roll', 'zinejs-flipbook'), value: 'roll' },
          { label: __('Leaf', 'zinejs-flipbook'), value: 'leaf' },
          { label: __('Flick', 'zinejs-flipbook'), value: 'flick' },
          { label: __('Silk', 'zinejs-flipbook'), value: 'silk' },
        ],
        onChange: function (v) { set({ curl: v }); },
      }),
      el(TextControl, {
        label: __('Flip duration (ms)', 'zinejs-flipbook'),
        help: __('Blank uses the default (800).', 'zinejs-flipbook'),
        value: a.flipDuration,
        onChange: num('flipDuration'),
      }),
      el(TextControl, {
        label: __('Start page', 'zinejs-flipbook'),
        help: __('Zero-based page to open on.', 'zinejs-flipbook'),
        value: String(a.startPage || 0),
        onChange: function (v) { set({ startPage: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 }); },
      })
    );

    var zoom = el(
      PanelBody,
      { title: __('Zoom', 'zinejs-flipbook'), initialOpen: false },
      el(ToggleControl, {
        label: __('Allow zooming', 'zinejs-flipbook'),
        checked: a.zoomEnabled,
        onChange: function (v) { set({ zoomEnabled: v }); },
      }),
      a.zoomEnabled &&
        el(TextControl, {
          label: __('Max zoom', 'zinejs-flipbook'),
          help: __('Blank uses the default (4).', 'zinejs-flipbook'),
          value: a.zoomMax,
          onChange: num('zoomMax'),
        }),
      a.zoomEnabled &&
        el(ToggleControl, {
          label: __('Ctrl/Cmd + wheel to zoom', 'zinejs-flipbook'),
          checked: a.zoomWheel,
          onChange: function (v) { set({ zoomWheel: v }); },
        }),
      a.zoomEnabled &&
        el(ToggleControl, {
          label: __('Double-click to zoom', 'zinejs-flipbook'),
          checked: a.zoomDoubleClick,
          onChange: function (v) { set({ zoomDoubleClick: v }); },
        })
    );

    var chrome = el(
      PanelBody,
      { title: __('Controls & chrome', 'zinejs-flipbook'), initialOpen: false },
      el(ToggleControl, {
        label: __('Show toolbar', 'zinejs-flipbook'),
        checked: a.controls,
        onChange: function (v) { set({ controls: v }); },
      }),
      a.controls &&
        el(SelectControl, {
          label: __('Toolbar position', 'zinejs-flipbook'),
          value: a.controlsPosition,
          options: [
            { label: __('Bottom', 'zinejs-flipbook'), value: 'bottom' },
            { label: __('Top', 'zinejs-flipbook'), value: 'top' },
            { label: __('Left', 'zinejs-flipbook'), value: 'left' },
            { label: __('Right', 'zinejs-flipbook'), value: 'right' },
          ],
          onChange: function (v) { set({ controlsPosition: v }); },
        }),
      a.controls &&
        el(SelectControl, {
          label: __('Toolbar color scheme', 'zinejs-flipbook'),
          value: a.controlsColorScheme,
          options: [
            { label: __('Auto', 'zinejs-flipbook'), value: 'auto' },
            { label: __('Light', 'zinejs-flipbook'), value: 'light' },
            { label: __('Dark', 'zinejs-flipbook'), value: 'dark' },
          ],
          onChange: function (v) { set({ controlsColorScheme: v }); },
        }),
      a.controls &&
        el(ToggleControl, {
          label: __('Large page arrows', 'zinejs-flipbook'),
          help: __('Big prev/next arrows flanking the book.', 'zinejs-flipbook'),
          checked: a.controlsArrows,
          onChange: function (v) { set({ controlsArrows: v }); },
        }),
      el(ToggleControl, {
        label: __('Right-click menu', 'zinejs-flipbook'),
        checked: a.contextMenu,
        onChange: function (v) { set({ contextMenu: v }); },
      }),
      el(ToggleControl, {
        label: __('Loading indicator', 'zinejs-flipbook'),
        checked: a.loading,
        onChange: function (v) { set({ loading: v }); },
      }),
      el(ToggleControl, {
        label: __('On-book hints', 'zinejs-flipbook'),
        help: __('Subtle first-time cues (corner peek, zoom caption).', 'zinejs-flipbook'),
        checked: a.hints,
        onChange: function (v) { set({ hints: v }); },
      }),
      el(ToggleControl, {
        label: __('Keep current page in the URL', 'zinejs-flipbook'),
        help: __('Makes a page shareable and bookmarkable (deep link).', 'zinejs-flipbook'),
        checked: a.deepLink,
        onChange: function (v) { set({ deepLink: v }); },
      })
    );

    var sound = el(
      PanelBody,
      { title: __('Sound', 'zinejs-flipbook'), initialOpen: false },
      el(ToggleControl, {
        label: __('Page-flip sound', 'zinejs-flipbook'),
        help: __('Off by default. When on, a mute control appears in the toolbar.', 'zinejs-flipbook'),
        checked: a.sound,
        onChange: function (v) { set({ sound: v }); },
      }),
      a.sound &&
        el(TextControl, {
          label: __('Volume (0 to 1)', 'zinejs-flipbook'),
          help: __('Blank uses the default (0.5).', 'zinejs-flipbook'),
          value: a.soundVolume,
          onChange: function (v) { set({ soundVolume: v.replace(/[^0-9.]/g, '') }); },
        }),
      a.sound &&
        el(ToggleControl, {
          label: __('Start muted', 'zinejs-flipbook'),
          help: __('Offer sound but start silent; the reader unmutes it.', 'zinejs-flipbook'),
          checked: a.soundMuted,
          onChange: function (v) { set({ soundMuted: v }); },
        }),
      a.sound &&
        el(ToggleControl, {
          label: __("Remember the reader's mute choice", 'zinejs-flipbook'),
          checked: a.soundPersist,
          onChange: function (v) { set({ soundPersist: v }); },
        })
    );

    var permissions = el(
      PanelBody,
      { title: __('Reader permissions', 'zinejs-flipbook'), initialOpen: false },
      el(ToggleControl, {
        label: __('Allow download', 'zinejs-flipbook'),
        checked: a.allowDownload,
        onChange: function (v) { set({ allowDownload: v }); },
      }),
      el(ToggleControl, {
        label: __('Allow print', 'zinejs-flipbook'),
        checked: a.allowPrint,
        onChange: function (v) { set({ allowPrint: v }); },
      }),
      el(ToggleControl, {
        label: __('Allow share', 'zinejs-flipbook'),
        checked: a.allowShare,
        onChange: function (v) { set({ allowShare: v }); },
      })
    );

    var coverPicker = function (key, label) {
      return el(
        'div',
        { className: 'zine-cover-field' },
        el('p', { style: { margin: '0 0 4px', fontSize: '12px' } }, label),
        el(MediaUploadCheck, {}, el(MediaUpload, {
          onSelect: function (m) { var o = {}; o[key] = m.url; set(o); },
          allowedTypes: ['image'],
          value: a[key],
          render: function (o) {
            return el(
              'div',
              { style: { display: 'flex', gap: '8px' } },
              el(Button, { variant: 'secondary', onClick: o.open },
                a[key] ? __('Replace', 'zinejs-flipbook') : __('Select image', 'zinejs-flipbook')),
              a[key] && el(Button, {
                variant: 'tertiary', isDestructive: true,
                onClick: function () { var c = {}; c[key] = ''; set(c); },
              }, __('Remove', 'zinejs-flipbook'))
            );
          },
        }))
      );
    };
    var covers = el(
      PanelBody,
      { title: __('Covers', 'zinejs-flipbook'), initialOpen: false },
      coverPicker('frontCover', __('Front cover image', 'zinejs-flipbook')),
      coverPicker('backCover', __('Back cover image', 'zinejs-flipbook'))
    );

    return el(InspectorControls, {}, spread, layout, interaction, zoom, sound, chrome, permissions, covers);
  }

  /** Preview shown once a source is chosen: a summary line plus the picker to change it. */
  function preview(fileLabel, picker) {
    return el(
      'div',
      { className: 'zine-block-preview' },
      el('p', { className: 'zine-block-file' }, fileLabel),
      el('p', { className: 'zine-block-note' }, __('The flipbook renders on the published page.', 'zinejs-flipbook')),
      picker
    );
  }

  function editPdf(props) {
    var a = props.attributes, set = props.setAttributes;
    var picker = el(MediaUploadCheck, {}, el(MediaUpload, {
      onSelect: function (m) { set({ url: m.url }); },
      allowedTypes: ['application/pdf'],
      value: a.url,
      render: function (o) {
        return el(Button, { variant: 'primary', onClick: o.open },
          a.url ? __('Replace PDF', 'zinejs-flipbook') : __('Select PDF', 'zinejs-flipbook'));
      },
    }));
    var body = a.url
      ? preview(a.url.split('/').pop(), picker)
      : el(Placeholder, {
          icon: 'media-document',
          label: __('Zine PDF Flipbook', 'zinejs-flipbook'),
          instructions: __('Choose a PDF to turn into a page-flip book.', 'zinejs-flipbook'),
        }, picker);
    return el('div', useBlockProps(), sharedSettings(a, set), body);
  }

  function editImage(props) {
    var a = props.attributes, set = props.setAttributes;
    var picker = el(MediaUploadCheck, {}, el(MediaUpload, {
      onSelect: function (media) {
        set({
          images: media.map(function (m) { return m.url; }),
          imageIds: media.map(function (m) { return m.id; }),
        });
      },
      allowedTypes: ['image'],
      multiple: true,
      gallery: true,
      value: a.imageIds,
      render: function (o) {
        var count = (a.images || []).length;
        return el(Button, { variant: 'primary', onClick: o.open },
          count ? __('Edit images', 'zinejs-flipbook') + ' (' + count + ')' : __('Select images', 'zinejs-flipbook'));
      },
    }));
    var count = (a.images || []).length;
    var body = count
      ? preview(count + ' ' + __('images', 'zinejs-flipbook'), picker)
      : el(Placeholder, {
          icon: 'images-alt2',
          label: __('Zine Image Flipbook', 'zinejs-flipbook'),
          instructions: __('Choose images to turn into a page-flip book.', 'zinejs-flipbook'),
        }, picker);
    return el('div', useBlockProps(), sharedSettings(a, set), body);
  }

  var save = function () { return null; }; // dynamic: PHP renders the front end
  blocks.registerBlockType('zinejs/pdf-flipbook', { edit: editPdf, save: save });
  blocks.registerBlockType('zinejs/image-flipbook', { edit: editImage, save: save });
})(
  window.wp.blocks,
  window.wp.element,
  window.wp.blockEditor,
  window.wp.components,
  window.wp.i18n
);
