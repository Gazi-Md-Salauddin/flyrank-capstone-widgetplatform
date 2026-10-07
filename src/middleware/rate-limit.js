function createSubmissionRateLimiter({ maxRequests, windowMs, now = Date.now }) {
  const buckets = new Map();
  let operations = 0;

  return function submissionRateLimit(request, response, next) {
    const ip = request.clientIp || 'unknown';
    const keys = [`ip:${ip}`];
    const timestamp = now();

    operations += 1;
    if (operations % 100 === 0 || buckets.size > 10000) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= timestamp) buckets.delete(key);
      }
    }

    const currentBuckets = keys.map((key) => buckets.get(key));
    const blocked = currentBuckets.some(
      (bucket) => bucket && bucket.resetAt > timestamp && bucket.count >= maxRequests
    );

    if (blocked) {
      const resetAt = Math.max(...currentBuckets.map(
        (bucket) => bucket && bucket.resetAt > timestamp ? bucket.resetAt : timestamp + windowMs
      ));
      response.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - timestamp) / 1000))));
      return response.status(429).json({ success: false, message: 'Too many submissions' });
    }

    for (const key of keys) {
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= timestamp) {
        buckets.set(key, { count: 1, resetAt: timestamp + windowMs });
      } else {
        bucket.count += 1;
      }
    }
    return next();
  };
}

module.exports = { createSubmissionRateLimiter };
