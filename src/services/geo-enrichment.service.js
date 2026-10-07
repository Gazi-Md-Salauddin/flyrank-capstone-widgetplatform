const { isIP } = require('node:net');

const MOCK_GEO = {
  country: 'Exampleland',
  country_code: 'EX',
  region: 'Example Region',
  city: 'Example City'
};

function usableGeo(value) {
  return value && typeof value === 'object'
    && typeof value.country === 'string'
    && typeof value.country_code === 'string'
    ? value
    : null;
}

function createGeoEnrichmentService({
  providerAMode = 'live',
  providerBMode = 'live',
  fetchImpl = fetch,
  timeoutMs = 3000
} = {}) {
  async function callProvider(mode, provider, ip) {
    if (mode === 'fail') throw new Error(`${provider} unavailable`);
    if (mode === 'mock') return MOCK_GEO;

    const url = provider === 'A'
      ? `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city`
      : `https://ipapi.co/${encodeURIComponent(ip)}/json/`;

    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`${provider} returned an unsuccessful response`);
    const data = await response.json();

    if (provider === 'A') {
      if (data.status !== 'success') return null;
      return usableGeo({
        country: data.country,
        country_code: data.countryCode,
        region: data.regionName || null,
        city: data.city || null
      });
    }

    if (data.error) return null;
    return usableGeo({
      country: data.country_name,
      country_code: data.country_code,
      region: data.region || null,
      city: data.city || null
    });
  }

  return {
    async enrich(ip) {
      if (!ip || !isIP(ip)) return null;

      try {
        const result = await callProvider(providerAMode, 'A', ip);
        if (result) return { ...result, provider: 'ip-api.com' };
      } catch {
        console.warn('[geo] Provider A failed; trying provider B');
      }

      try {
        const result = await callProvider(providerBMode, 'B', ip);
        if (result) return { ...result, provider: 'ipapi.co' };
      } catch {
        console.warn('[geo] Provider B failed; continuing without geo data');
      }

      return null;
    }
  };
}

module.exports = { createGeoEnrichmentService };
