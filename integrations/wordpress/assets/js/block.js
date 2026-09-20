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

    var settings = el(
      InspectorControls,
      {},
      el(
        PanelBody,
        { title: __('Flipbook settings', 'zinejs'), initialOpen: true },
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
          label: __('Show controls', 'zinejs'),
          checked: a.controls,
          onChange: function (v) { set({ controls: v }); },
        }),
        el(ToggleControl, {
          label: __('Collapse to one page on narrow screens', 'zinejs'),
          help: __('Off keeps the chosen spread mode at every width (e.g. cover stays two pages in a narrow column).', 'zinejs'),
          checked: a.responsiveSpread,
          onChange: function (v) { set({ responsiveSpread: v }); },
        }),
        el(TextControl, {
          label: __('Max width (px)', 'zinejs'),
          value: a.maxWidth,
          onChange: function (v) { set({ maxWidth: v.replace(/[^0-9]/g, '') }); },
        }),
        el(TextControl, {
          label: __('Aspect ratio', 'zinejs'),
          help: __('e.g. 3/2, or "auto" to let the pages decide.', 'zinejs'),
          value: a.aspect,
          onChange: function (v) { set({ aspect: v }); },
        })
      )
    );

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
