const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

let TelegramBot = require('node-telegram-bot-api');
if (typeof TelegramBot !== 'function' && TelegramBot.default) {
  TelegramBot = TelegramBot.default;
}

// Yangi va tasdiqlangan Token
let TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN || TOKEN === 'your_bot_token') {
  TOKEN = "8834308999:AAFdp0kt8fGq0RnPulGQ29oiJJRYfaypwkM";
}

const bot = new TelegramBot(TOKEN, { polling: false });

console.log("✅ Telegram Bot xizmati tayyor va faol!");

/**
 * Tizim ogohlantirishlarini yuborish (cronJobs uchun)
 */
const sendAlert = async (message) => {
  if (!bot) return { success: false, error: 'Telegram bot not configured' };
  
  const chatId = process.env.TELEGRAM_CHAT_ID;
  console.log(`[Telegram Service] Preparing alert: "${message}"`);

  try {
    const response = await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    console.log('[Telegram Service] Alert sent successfully.');
    return { success: true, data: response };
  } catch (error) {
    console.error('[Telegram Service] Failed to send Telegram alert:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Do'konga qarz ogohlantirishini yuborish funksiyasi
 * @param {string|number} chatId    - Do'konning Telegram Chat ID si
 * @param {string}        storeName - Do'kon nomi
 * @param {number}        currentDebt - Joriy qarz miqdori (so'm)
 * @param {number}        remainingDays - To'lov muddatigacha qolgan kunlar (manfiy = kechikkan)
 */
const sendDebtReminder = async (chatId, storeName, currentDebt = 0, remainingDays = 0) => {
  if (!chatId) {
    throw new Error("Do'konning Telegram Chat ID'si kiritilmagan!");
  }

  // Chat ID'ni raqamga xavfsiz o'girish
  const numericChatId = Number(String(chatId).trim());
  if (isNaN(numericChatId)) {
    throw new Error("Chat ID faqat raqamlardan iborat bo'lishi kerak!");
  }

  // Raqamlarni chiroyli formatlash
  const formattedDebt = Number(currentDebt || 0).toLocaleString('uz-UZ');

  // Dinamik holat satri
  let statusLine;
  if (remainingDays < 0) {
    statusLine = `🔴 Muddat ${Math.abs(remainingDays)} kun oldin o'tib ketdi!`;
  } else if (remainingDays === 0) {
    statusLine = `🔴 Bugun to'lovning so'nggi kuni!`;
  } else {
    statusLine = `🟡 To'lov muddatigacha: ${remainingDays} kun qoldi.`;
  }

  const messageText =
`🍫 SweetFlow Ulgurji B2B

Hurmatli ${storeName}!
Sizning joriy qarzdorligingiz: ${formattedDebt} so'm.
${statusLine}

Iltimos, to'lovni o'z vaqtida amalga oshiring!`;

  try {
    const result = await bot.sendMessage(numericChatId, messageText);
    console.log(`✅ Telegram xabar [${numericChatId}] IDga muvaffaqiyatli yuborildi. Msg ID: ${result.message_id}`);
    return result;
  } catch (error) {
    console.error('❌ TELEGRAM API ERROR:', error.response?.body || error.message);
    throw new Error(error.response?.body?.description || error.message || "Telegram API bilan aloqa o'rnatishta xatolik");
  }
};

/**
 * Do'konga yuk xati (chek) yuborish funksiyasi
 * @param {string|number} chatId - Do'konning Telegram Chat ID si
 * @param {object} order - Yaratilgan buyurtma ma'lumotlari
 * @param {object} store - Do'kon ma'lumotlari
 */
const sendOrderInvoice = async (chatId, order, store) => {
  if (!chatId) return;

  const numericChatId = Number(String(chatId).trim());
  if (isNaN(numericChatId)) return;

  const formattedTotal = Number(order.totalAmount || 0).toLocaleString('uz-UZ');
  const paidAmountVal = Number(order.paidAmount) || (Number(order.totalAmount || 0) - Number(order.debtAmount || 0));
  const formattedPaid = Number(paidAmountVal || 0).toLocaleString('uz-UZ');
  const formattedDebt = Number(order.debtAmount || 0).toLocaleString('uz-UZ');
  const currentTotalDebt = Number(store.currentDebt || 0) + Number(order.debtAmount || 0);
  const formattedCurrentDebt = currentTotalDebt.toLocaleString('uz-UZ');

  let itemsText = '';
  if (order.items && order.items.length > 0) {
    itemsText = order.items.map((item, index) => {
      const price = Number(item.price || 0).toLocaleString('uz-UZ');
      const total = Number(item.totalPrice || 0).toLocaleString('uz-UZ');
      return `${index + 1}. ${item.product?.name || item.productName || 'Mahsulot'} - ${item.quantity} ${item.unitType === 'BOX' ? 'quti' : 'dona'} x ${price} s = ${total} s`;
    }).join('\n');
  }

  const messageText = 
`🧾 <b>YANGI YUK XATI</b>
Do'kon: <b>${store.name}</b>

${itemsText}

---------------------------------
<b>Umumiy summa:</b> ${formattedTotal} so'm
<b>To'landi:</b> ${formattedPaid} so'm
<b>Qarz (bu xarid):</b> ${formattedDebt} so'm
<b>Umumiy qarz:</b> ${formattedCurrentDebt} so'm

<i>Xaridingiz uchun rahmat! SweetFlow B2B</i> 🍫`;

  try {
    const result = await bot.sendMessage(numericChatId, messageText, { parse_mode: 'HTML' });
    console.log(`✅ Yuk xati Telegramga yuborildi. ChatID: ${numericChatId}`);
    return result;
  } catch (error) {
    console.error('❌ TELEGRAM INVOICE ERROR:', error.response?.body || error.message);
    throw new Error("Telegram invoice error");
  }
};

module.exports = { sendDebtReminder, sendAlert, sendOrderInvoice, bot };
