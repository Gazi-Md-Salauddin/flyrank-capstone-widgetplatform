const net = require('node:net');

function getClientIp(request) {
  const address = request.socket.remoteAddress || request.ip;
  if (typeof address !== 'string') return null;

  const normalized = address.startsWith('::ffff:') ? address.slice(7) : address;
  return net.isIP(normalized) ? normalized : null;
}

module.exports = { getClientIp };
