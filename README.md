# Kum Sevkiyat / İrsaliye Takip ve Mutabakat Sistemi

Mobil uyumlu, hızlı manuel giriş odaklı bir irsaliye yönetim uygulaması.

## Özellikler
- Nakliyeci ve kum ocağı irsaliyesi için ayrı hızlı kayıt ekranı
- Minimum alan doğrulama (tarih, miktar, birim zorunlu)
- Seri no format kontrolü ve aynı tipte seri no tekrar uyarısı
- Otomatik eşleştirme:
  - Seri no birebir eşleşirse otomatik **Mutabık**
  - Değilse tarih/miktar/adres/plaka puanlaması ile **Şüpheli** öneri
- Durumlar: `matched`, `needs_review`, `unmatched`
- Açıkta kalan kayıtlar için WhatsApp outbox kuyruğu ve cooldown
- Dashboard + arama/filtre + rozetli durum listesi
- WhatsApp QR oturumu için temel endpoint (Simple-Whatsapp-API entegrasyonuna hazır yapı)

## Mimari
- **Backend:** Node.js + Express + PostgreSQL
- **Frontend:** React + Vite (responsive)
- **Worker mantığı:** kayıt sonrası açıkta kalanlar için outbox kuyruğu kontrolü
- **Kurulum:** Docker Compose ile tek komut

## Kurulum
```bash
docker compose up --build
```

Servisler:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api
- PostgreSQL: localhost:5432

## API Özet
- `POST /api/docs/carrier`
- `POST /api/docs/supplier`
- `GET /api/dashboard`
- `GET /api/docs`
- `GET /api/matches`
- `POST /api/matches/:id/confirm`
- `GET /api/settings`, `POST /api/settings`
- `GET /api/whatsapp/qr`
- `POST /api/whatsapp/send`

## Demo Akışı (3 tık)
1. `Yeni Nakliyeci` ekranından kayıt ekle, Kaydet
2. `Yeni Kum Ocağı` ekranından kayıt ekle, Kaydet
3. `Mutabakat` sekmesinde öneriyi tek tık onayla

## WhatsApp Entegrasyon Notu
Bu repo, `Simple-Whatsapp-API` için entegrasyon noktalarını hazırlar (`whatsapp_sessions`, `whatsapp_outbox`, QR endpoint, send endpoint).
Üretimde, `/api/whatsapp/*` endpointleri ilgili API'ye bağlanarak gerçek QR ve mesaj gönderimi yapılmalıdır.

## Veritabanı tabloları
- settings
- locations
- vehicles
- docs (carrier/supplier tek tabloda)
- matches
- attachments
- whatsapp_sessions
- whatsapp_outbox

## Soft delete / Audit
- `docs`, `locations`, `vehicles` tablolarında `is_deleted` alanı bulunur.
- Genişletme için `audit_log` tablosu eklenebilir.
