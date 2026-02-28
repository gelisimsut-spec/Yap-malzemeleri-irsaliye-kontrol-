# Kum Sevkiyat / İrsaliye Takip ve Mutabakat Sistemi

Mobil uyumlu web uygulaması ile nakliyeci ve kum ocağı irsaliyelerini manuel girip otomatik mutabakat yapan örnek proje.

## Özellikler

- Hızlı kayıt formları (nakliyeci / kum ocağı)
- Otomatik eşleştirme (seri no + skor bazlı öneri)
- Durum yönetimi: `matched`, `needs_review`, `unmatched`
- Açıkta kalan irsaliyeler için WhatsApp bildirim kuyruğu
- WhatsApp QR bağlama durumunu izleme (Simple-Whatsapp-API entegrasyon noktaları)
- PostgreSQL şema + index + audit log
- Docker Compose ile tek komut kurulum

## Teknoloji

- Backend: Node.js + Express + Prisma + PostgreSQL
- Frontend: React + Vite
- Worker: Backend içinde cron görevleri (node-cron)

## Kurulum

```bash
docker compose up --build
```

Uygulama:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Lokal geliştirme

### 1) Backend
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### 2) Frontend
```bash
cd frontend
npm install
npm run dev
```

## Ortam değişkenleri

`backend/.env.example` dosyasını `backend/.env` olarak kopyalayın.

Önemli değişkenler:
- `DATABASE_URL`: PostgreSQL bağlantısı
- `WHATSAPP_API_BASE_URL`: Simple-Whatsapp-API URL
- `WHATSAPP_API_KEY`: WhatsApp API anahtarı

## Demo Veri

Backend açıldığında örnek lokasyon, plaka ve ayar verisi `seedDefaults()` ile oluşturulur.

## Örnek Akış

1. Dashboard'dan **Yeni Nakliyeci İrsaliyesi** ekle.
2. **Yeni Kum Ocağı İrsaliyesi** ekle.
3. Kayıt sonrası sistem otomatik eşleştirme dener.
4. **Mutabakat** ekranında önerileri tek tıkla onayla/iptal et.
5. Açıkta kalanlar eşik süreyi aşarsa WhatsApp outbox kuyruğuna mesaj düşer.

## WhatsApp Entegrasyonu

Bu proje, [Simple-Whatsapp-API](https://github.com/Codegres-com/Simple-Whatsapp-API) ile çalışacak şekilde hazırlanmıştır.

Entegrasyon noktaları:
- `GET /api/whatsapp/session-status`
- `POST /api/whatsapp/send-test`
- Cron ile `whatsapp_outbox` gönderimi (`sendWhatsappMessage`)

> Not: API endpoint sözleşmesi dağıtıma göre değişebileceği için `backend/src/services/whatsappService.js` içinde kolayca uyarlanabilir şekilde soyutlandı.

## Teslim Kriterleri Karşılığı

- [x] README kurulum adımları
- [x] Demo veri
- [x] Eşleştirme mantığı
- [x] WhatsApp QR durum endpoint'i + mesaj gönderimi
- [x] Mobil odaklı, büyük butonlu responsive UI
