const cron = require('node-cron');
const Banner = require('../models/bannerSchema')


cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();

    // Activate banners within date range
    await Banner.updateMany(
      { startDate: { $lte: now }, endDate: { $gte: now } },
      { $set: { isActive: true } }
    );

    // Deactivate banners outside date range
    await Banner.updateMany(
      { $or: [{ startDate: { $gt: now } }, { endDate: { $lt: now } }] },
      { $set: { isActive: false } }
    );

    console.log(`[Cron] Banner status updated at ${now}`);
  } catch (error) {
    console.error('[Cron] Error updating banners:', error);
  }
});
