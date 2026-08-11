const cron = require('node-cron');
const prisma = require('../utils/prisma');
const telegramService = require('../services/telegramService');

// ─────────────────────────────────────────────────────────────────────────────
// Job 1: Check store overdue debts (original — marks orders as reminded via SMS)
// ─────────────────────────────────────────────────────────────────────────────
const checkOverdueDebts = async () => {
  console.log('[Cron Job] Running overdue debts check...');
  const now = new Date();

  try {
    const overdueOrders = await prisma.supplyOrder.findMany({
      where: {
        debtAmount: { gt: 0 },
        dueDate: { lte: now },
        isReminderSent: false,
      },
      include: {
        store: true,
      },
    });

    console.log(`[Cron Job] Found ${overdueOrders.length} overdue orders needing reminders.`);

    for (const order of overdueOrders) {
      const store = order.store;

      // Mark the order as reminder sent regardless of channel
      await prisma.supplyOrder.update({
        where: { id: order.id },
        data: { isReminderSent: true },
      });

      console.log(`[Cron Job] Marked order ${order.id.slice(0, 8)} as reminder sent for store: ${store.name}`);
    }
  } catch (error) {
    console.error('[Cron Job] Error checking overdue debts:', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Job 2: Check low stock counts and send Telegram alert to admin
// ─────────────────────────────────────────────────────────────────────────────
const checkLowStock = async () => {
  console.log('[Cron Job] Running low stock check...');

  try {
    const products = await prisma.product.findMany({
      where: {
        isLowStockAlertSent: false,
      },
      include: {
        category: true,
      },
    });

    const lowStockProducts = products.filter(
      (product) => product.stockCount <= product.minStockLimit
    );

    console.log(`[Cron Job] Found ${lowStockProducts.length} low stock products needing alerts.`);

    if (lowStockProducts.length === 0) return;

    let telegramMessage = `⚠️ <b>DIQQAT: MAHSULOTLAR ZAXIRASI KAM!</b>\n\nQuyidagi mahsulotlar qoldig'i belgilangan minimal limittan kam:\n\n`;

    const productIdsToUpdate = [];

    lowStockProducts.forEach((product, idx) => {
      telegramMessage += `${idx + 1}. <b>${product.name}</b> (Kategoriya: <i>${product.category?.name || "Noma'lum"}</i>)\n`;
      telegramMessage += `   Ombor qoldig'i: <b>${product.stockCount}</b> dona (Limit: ${product.minStockLimit} dona)\n\n`;
      productIdsToUpdate.push(product.id);
    });

    telegramMessage += `⚠️ <i>Iltimos, zaxiralarni yangilang!</i>`;

    const tgResult = await telegramService.sendAlert(telegramMessage);

    if (tgResult.success) {
      await prisma.product.updateMany({
        where: { id: { in: productIdsToUpdate } },
        data: { isLowStockAlertSent: true },
      });
      console.log(`[Cron Job] Marked ${productIdsToUpdate.length} products as low stock alert sent.`);
    }
  } catch (error) {
    console.error('[Cron Job] Error checking low stock:', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Job 3: Send Telegram reminders to stores whose payment deadline is ≤ 3 days
//         Uses the real dueDate from the latest unpaid SupplyOrder per store.
// ─────────────────────────────────────────────────────────────────────────────
const checkAndSendReminders = async () => {
  console.log('⏰ [CRON] Qarz muddatlari tekshirilmoqda...');

  try {
    // Fetch stores with outstanding debt AND a Telegram Chat ID
    const stores = await prisma.store.findMany({
      where: {
        isDeleted: false,
        currentDebt: { gt: 0 },
        telegramChatId: { not: null },
      },
      include: {
        // Get the single most-recent unpaid order to read its dueDate
        supplyOrders: {
          where: { debtAmount: { gt: 0 } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { dueDate: true, createdAt: true },
        },
      },
    });

    console.log(`⏰ [CRON] ${stores.length} ta qarzdor do'kon topildi.`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sentCount = 0;

    for (const store of stores) {
      const latestOrder = store.supplyOrders[0] || null;

      let remainingDays;
      const refRaw = latestOrder?.createdAt || store.updatedAt || store.createdAt;
      const refDate = new Date(refRaw);
      refDate.setHours(0, 0, 0, 0);
      const deadline = new Date(refDate);
      deadline.setDate(deadline.getDate() + (store.paymentDays || 30));
      remainingDays = Math.round((deadline - today) / (1000 * 60 * 60 * 24));

      // Only notify if deadline is within 3 days (including overdue)
      if (remainingDays <= 3) {
        const statusLabel =
          remainingDays < 0
            ? `${Math.abs(remainingDays)} kun kechikdi! ⚠️`
            : remainingDays === 0
            ? "Bugun so'nggi kun! 🔴"
            : `${remainingDays} kun qoldi ⏳`;

        console.log(`📨 Eslatma yuborilmoqda: ${store.name} — ${statusLabel}`);

        try {
          await telegramService.sendDebtReminder(
            store.telegramChatId,
            store.name,
            Number(store.currentDebt),
            remainingDays
          );
          sentCount++;
        } catch (botErr) {
          console.error(`❌ ${store.name} ga xabar yuborishda xato:`, botErr.message);
        }

        // 1-second delay to respect Telegram rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ [CRON] Avtomatik ogohlantirishlar yakunlandi. Yuborildi: ${sentCount} ta xabar.`);
  } catch (error) {
    console.error('💥 [CRON ERROR] checkAndSendReminders:', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Initialize all cron jobs — called once from server.js on startup
// ─────────────────────────────────────────────────────────────────────────────
const initCronJobs = () => {
  console.log('[Cron System] Initializing background tasks...');

  // ── Daily 09:00 AM: send debt reminders (3 kun va undan kam qolganlar)
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron System] 09:00 — Daily reminder job started.');
    await checkAndSendReminders();
  }, { timezone: 'Asia/Tashkent' });

  // ── Daily 09:05 AM: overdue debt marking + low-stock admin alert
  cron.schedule('5 9 * * *', async () => {
    console.log('[Cron System] 09:05 — Daily overdue & low-stock job started.');
    await checkOverdueDebts();
    await checkLowStock();
  }, { timezone: 'Asia/Tashkent' });

  console.log('🤖 [Cron System] Barcha vazifalar rejalashtirildi:');
  console.log('   • 09:00 — Qarz muddati eslatmalari (Telegram)');
  console.log('   • 09:05 — Kechikkan buyurtmalar va kam zaxira tekshiruvi');

  // ── Development dry-run: trigger after 8 seconds on startup for easy testing
  if (process.env.NODE_ENV === 'development') {
    console.log('[Cron System] Dev mode: test run starts in 8 seconds...');
    setTimeout(async () => {
      console.log('[Cron System] 🧪 Test run: checkAndSendReminders...');
      await checkAndSendReminders();
      console.log('[Cron System] 🧪 Test run: checkOverdueDebts + checkLowStock...');
      await checkOverdueDebts();
      await checkLowStock();
    }, 8000);
  }
};

module.exports = {
  initCronJobs,
  checkAndSendReminders,
  checkOverdueDebts,
  checkLowStock,
};
