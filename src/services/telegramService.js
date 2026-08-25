const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

let TelegramBot = require('node-telegram-bot-api');
if (typeof TelegramBot !== 'function' && TelegramBot.default) {
  TelegramBot = TelegramBot.default;
}

// Yangi va tasdiqlangan Token
let TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN || TOKEN === 'your_bot_token') {
  TOKEN = "8971949755:AAHNjskCPfazqQeU-BccciQF7ckehl_dWLg";
}

// Singleton Pattern: Ensure bot is only instantiated once
if (!global.__telegramBotInstance) {
  global.__telegramBotInstance = new TelegramBot(TOKEN, { polling: false });
}
const bot = global.__telegramBotInstance;

console.log("✅ Telegram Bot xizmati tayyor va faol! (Singleton)");

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
`🍫 Qandchi Bola Distribyutsiya Tizimi

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

  const formatMoney = (amount) => {
    return Number(amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const formattedTotal = formatMoney(order.totalAmount || 0);
  const paidAmountVal = Number(order.paidAmount) || (Number(order.totalAmount || 0) - Number(order.debtAmount || 0));
  const formattedPaid = formatMoney(paidAmountVal);
  const formattedDebt = formatMoney(order.debtAmount || 0);
  const currentTotalDebt = Number(store.currentDebt || 0) + Number(order.debtAmount || 0);
  const formattedCurrentDebt = formatMoney(currentTotalDebt);

  let totalBoxes = 0;
  let totalItems = 0;

  let itemsText = '';
  if (order.items && order.items.length > 0) {
    itemsText = order.items.map((item) => {
      const total = formatMoney(item.totalPrice);
      const quantityInBox = item.product?.quantityInBox || 1;
      
      let countText = '';
      if (item.unitType === 'BOX') {
         if (quantityInBox > 1) {
             countText = `${item.quantity} blok (yoki ${item.quantity * quantityInBox} dona)`;
         } else {
             countText = `${item.quantity} blok`;
         }
         totalBoxes += item.quantity;
         totalItems += item.quantity * quantityInBox;
      } else {
         countText = `${item.quantity} dona`;
         totalItems += item.quantity;
      }

      const productName = item.product?.name || item.productName || 'Mahsulot';
      const piecePrice = item.product?.piecePrice || (item.unitType === 'PIECE' ? item.price : Math.round(item.price / (quantityInBox || 1)));
      const boxPrice = item.product?.boxPrice;

      let itemStr = `🛒 ${productName}\n📦 Soni: ${countText}\n💵 Dona narxi: ${formatMoney(piecePrice)} so'm`;
      
      if (boxPrice) {
         itemStr += `\n📦 Blok narxi: ${formatMoney(boxPrice)} so'm`;
      }
      
      itemStr += `\n💰 Summa: ${total} so'm`;
      
      return itemStr;
    }).join('\n\n');
  }

  const messageText = 
`👤 ${store.name} (${store.ownerName || "Noma'lum"})
━━━━━━━━━━━━━━━━━━
📢 Bugungi savdolar:

${itemsText}

📊 Jami: ${totalBoxes > 0 ? `${totalBoxes} blok / ` : ''}${totalItems} dona | ${formattedTotal} so'm
💵 Berilgan (Naqd/Karta to'langan): ${formattedPaid} so'm
💰 Olingan (Nasiya/Qarz to'lovi): ${formattedDebt} so'm
📈 Bugungi savdo: ${formattedTotal} so'm
💼 Yakuniy qoldiq (Do'konning jami qarzi): ${formattedCurrentDebt} so'm`;

  try {
    const result = await bot.sendMessage(numericChatId, messageText);
    console.log(`✅ Yuk xati Telegramga yuborildi. ChatID: ${numericChatId}`);
    return result;
  } catch (error) {
    console.error('❌ TELEGRAM INVOICE ERROR:', error.response?.body || error.message);
    throw new Error("Telegram invoice error");
  }
};

/**
 * Do'konga to'lov qabul qilinganligi haqida xabar yuborish
 */
const sendPaymentReceipt = async (chatId, storeName, amount, discount, remainingDebt) => {
  if (!chatId) return;

  const numericChatId = Number(String(chatId).trim());
  if (isNaN(numericChatId)) return;

  const formattedAmount = Number(amount || 0).toLocaleString('uz-UZ');
  const formattedDiscount = Number(discount || 0).toLocaleString('uz-UZ');
  const formattedDebt = Number(remainingDebt || 0).toLocaleString('uz-UZ');

  const messageText = 
`✅ <b>TO'LOV QABUL QILINDI</b>
Do'kon: <b>${storeName}</b>

<b>To'langan summa:</b> ${formattedAmount} so'm
${discount > 0 ? `🎁 <b>Berilgan chegirma:</b> ${formattedDiscount} so'm\n` : ''}💰 <b>Qolgan qarz:</b> ${formattedDebt} so'm

<i>To'lov uchun rahmat! Qandchi Bola Distribyutsiya</i> 🍫`;

  try {
    const result = await bot.sendMessage(numericChatId, messageText, { parse_mode: 'HTML' });
    console.log(`✅ To'lov cheki Telegramga yuborildi. ChatID: ${numericChatId}`);
    return result;
  } catch (error) {
    console.error('❌ TELEGRAM PAYMENT RECEIPT ERROR:', error.response?.body || error.message);
  }
};

module.exports = { sendDebtReminder, sendAlert, sendOrderInvoice, sendPaymentReceipt, bot };
