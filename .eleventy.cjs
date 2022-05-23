const compress = require('compression');
const anchorsPlugin = require('@orchidjs/eleventy-plugin-ids');
const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');
const directoryOutputPlugin = require('@11ty/eleventy-plugin-directory-output');

const pfeAssetsPlugin = require('@patternfly/pfe-tools/11ty/plugins/pfe-assets.cjs');

const customElementsManifestPlugin = require('@patternfly/pfe-tools/11ty/plugins/custom-elements-manifest.cjs');
const orderTagsPlugin = require('@patternfly/pfe-tools/11ty/plugins/order-tags.cjs');
const alphabetizeTagsPlugin = require('./docs/_plugins/alphabetize-tags.cjs');
const todosPlugin = require('@patternfly/pfe-tools/11ty/plugins/todos.cjs');

const markdownIt = require('markdown-it');
const markdownItAnchor = require('markdown-it-anchor');

const pluginToc = require('@patternfly/pfe-tools/11ty/plugins/table-of-contents.cjs');
const sassPlugin = require('eleventy-plugin-dart-sass');

const path = require('path');

const markdownLib = markdownIt({
  html: true,
  breaks: true,
  linkify: true,
})
  .use(markdownItAnchor);


module.exports = function(eleventyConfig) {
  eleventyConfig.addPlugin(sassPlugin, {
    sassLocation: `${path.join(__dirname, 'docs', 'scss')}/`,
    sassIndexFile: 'styles.scss',
    includePaths: ['node_modules', '**/*.{scss,sass}'],
    domainName: '',
    outDir: path.join(__dirname, '_site'),
  });
  eleventyConfig.setQuietMode(process.env.npm_config_quiet);

  eleventyConfig.setWatchThrottleWaitTime(500);

  eleventyConfig.setBrowserSyncConfig({
    open: 'local',
    server: {
      baseDir: '_site',
      middleware: [compress()],
    },
  });

  /** Table of Contents Shortcode */
  eleventyConfig.addPlugin(pluginToc, {
    tags: ['h2', 'h3', 'h4', 'h5', 'h6'],
    wrapperClass: 'table-of-contents',
    headingText: 'Table of Contents'
  });

  const { dependencies } = require(path.join(__dirname, 'package.json'));
  const additionalPackages = [
    ...Object.entries(dependencies)
      .map(([k, v]) => k.startsWith('@patternfly') && v === 'next' ? k : false)
      .filter(x => x && x !== '@patternfly/pfe-styles'),
  ];

  /** Generate and consume custom elements manifests */
  eleventyConfig.addPlugin(customElementsManifestPlugin);

  /** Collections to organize alphabetically instead of by date */
  eleventyConfig.addPlugin(orderTagsPlugin, { tags: ['component'], order: 'alphabetically' });

  /** Collections to organize by order instead of date */
  eleventyConfig.addPlugin(orderTagsPlugin, { tags: ['develop'] });

  /** list todos */
  eleventyConfig.addPlugin(todosPlugin);

  /** format date strings */
  eleventyConfig.addFilter('prettyDate', function(dateStr, options = {}) {
    const { dateStyle = 'medium' } = options;
    return new Intl.DateTimeFormat('en-US', { dateStyle })
      .format(new Date(dateStr));
  });

  /** fancy syntax highlighting with diff support */
  eleventyConfig.addPlugin(syntaxHighlight);

  /** Add IDs to heading elements */
  eleventyConfig.addPlugin(anchorsPlugin, {
    formatter(element, existingids) {
      if (
        !existingids.includes(element.getAttribute('id')) &&
        element.hasAttribute('slot') &&
        element.closest('pfe-card')
      ) {
        return null;
      } else {
        return eleventyConfig.javascriptFunctions
          .slug(element.textContent)
          .replace(/[&,+()$~%.'":*?!<>{}]/g, '');
      }
    },
  });

  /**
   * Section macro
   * Creates a section of the page with a heading
   *
   * @param {object} options
   * @param options.headline       Text to go in the heading
   * @param options.palette        Palette to apply, e.g. lightest, light see components/_section.scss
   * @param options.headingLevel   The heading level, defaults to 2
   */
  eleventyConfig.addPairedShortcode('section', function(content, { headline, palette = 'default', headingLevel = '2' } = {}) {
    return /* html*/`
      <section class="section section--palette-${palette} container">
        <a id="${encodeURIComponent(headline)}"></a>
        <h${headingLevel} id="${eleventyConfig.getFilter('slugify')(headline)}" class="section-title pfe-jump-links-panel__section">${headline}</h${headingLevel}>
        ${content}
      </section>
    `;
  });

  /**
   * Example
   * An example image or component
   *
   * @param headline       (Optional) Text to go in the heading
   * @param palette        Palette to apply, e.g. lightest, light see components/_section.scss
   * @param headingLevel   The heading level, defaults to 3
   */
  eleventyConfig.addPairedShortcode('example', function(content, { headline, palette = 'light', headingLevel = '3' } = {}) {
    return /* html*/`
      <div class="example example--palette-${palette}">${!headline ? '' : `
        <a id="${encodeURIComponent(headline)}"></a>
        <h${headingLevel} id="${eleventyConfig.getFilter('slugify')(headline)}" class="example-title">${headline}</h${headingLevel}>`}
        ${content}
      </div>
    `;
  });

  eleventyConfig.addPlugin(directoryOutputPlugin, {
    // Customize columns
    columns: {
      filesize: true, // Use `false` to disable
      benchmark: true, // Use `false` to disable
    },

    // Will show in yellow if greater than this number of bytes
    warningFileSize: 400 * 1000,
  });

  /**
   * Collections to organize by 'order' value in front matter, then alphabetical by title;
   * instead of by date
   */
  eleventyConfig.addPlugin(alphabetizeTagsPlugin, {
    tagsToAlphabetize: [
      // 'component',
      'foundations',
      'getstarted',
    ]
  });

  eleventyConfig.setLibrary('md', markdownLib);

  eleventyConfig.addPassthroughCopy('docs/CNAME');
  eleventyConfig.addPassthroughCopy('docs/.nojekyll');
  eleventyConfig.addPassthroughCopy('docs/robots.txt');
  eleventyConfig.addPassthroughCopy('docs/assets/**/*');
  eleventyConfig.addPassthroughCopy('docs/js/**/*');
  eleventyConfig.addPassthroughCopy({ 'rhds.min.*': 'assets' });

  const buildElements = async () =>
    import('./scripts/build.js')
      .then(m => m.build());

  eleventyConfig.on('eleventy.before', buildElements);

  return {
    templateFormats: [
      'md',
      'njk',
      'html',
      'liquid',
    ],

    markdownTemplateEngine: 'liquid',
    htmlTemplateEngine: 'njk',
    dataTemplateEngine: 'njk',

    dir: {
      input: './docs',
    },
  };
};
