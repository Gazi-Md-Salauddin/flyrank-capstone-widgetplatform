const crypto = require('node:crypto');
const { HttpError } = require('../utils/http-error');

function createOwnerAuthenticator({ expectedToken, tenantId, resolveTenant }) {
  const expectedDigest = expectedToken
    ? crypto.createHash('sha256').update(expectedToken).digest()
    : null;

  return function requireOwner(request, response, next) {
    const authorization = request.get('authorization') || '';
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) return next(new HttpError(401, 'Authentication required'));

    let resolvedTenant = null;
    if (resolveTenant) {
      resolvedTenant = resolveTenant(match[1]);
    } else if (expectedDigest) {
      const suppliedDigest = crypto.createHash('sha256').update(match[1]).digest();
      if (crypto.timingSafeEqual(expectedDigest, suppliedDigest)) resolvedTenant = tenantId;
    }

    if (!resolvedTenant) return next(new HttpError(401, 'Authentication required'));
    request.ownerTenantId = resolvedTenant;
    return next();
  };
}

module.exports = { createOwnerAuthenticator };
