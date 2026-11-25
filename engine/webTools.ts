import * as cheerio from 'cheerio';
import type { ScrapedSource, SearchProvider } from './types.ts';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BODY_CHARS = 1_400_000;
const MAX_MARKDOWN_CHARS = 12_000;

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface DiscoveredLink {
  url: string;
  text: string;
  sameDomain: boolean;
}

export interface ScrapePageResult {
  source: ScrapedSource;
  markdown: string;
  links: DiscoveredLink[];
}

export interface DeepCrawlResult {
  startUrl: string;
  pagesCrawled: number;
  sources: ScrapedSource[];
  combinedDossier: string;
}

function makeSourceId(): string {
  return `src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isSafePublicUrl(rawUrl: string): { ok: boolean; url?: URL; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { ok: false, reason: 'Blocked local/internal host' };
  }

  // Block private IPv4 ranges & cloud metadata endpoints
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return { ok: false, reason: 'Blocked private IP range' };
    }
  }

  return { ok: true, url: parsed };
}

function combineSignals(
  parentSignal?: AbortSignal,
  timeoutMs = FETCH_TIMEOUT_MS,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!parentSignal) {
    return timeoutSignal;
  }
  return AbortSignal.any([parentSignal, timeoutSignal]);
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function decodeDdgUrl(rawHref: string): string {
  if (!rawHref) return '';
  let href = rawHref.trim();
  if (href.startsWith('//')) {
    href = `https:${href}`;
  }
  try {
    const parsed = new URL(href, 'https://duckduckgo.com');
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) {
      return decodeURIComponent(uddg);
    }
    if (parsed.hostname.includes('duckduckgo.com')) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/* -------------------------------------------------------------------------- */
/* Web Search (Tavily / Brave / DuckDuckGo HTML + Lite + Wikipedia fallback)  */
/* -------------------------------------------------------------------------- */

async function searchTavily(
  query: string,
  apiKey: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: 'advanced',
    }),
    signal: combineSignals(signal),
  });
  if (!res.ok) {
    throw new Error(`Tavily search failed (${res.status})`);
  }
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results ?? [])
    .filter((r) => r.url)
    .slice(0, maxResults)
    .map((r) => ({
      title: r.title ?? r.url ?? 'Result',
      url: r.url!,
      snippet: (r.content ?? '').slice(0, 320),
      source: 'tavily',
    }));
}

async function searchBrave(
  query: string,
  apiKey: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
    query,
  )}&count=${Math.min(maxResults, 20)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
    signal: combineSignals(signal),
  });
  if (!res.ok) {
    throw new Error(`Brave search failed (${res.status})`);
  }
  const data = (await res.json()) as {
    web?: {
      results?: Array<{ title?: string; url?: string; description?: string }>;
    };
  };
  return (data.web?.results ?? [])
    .filter((r) => r.url)
    .slice(0, maxResults)
    .map((r) => ({
      title: r.title ?? r.url ?? 'Result',
      url: r.url!,
      snippet: (r.description ?? '').slice(0, 320),
      source: 'brave',
    }));
}

async function searchDuckDuckGoHtml(
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: combineSignals(signal),
  });
  if (!res.ok) {
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const items: SearchResultItem[] = [];
  const seen = new Set<string>();

  $('.result, .web-result').each((_, el) => {
    if (items.length >= maxResults) return;
    if ($(el).hasClass('result--ad') || $(el).find('.badge--ad').length > 0) return;
    const linkEl = $(el).find('a.result__a').first();
    const rawHref = linkEl.attr('href') ?? '';
    const decoded = decodeDdgUrl(rawHref);
    if (!decoded || seen.has(decoded)) return;

    const safety = isSafePublicUrl(decoded);
    if (!safety.ok) return;

    const title = normalizeWhitespace(linkEl.text());
    const snippet = normalizeWhitespace($(el).find('.result__snippet').first().text());
    if (!title) return;

    seen.add(decoded);
    items.push({
      title,
      url: decoded,
      snippet: snippet.slice(0, 320),
      source: 'duckduckgo',
    });
  });

  return items;
}

async function searchDuckDuckGoLite(
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  const res = await fetch('https://lite.duckduckgo.com/lite/', {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    body: `q=${encodeURIComponent(query)}`,
    signal: combineSignals(signal),
  });
  if (!res.ok) return [];

  const html = await res.text();
  const $ = cheerio.load(html);
  const items: SearchResultItem[] = [];
  const seen = new Set<string>();

  $('a.result-link').each((_, el) => {
    if (items.length >= maxResults) return;
    const rawHref = $(el).attr('href') ?? '';
    if (rawHref.includes('duckduckgo.com/y.js') || rawHref.includes('ad_domain=')) return;
    const decoded = decodeDdgUrl(rawHref);
    if (!decoded) return;
    const safety = isSafePublicUrl(decoded);
    if (!safety.ok || seen.has(decoded)) return;

    const title = normalizeWhitespace($(el).text());
    const snippet = normalizeWhitespace(
      $(el).closest('tr').next('tr').find('.result-snippet').text(),
    );
    seen.add(decoded);
    items.push({
      title: title || decoded,
      url: decoded,
      snippet: snippet.slice(0, 320),
      source: 'duckduckgo-lite',
    });
  });

  return items;
}

async function searchWikipediaFallback(
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&srlimit=${Math.min(maxResults, 6)}&format=json&origin=*`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PantheonBotManager/2.0' },
    signal: combineSignals(signal, 8_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: { search?: Array<{ title: string; snippet: string }> };
  };
  return (data.query?.search ?? []).map((item) => ({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    snippet: cheerio.load(item.snippet).text().trim(),
    source: 'wikipedia',
  }));
}

export async function searchWeb(
  query: string,
  options: {
    maxResults?: number;
    searchProvider?: SearchProvider;
    searchApiKey?: string;
    signal?: AbortSignal;
  } = {},
): Promise<SearchResultItem[]> {
  const maxResults = Math.min(Math.max(options.maxResults ?? 8, 1), 15);
  const provider = options.searchProvider ?? 'auto';
  const key = options.searchApiKey?.trim();

  if (key && (provider === 'tavily' || (provider === 'auto' && key.startsWith('tvly-')))) {
    try {
      const results = await searchTavily(query, key, maxResults, options.signal);
      if (results.length > 0) return results;
    } catch {
      // fall through
    }
  }

  if (key && (provider === 'brave' || provider === 'auto')) {
    try {
      const results = await searchBrave(query, key, maxResults, options.signal);
      if (results.length > 0) return results;
    } catch {
      // fall through
    }
  }

  try {
    const htmlResults = await searchDuckDuckGoHtml(query, maxResults, options.signal);
    if (htmlResults.length > 0) return htmlResults;
  } catch {
    // fall through
  }

  try {
    const liteResults = await searchDuckDuckGoLite(query, maxResults, options.signal);
    if (liteResults.length > 0) return liteResults;
  } catch {
    // fall through
  }

  try {
    return await searchWikipediaFallback(query, maxResults, options.signal);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Deep Website Scraper & HTML-to-Structured-Markdown Extractor               */
/* -------------------------------------------------------------------------- */

function isSkippableAssetUrl(url: URL): boolean {
  return /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|mp3|avi|mov|zip|tar|gz|dmg|exe|css|js)$/i.test(
    url.pathname,
  );
}

export async function scrapeUrl(
  rawUrl: string,
  options: { depth?: number; maxChars?: number; signal?: AbortSignal } = {},
): Promise<ScrapePageResult> {
  const nowIso = new Date().toISOString();
  const depth = options.depth ?? 0;
  const maxChars = options.maxChars ?? MAX_MARKDOWN_CHARS;

  const safety = isSafePublicUrl(rawUrl);
  if (!safety.ok || !safety.url) {
    return {
      source: {
        id: makeSourceId(),
        url: rawUrl,
        title: rawUrl,
        domain: 'invalid',
        scrapedAt: nowIso,
        wordCount: 0,
        excerpt: safety.reason ?? 'Blocked URL',
        linksFound: 0,
        depth,
        status: 'error',
        error: safety.reason ?? 'Blocked URL',
      },
      markdown: `Error: ${safety.reason ?? 'Invalid URL'}`,
      links: [],
    };
  }

  const targetUrl = safety.url;
  const domain = targetUrl.hostname.replace(/^www\./, '');

  try {
    const res = await fetch(targetUrl.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: combineSignals(options.signal),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    const rawBody = (await res.text()).slice(0, MAX_BODY_CHARS);
    const finalUrl = res.url ? new URL(res.url) : targetUrl;
    const finalDomain = finalUrl.hostname.replace(/^www\./, '');

    // Non-HTML plain text / JSON handling
    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      const cleaned = rawBody.slice(0, maxChars).trim();
      const wordCount = cleaned ? cleaned.split(/\s+/).length : 0;
      return {
        source: {
          id: makeSourceId(),
          url: finalUrl.toString(),
          title: `${finalDomain}${finalUrl.pathname}`,
          domain: finalDomain,
          scrapedAt: nowIso,
          wordCount,
          excerpt: cleaned.slice(0, 260),
          linksFound: 0,
          depth,
          status: 'ok',
        },
        markdown: cleaned,
        links: [],
      };
    }

    const $ = cheerio.load(rawBody);
    const title =
      normalizeWhitespace($('title').first().text()) ||
      normalizeWhitespace($('meta[property="og:title"]').attr('content') ?? '') ||
      normalizeWhitespace($('h1').first().text()) ||
      finalUrl.toString();

    const metaDesc = normalizeWhitespace(
      $('meta[name="description"]').attr('content') ??
        $('meta[property="og:description"]').attr('content') ??
        '',
    );

    // Extract links BEFORE stripping nav/footer so deep crawlers can discover /pricing, /rooms, /contact, etc.
    const linkMap = new Map<string, DiscoveredLink>();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      try {
        const resolved = new URL(href, finalUrl);
        resolved.hash = '';
        if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;
        if (isSkippableAssetUrl(resolved)) return;
        const resolvedSafety = isSafePublicUrl(resolved.toString());
        if (!resolvedSafety.ok) return;

        const key = resolved.toString();
        if (key === finalUrl.toString() || linkMap.has(key)) return;

        const anchorText = normalizeWhitespace($(el).text()).slice(0, 100);
        const linkDomain = resolved.hostname.replace(/^www\./, '');
        linkMap.set(key, {
          url: key,
          text: anchorText || resolved.pathname,
          sameDomain: linkDomain === finalDomain || linkDomain.endsWith(`.${finalDomain}`),
        });
      } catch {
        // ignore malformed href
      }
    });

    // Remove non-content noise
    $(
      'script, style, noscript, svg, iframe, template, canvas, form[role="search"], .cookie-banner, #cookie-banner, [aria-hidden="true"]',
    ).remove();

    const mainCandidate = $('main, article, [role="main"]').first();
    const rootEl =
      mainCandidate.length > 0 && normalizeWhitespace(mainCandidate.text()).length > 250
        ? mainCandidate
        : $('body');

    const sections: string[] = [];
    if (title) sections.push(`# ${title}`);
    if (metaDesc) sections.push(`> ${metaDesc}`);

    // Extract structured blocks: headings, paragraphs, list items, tables
    const seenBlocks = new Set<string>();
    rootEl.find('h1, h2, h3, h4, p, li, table, blockquote, pre').each((_, el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'table') {
        const rows: string[] = [];
        $(el)
          .find('tr')
          .slice(0, 20)
          .each((rowIdx, tr) => {
            const cells: string[] = [];
            $(tr)
              .find('th, td')
              .slice(0, 8)
              .each((__, cell) => {
                cells.push(normalizeWhitespace($(cell).text()).replace(/\|/g, '/'));
              });
            if (cells.length > 0 && cells.some(Boolean)) {
              rows.push(`| ${cells.join(' | ')} |`);
              if (rowIdx === 0) {
                rows.push(`| ${cells.map(() => '---').join(' | ')} |`);
              }
            }
          });
        if (rows.length > 0) {
          const tableBlock = rows.join('\n');
          if (!seenBlocks.has(tableBlock)) {
            seenBlocks.add(tableBlock);
            sections.push(tableBlock);
          }
        }
        return;
      }

      // Skip paragraphs/li nested inside tables we already extracted
      if ($(el).parents('table').length > 0) return;

      const text = normalizeWhitespace($(el).text());
      if (text.length < 3 || seenBlocks.has(text)) return;
      seenBlocks.add(text);

      if (tag === 'h1') sections.push(`\n## ${text}`);
      else if (tag === 'h2') sections.push(`\n### ${text}`);
      else if (tag === 'h3' || tag === 'h4') sections.push(`\n#### ${text}`);
      else if (tag === 'li') sections.push(`- ${text}`);
      else if (tag === 'blockquote') sections.push(`> ${text}`);
      else if (tag === 'pre') sections.push(`\`\`\`\n${text.slice(0, 1200)}\n\`\`\``);
      else sections.push(text);
    });

    let markdown = normalizeWhitespace(sections.join('\n\n'));
    if (markdown.length < 180) {
      markdown = normalizeWhitespace(rootEl.text());
    }
    const truncatedMarkdown =
      markdown.length > maxChars
        ? `${markdown.slice(0, maxChars)}\n\n...[truncated at ${maxChars} chars]`
        : markdown;

    const wordCount = markdown ? markdown.split(/\s+/).length : 0;
    const excerpt = (metaDesc || markdown.replace(/^#.*\n+/, '')).slice(0, 260).trim();
    const links = Array.from(linkMap.values());

    return {
      source: {
        id: makeSourceId(),
        url: finalUrl.toString(),
        title,
        domain: finalDomain,
        scrapedAt: nowIso,
        wordCount,
        excerpt,
        linksFound: links.length,
        depth,
        status: 'ok',
      },
      markdown: truncatedMarkdown,
      links,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch URL';
    return {
      source: {
        id: makeSourceId(),
        url: rawUrl,
        title: domain,
        domain,
        scrapedAt: nowIso,
        wordCount: 0,
        excerpt: `Scrape failed: ${message}`,
        linksFound: 0,
        depth,
        status: 'error',
        error: message,
      },
      markdown: `Scrape error for ${rawUrl}: ${message}`,
      links: [],
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Deep Recursive Multi-Page Website Crawler                                  */
/* -------------------------------------------------------------------------- */

const LOW_VALUE_PATH_PATTERN =
  /\/(login|signin|sign-in|signup|register|cart|checkout|privacy|terms|cookie|legal|wp-json|feed|tag\/|author\/|share|print)/i;

const LOCALE_PREFIX_PATTERN =
  /^\/(en|fr|de|es|it|pt|nl|ja|zh|ko|ru|ar|tr|pl|sv|no|da|fi|el|cs|hu|ro|uk|vi|th|id|he|zh-cn|zh-tw|pt-br|en-us|en-gb)(?:\/|$)/i;

function extractLocalePrefix(rawUrl: string): string | null {
  try {
    const match = new URL(rawUrl).pathname.match(LOCALE_PREFIX_PATTERN);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function scoreLinkRelevance(
  link: DiscoveredLink,
  keywords: string[],
  allowExternal: boolean,
  startLocale: string | null,
): number {
  if (!link.sameDomain && !allowExternal) return -1;
  if (LOW_VALUE_PATH_PATTERN.test(link.url)) return -1;

  // Skip alternate-language mirrors of the same site so crawl budget goes to unique content pages
  const linkLocale = extractLocalePrefix(link.url);
  if (linkLocale && linkLocale !== (startLocale ?? 'en')) {
    return -1;
  }

  const haystack = `${link.url.toLowerCase()} ${link.text.toLowerCase()}`;
  let score = link.sameDomain ? 2 : 0.5;

  for (const kw of keywords) {
    if (kw.length >= 2 && haystack.includes(kw)) {
      score += 4;
    }
  }

  // Boost high-signal informational paths
  if (
    /\/(price|pricing|rooms|rates|amenities|menu|docs|guide|features|about|faq|policy|contact|reviews|details|specs|listings|apartments|hotels|booking)/i.test(
      link.url,
    )
  ) {
    score += 3;
  }

  return score;
}

export async function deepCrawlSite(
  startUrl: string,
  options: {
    focusKeywords?: string[];
    maxPages?: number;
    maxDepth?: number;
    allowExternal?: boolean;
    onPageScraped?: (source: ScrapedSource) => void;
    signal?: AbortSignal;
  } = {},
): Promise<DeepCrawlResult> {
  const maxPages = Math.min(Math.max(options.maxPages ?? 5, 1), 12);
  const maxDepth = Math.min(Math.max(options.maxDepth ?? 2, 0), 3);
  const allowExternal = Boolean(options.allowExternal);
  const keywords = (options.focusKeywords ?? [])
    .flatMap((k) => k.toLowerCase().split(/\s+/))
    .filter((k) => k.length >= 2);

  const visited = new Set<string>();
  const startLocale = extractLocalePrefix(startUrl);
  const queue: Array<{ url: string; depth: number; score: number }> = [
    { url: startUrl, depth: 0, score: 100 },
  ];
  const sources: ScrapedSource[] = [];
  const dossierSections: string[] = [];

  while (queue.length > 0 && sources.length < maxPages) {
    if (options.signal?.aborted) break;

    // Pick highest-relevance batch (concurrency = 2 for polite fast crawling)
    queue.sort((a, b) => b.score - a.score || a.depth - b.depth);
    const batch: Array<{ url: string; depth: number; score: number }> = [];
    while (
      queue.length > 0 &&
      batch.length < 2 &&
      sources.length + batch.length < maxPages
    ) {
      const next = queue.shift()!;
      const normKey = next.url.replace(/\/$/, '');
      if (visited.has(normKey)) continue;
      visited.add(normKey);
      batch.push(next);
    }

    if (batch.length === 0) break;

    const results = await Promise.all(
      batch.map((item) =>
        scrapeUrl(item.url, {
          depth: item.depth,
          maxChars: Math.max(3200, Math.floor(14_000 / maxPages)),
          signal: options.signal,
        }),
      ),
    );

    for (let i = 0; i < results.length; i++) {
      const pageResult = results[i];
      const item = batch[i];
      sources.push(pageResult.source);
      options.onPageScraped?.(pageResult.source);

      if (pageResult.source.status === 'ok') {
        dossierSections.push(
          `=== PAGE (depth ${item.depth}): ${pageResult.source.title} ===\nURL: ${pageResult.source.url}\nWords: ${pageResult.source.wordCount}\n\n${pageResult.markdown}`,
        );

        if (item.depth < maxDepth) {
          for (const link of pageResult.links) {
            const normLink = link.url.replace(/\/$/, '');
            if (visited.has(normLink)) continue;
            const score = scoreLinkRelevance(link, keywords, allowExternal, startLocale);
            if (score > 0) {
              queue.push({ url: link.url, depth: item.depth + 1, score });
            }
          }
        }
      }
    }
  }

  return {
    startUrl,
    pagesCrawled: sources.length,
    sources,
    combinedDossier:
      dossierSections.join('\n\n---\n\n') ||
      `No readable content extracted from ${startUrl}.`,
  };
}
