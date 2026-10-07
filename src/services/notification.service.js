function createNotificationService({ mode = 'console' } = {}) {
  return {
    async notify(submission) {
      if (mode === 'fail') throw new Error('Simulated notification failure');
      console.info(`[notification] Confirmation simulated for submission ${submission.id}`);
    }
  };
}

module.exports = { createNotificationService };
