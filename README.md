# Kum Sevkiyat / İrsaliye Takip ve Mutabakat Sistemi

Mobil uyumlu, manuel veri giriş odaklı bir MVP uygulama.

## Özellikler
- Nakliyeci ve Kum Ocağı irsaliyesi hızlı kayıt ekranları
- Otomatik eşleştirme (seri no, tarih/miktar/adres/plaka skorlaması)
- Durumlar: `matched`, `needs_review`, `unmatched`
- Açıkta kalan irsaliye kontrolü + WhatsApp outbox kuyruğu
- WhatsApp QR/session proxy endpointleri (Simple-Whatsapp-API ile)
- PostgreSQL şema + indeksler + soft delete alanları
- Audit log

## Teknoloji
- Backend: Node.js + Express + PostgreSQL
- Frontend: React + Vite (responsive, büyük butonlar)
- Worker: backend içi interval job (outbox + unmatched notify)
- Kurulum: docker compose

## Hızlı Başlangıç
```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Postgres: localhost:5432

## Manuel (lokal) çalıştırma
### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Demo veri
Backend açıldıktan sonra:
```bash
curl -X POST http://localhost:3000/api/demo/seed
```

## WhatsApp Entegrasyonu
Bu proje `Simple-Whatsapp-API` servisini harici bir servis olarak bekler.

- `WHATSAPP_API_BASE_URL` ile servis URL'i verilir.
- Ayarlar ekranından alıcı numaraları ve eşik/cooldown değerleri düzenlenir.
- Worker, açıkta kalan kayıtları outbox'a yazar.
- Outbox göndericisi, mesajları WhatsApp servisine POST eder.

> Not: Dosya gönderimi servisin desteklediği endpointlere göre genişletilebilir. Şu an metin + varsa dosya linki mesajı gönderilir.

## Test
```bash
cd backend
npm test
```
