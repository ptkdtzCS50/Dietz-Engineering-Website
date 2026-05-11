/**
 * Eleventy Konfiguration für dietz-engineering.com
 *
 * - Source-Dateien liegen in src/
 * - Build-Output landet in _site/
 * - Static Assets (Bilder, Logos, CNAME) werden 1:1 kopiert
 * - Sprachen / i18n bleiben weiterhin client-seitig in der index.html
 *
 * Dieses File wird sowohl von GitHub Actions (Build in der Cloud) als auch
 * von "npm run start" (lokaler Dev-Server) gelesen.
 */

module.exports = function(eleventyConfig) {

  // ---- Passthrough: Dateien, die unverändert kopiert werden ----
  // Hero-Banner, Logos, Foto, Legal-Seiten, CNAME
  eleventyConfig.addPassthroughCopy({ "src/static": "/" });

  // Admin-Bereich für Decap CMS (kommt in Phase 4 dazu)
  eleventyConfig.addPassthroughCopy({ "admin": "admin" });

  // ---- Watch-Targets für lokales Development ----
  eleventyConfig.addWatchTarget("src/_data/");
  eleventyConfig.addWatchTarget("src/static/");

  // ---- Filter (kleine Helper für Templates) ----
  // Beispiel: Jahr im Footer dynamisch generieren
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data"
    },
    // Template-Engines: Nunjucks für .njk-Files, Markdown für .md
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    // URLs ohne /index.html-Suffix
    pathPrefix: "/"
  };
};
