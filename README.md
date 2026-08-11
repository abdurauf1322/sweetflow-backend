# SweetFlow B2B Wholesale & Distribution System

B2B Ulgurji Shirinliklar va Shokoladlar Distributsiyasi boshqaruv platformasi. Ushbu loyiha do'konlarga shirinliklarni ulgurji tarqatish, raqamli yuk xatlari (Nakladnaya) rasmiylashtirish, nasiya va qarz limitlarini boshqarish hamda fonda avtomatik ogohlantirish yuborish uchun mo'ljallangan.

---

## 🛠 Texnologik Stek

* **Backend:** Node.js, Express.js, Prisma ORM, PostgreSQL, Zod, node-cron.
* **Frontend:** React.js, Tailwind CSS, Axios, Lucide React.
* **Integratsiyalar:** Eskiz.uz SMS API (Nasiya eslatmalari uchun) va Telegram Bot API (Ombor qoldig'i signallari uchun).

---

## 📂 Loyiha Strukturasi

```text
first/
├── prisma/
│   ├── schema.prisma         # Ma'lumotlar bazasi modellari
│   └── seed.js               # Boshlang'ich test ma'lumotlarini yuklash skripti
├── src/                      # Backend asosiy kodlari
│   ├── controllers/          # HTTP Handlerlar
│   ├── services/             # Biznes-logika va integratsiyalar (SMS, TG)
│   ├── repositories/         # Ma'lumotlar bazasiga to'g'ridan-to'g'ri so'rovlar
│   ├── middlewares/          # Global error handler va middleware'lar
│   ├── routes/               # Express Marshrutlari (Routelar)
│   ├── jobs/                 # Cron Job background workerlar
│   ├── validations/          # Zod validation sxemalari
│   ├── app.js                # Express app sozlamalari
│   └── server.js             # Serverni ishga tushirish (Kirish nuqtasi)
├── frontend/                 # React Frontend
│   ├── src/
│   │   ├── components/       # Shared UI
│   │   ├── pages/            # POS, CRM va Inventory sahifalari
│   │   ├── hooks/            # Custom React hooks (separation of concerns)
│   │   ├── services/         # api.js (Axios)
│   │   ├── App.jsx
│   │   └── index.css         # Tailwind & custom panel stillari
│   ├── package.json
│   ├── tailwind.config.cjs
│   └── vite.config.js
├── .env.example              # Backend sozlamalari shabloni
└── README.md                 # Ishga tushirish yo'riqnomasi
```

---

## 🚀 Ishga Tushirish Yo'riqnomasi (Setup Guide)

Loyihani mahalliy (local) kompyuterda ishga tushirish uchun quyidagi bosqichlarni bajaring:

### 1. Environment sozlamalari (.env)

Loyiha ildiz (root) papkasida `.env` nomli fayl yarating va unga quyidagi o'zgaruvchilarni yozing (yoki `.env.example` faylidan nusxa oling):

```env
PORT=5000
NODE_ENV=development

# PostgreSQL ulanish satri (O'zingizning baza ma'lumotlarini kiriting)
DATABASE_URL="postgresql://postgres:password@localhost:5432/wholesale_db?schema=public"

# Eskiz.uz SMS integratsiyasi (SMS yuborish uchun)
ESKIZ_EMAIL="info@example.com"
ESKIZ_PASSWORD="your_eskiz_password"

# Telegram Bot sozlamalari (Guruhga xabar yuborish uchun)
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"
```

Frontend sozlamalari uchun `frontend/.env` faylini yarating va unga backend API manzilini yozing:
```env
VITE_API_BASE_URL="http://localhost:5000/api/v1"
```

---

### 2. O'rnatish va Bazani tayyorlash

Ildiz papkada turib backend paketlarini o'rnating va bazani ishga tushiring:

```bash
# 1. Backend paketlarni o'rnatish
npm install

# 2. Baza migratsiyasini amalga oshirish (PostgreSQL yoniq bo'lishi kerak)
npx prisma migrate dev --name init

# 3. Boshlang'ich test ma'lumotlarini bazaga yuklash (Seed)
npx prisma db seed
```

---

### 3. Serverlarni ishga tushirish

Backend va Frontend'ni alohida terminal oynalarida ishga tushiring:

**Backend'ni yoqish:**
```bash
# Ildiz papkada turib:
npm run dev
```
Server `http://localhost:5000` manzilida ishlaydi. Ishga tushganda Cron Job dry-run testi fonda 5 soniyadan keyin avtomatik ravishda boshlanadi.

**Frontend'ni yoqish:**
```bash
# Terminalda frontend papkasiga o'ting:
cd frontend

# Paketlarni o'rnating:
npm install

# Dev-serverni ishga tushiring:
npm run dev
```
Dastur `http://localhost:5173` (yoki terminalda ko'rsatilgan boshqa portda) ishga tushadi. Dasturga kirib POS, CRM va Ombor bo'limlarini darhol sinab ko'rishingiz mumkin!

---

## 📊 Biznes Mantiqlari

1. **Raqamli Yuk Xati (POS):** Savdo tasdiqlangan paytda bitta tranzaksiya (`$transaction`) ichida ombordagi mahsulot qoldig'i kamayadi va nasiya summasi do'konning joriy qarzi (`currentDebt`)ga qo'shiladi. Qarz limiti to'lib qolsa, sotuv amalga oshmaydi va xavfsiz rollback bo'ladi.
2. **Kechikkan Qarzlar Ogohlantirishi:** Har kuni soat 09:00 da ishga tushuvchi Cron Job orqali to'lov muddati kechikkan buyurtmalar uchun do'kondorga Eskiz API orqali avtomatik SMS yuboriladi va takroriy ketmasligi uchun flag faollashadi.
3. **Zaxira Limitlari (Stock Alert):** Omborda mahsulot qoldig'i minimal ko'rsatkichdan tushib ketsa, Cron Job barcha kam qolgan tovarlarni yig'ib Telegram guruhga guruhlangan chiroyli hisobot yuboradi. Omborda tovar soni oshirilganda, ogohlantirish holati avtomatik ravishda `false` holatga qaytadi.
