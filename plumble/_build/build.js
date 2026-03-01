#!/usr/bin/env node
/**
 * Plumble i18n Static Page Generator
 * Reads template.html + translation JSON files → generates static HTML per language.
 */
const fs = require('fs');
const path = require('path');

const BUILD_DIR = __dirname;
const OUTPUT_DIR = path.resolve(BUILD_DIR, '..');
const TEMPLATE_PATH = path.join(BUILD_DIR, 'template.html');
const TRANSLATIONS_DIR = path.join(BUILD_DIR, 'translations');
const DEFAULT_LANG = 'zh-Hant';
const BASE_URL = 'https://aircon-chen.github.io/plumble';

// Read template
const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

// Read all translation files
const langFiles = fs.readdirSync(TRANSLATIONS_DIR).filter(f => f.endsWith('.json'));
const languages = {};
for (const file of langFiles) {
    const locale = path.basename(file, '.json');
    languages[locale] = JSON.parse(fs.readFileSync(path.join(TRANSLATIONS_DIR, file), 'utf-8'));
}

const locales = Object.keys(languages);
console.log(`Found ${locales.length} languages: ${locales.join(', ')}`);

// Generate hreflang tags
function buildHreflangTags() {
    const tags = [];
    for (const locale of locales) {
        const url = locale === DEFAULT_LANG
            ? `${BASE_URL}/`
            : `${BASE_URL}/${locale}/`;
        const hreflang = languages[locale].hreflang || locale;
        tags.push(`    <link rel="alternate" hreflang="${hreflang}" href="${url}">`);
    }
    // x-default points to the default language
    tags.push(`    <link rel="alternate" hreflang="x-default" href="${BASE_URL}/">`);
    return tags.join('\n');
}

// Generate language switcher JSON for client-side use
function buildLangSwitcherData() {
    const data = {};
    for (const locale of locales) {
        data[locale] = {
            name: languages[locale].lang_name || locale,
            url: locale === DEFAULT_LANG ? '/' : `/${locale}/`
        };
    }
    return JSON.stringify(data);
}

const hreflangTags = buildHreflangTags();
const langSwitcherData = buildLangSwitcherData();

// Process each language
for (const locale of locales) {
    const trans = languages[locale];
    let html = template;

    // Replace all {{key}} placeholders
    html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (key === 'hreflang_tags') return hreflangTags;
        if (key === 'lang_switcher_data') return langSwitcherData;
        if (key === 'canonical_url') {
            return locale === DEFAULT_LANG
                ? `${BASE_URL}/`
                : `${BASE_URL}/${locale}/`;
        }
        if (key === 'og_url') {
            return locale === DEFAULT_LANG
                ? `${BASE_URL}/`
                : `${BASE_URL}/${locale}/`;
        }
        if (trans[key] !== undefined) return trans[key];
        // Fallback to default language
        if (languages[DEFAULT_LANG][key] !== undefined) {
            console.warn(`  [${locale}] Missing key "${key}", using ${DEFAULT_LANG} fallback`);
            return languages[DEFAULT_LANG][key];
        }
        console.warn(`  [${locale}] Unknown key "${key}"`);
        return match;
    });

    // For non-default languages in subdirectories, fix relative asset paths
    if (locale !== DEFAULT_LANG) {
        html = html.replace(/href="images\//g, 'href="../images/');
        html = html.replace(/src="images\//g, 'src="../images/');
        html = html.replace(/srcset="images\//g, 'srcset="../images/');
        html = html.replace(/href="privacy\.html"/g, 'href="../privacy.html"');
        html = html.replace(/href="index\.html"/g, 'href="../index.html"');
    }

    // Determine output path
    let outputPath;
    if (locale === DEFAULT_LANG) {
        outputPath = path.join(OUTPUT_DIR, 'index.html');
    } else {
        const langDir = path.join(OUTPUT_DIR, locale);
        fs.mkdirSync(langDir, { recursive: true });
        outputPath = path.join(langDir, 'index.html');
    }

    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`  Generated: ${path.relative(OUTPUT_DIR, outputPath)}`);
}

console.log(`\nDone! Generated ${locales.length} pages.`);
