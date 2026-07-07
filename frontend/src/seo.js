// Lightweight runtime head manager for the SPA (no dependencies).
// The crawler-facing defaults live in index.html; these helpers keep
// title/canonical/robots correct as the client-side view changes.

const upsertMeta = (name, content) => {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

export function setPageMeta({ title, description, canonical, robots } = {}) {
  if (title) document.title = title;
  if (description) upsertMeta('description', description);
  if (robots) upsertMeta('robots', robots);
  if (canonical) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);
  }
}

export const HOME_META = {
  title: 'Flasqo — AI-Powered API Testing Platform | Free Postman Alternative',
  description:
    'Flasqo auto-generates and runs API tests with AI — functional, smoke, load, regression, contract, GraphQL, fuzz and chaos testing in one free platform. Paste a URL, get a full test suite in minutes.',
  // The landing page renders for logged-out visitors on every path, so all
  // of those URLs canonicalize to the homepage.
  canonical: 'https://flasqo.com/',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1',
};

// Auth-gated tools and user-generated shared reports must never be indexed.
export const NOINDEX_META = { robots: 'noindex, nofollow' };
