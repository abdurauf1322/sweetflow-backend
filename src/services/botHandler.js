/**
 * Telegram Bot Handler — Incoming message processor
 *
 * Handles:
 *   /start  → asks the store owner to share their phone number
 *   contact → matches the phone to a store in DB and saves the chatId automatically
 *
 * This module uses polling: true (separate bot instance for receiving).
 * The sending bot in telegramService.js keeps polling: false to avoid conflicts.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

let TelegramBot = require('node-telegram-bot-api');
if (typeof TelegramBot !== 'function' && TelegramBot.default) {
  TelegramBot = TelegramBot.default;
}

const prisma = require('../utils/prisma');

let TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN || TOKEN === 'your_bot_token') {
  TOKEN = '8834308999:AAFdp0kt8fGq0RnPulGQ29oiJJRYfaypwkM';
}

let pollingBot = null;

/**
 * Normalize phone numbers to +998XXXXXXXXX format for comparison.
 * Handles: 998901234567, +998901234567, 0901234567, 901234567
 */
const normalizePhone = (raw = '') => {
  let digits = String(raw).replace(/\D/g, ''); // keep digits only
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+998${digits.slice(1)}`;
  if (digits.length === 9) return `+998${digits}`;
  return `+${digits}`;
};

/**
 * Initialize the polling bot.
 * Called once from server.js at startup.
 */
const initBotHandler = () => {
  if (pollingBot) return; // already running

  try {
    pollingBot = new TelegramBot(TOKEN, {
      polling: {
        interval: 2000,      // poll every 2 seconds
        autoStart: true,
        params: { timeout: 10 },
      },
    });

    console.log('🤖 [Bot Handler] Telegram bot polling ishga tushdi.');

    // ──────────────────────────────────────────────
    // /start command → request contact
    // ──────────────────────────────────────────────
    pollingBot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const firstName = msg.from?.first_name || "Do'kondor";

      await pollingBot.sendMessage(
        chatId,
        `Assalomu alaykum! 🍫\n<b>SweetFlow Distribyutsiya</b> tizimi botiga xush kelibsiz.\n\nHisobingizni ulash uchun pastdagi tugmani bosing:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              [{ text: '📱 Telefon raqamimni ulashish', request_contact: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    });

    // ──────────────────────────────────────────────
    // Contact received → find store → save chatId
    // ──────────────────────────────────────────────
    pollingBot.on('contact', async (msg) => {
      const chatId = msg.chat.id;
      const contact = msg.contact;

      if (!contact || !contact.phone_number) {
        return pollingBot.sendMessage(chatId, "Telefon raqami aniqlanmadi.", {
          reply_markup: { remove_keyboard: true }
        });
      }

      let phone = contact.phone_number;
      // Faqat raqamlarni qoldirish (masalan: +998901234567 -> 998901234567)
      const cleanPhone = phone.replace(/[^0-9]/g, '');

      console.log(`📱 [Bot] Kontakt keldi: ${phone} → tozalangan: ${cleanPhone} (chat_id: ${chatId})`);

      try {
        // Bazadan shu raqamli barcha do'konlarni qidirish
        const stores = await prisma.store.findMany({
          where: {
            isDeleted: false,
            phone: {
              contains: cleanPhone.slice(-9)
            }
          }
        });

        if (!stores || stores.length === 0) {
          console.warn(`[Bot] Do'kon topilmadi: ${cleanPhone}`);
          return pollingBot.sendMessage(
            chatId, 
            `❌ Kechirasiz, <b>+998${cleanPhone.slice(-9)}</b> raqamiga biriktirilgan do'kon tizimdan topilmadi.\nIltimos, yetkazib beruvchi bilan bog'laning.`,
            {
              parse_mode: 'HTML',
              reply_markup: { remove_keyboard: true }
            }
          );
        }

        // Do'konlarga chat_id ni bog'lash
        for (const store of stores) {
          await prisma.store.update({
            where: { id: store.id },
            data: { telegramChatId: String(chatId) }
          });
        }

        const storeNames = stores.map(s => s.name).join(', ');
        console.log(`✅ [Bot] Do'konlar ulandi: "${storeNames}" → chatId: ${chatId}`);

        await pollingBot.sendMessage(
          chatId, 
          `✅ <b>Tabriklaymiz!</b>\n\nDo'koningiz (<b>${storeNames}</b>) tizimga muvaffaqiyatli ulandi!\nEndi barcha yuk xatlari va to'lov eslatmalari shu yerga yuboriladi.`,
          {
            parse_mode: 'HTML',
            reply_markup: { remove_keyboard: true }
          }
        );
      } catch (error) {
        console.error("Bot contact error:", error);
        await pollingBot.sendMessage(chatId, "Tizimda texnik xatolik yuz berdi. Iltimos, keyinroq urinib ko'ring.", {
          reply_markup: { remove_keyboard: true }
        });
      }
    });

    // ──────────────────────────────────────────────
    // Polling error handler — prevents server crash
    // ──────────────────────────────────────────────
    pollingBot.on('polling_error', (err) => {
      // Ignore common network timeouts silently
      if (err.code === 'ETELEGRAM' || err.message?.includes('ECONNRESET')) return;
      console.error('[Bot] Polling xatosi:', err.message);
    });

    pollingBot.on('error', (err) => {
      console.error('[Bot] Bot xatosi:', err.message);
    });

  } catch (err) {
    console.error('[Bot Handler] Botni ishga tushirishda xato:', err.message);
  }
};

module.exports = { initBotHandler };
