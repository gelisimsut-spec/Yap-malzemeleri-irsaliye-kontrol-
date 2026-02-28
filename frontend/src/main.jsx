import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const api = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function useFetch(path, deps = []) {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch(`${api}${path}`).then((r) => r.json()).then(setData).catch(() => setData([]));
  }, deps);
  return [data, setData];
}

function App() {
  const now = new Date();
  const [tab, setTab] = useState('dashboard');
  const [locations] = useFetch('/api/meta/locations', []);
  const [carrierDocs, setCarrierDocs] = useFetch('/api/docs/carrier', []);
  const [supplierDocs, setSupplierDocs] = useFetch('/api/docs/supplier', []);
  const [matches, setMatches] = useFetch('/api/docs/matches', []);
  const [settings, setSettings] = useState(null);

  const [carrierForm, setCarrierForm] = useState({
    doc_datetime: now.toISOString().slice(0, 16),
    location_id: '',
    quantity_value: '',
    quantity_unit: 'ton',
    plate: '',
    driver_name: '',
    serial_no: ''
  });

  const [supplierForm, setSupplierForm] = useState({
    doc_datetime: now.toISOString().slice(0, 16),
    location_id: '',
    quantity_value: '',
    quantity_unit: 'ton',
    serial_no: ''
  });

  useEffect(() => {
    fetch(`${api}/api/settings`).then((r) => r.json()).then(setSettings);
  }, []);

  const stats = useMemo(() => ({
    openCarrier: carrierDocs.filter((d) => d.status === 'unmatched').length,
    openSupplier: supplierDocs.filter((d) => d.status === 'unmatched').length,
    review: matches.filter((m) => m.status === 'needs_review').length,
    matched: matches.filter((m) => m.status === 'matched').length
  }), [carrierDocs, supplierDocs, matches]);

  async function saveDoc(type, form) {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    const res = await fetch(`${api}/api/docs/${type}`, { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) return alert(json.error || 'Kayıt hatası');
    alert(`Kaydedildi. Otomatik eşleşme: ${json.autoMatch ? json.autoMatch.status : 'bulunamadı'}`);
    setCarrierDocs(await fetch(`${api}/api/docs/carrier`).then((r) => r.json()));
    setSupplierDocs(await fetch(`${api}/api/docs/supplier`).then((r) => r.json()));
    setMatches(await fetch(`${api}/api/docs/matches`).then((r) => r.json()));
  }

  return (
    <div className="app">
      <header>
        <h1>İrsaliye Mutabakat</h1>
        <p>3 tıkla kayıt, otomatik eşleştirme ve WhatsApp uyarı</p>
      </header>

      <nav>
        {['dashboard', 'carrier', 'supplier', 'mutabakat', 'ayarlar'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <section className="grid cards">
          <div className="card red">Açıkta Nakliyeci: {stats.openCarrier}</div>
          <div className="card red">Açıkta Kum Ocağı: {stats.openSupplier}</div>
          <div className="card orange">Şüpheli: {stats.review}</div>
          <div className="card green">Mutabık: {stats.matched}</div>
        </section>
      )}

      {tab === 'carrier' && (
        <section className="form-wrap">
          <h2>Yeni Nakliyeci İrsaliyesi</h2>
          <div className="form-grid">
            <input type="datetime-local" value={carrierForm.doc_datetime} onChange={(e) => setCarrierForm({ ...carrierForm, doc_datetime: e.target.value })} />
            <select value={carrierForm.location_id} onChange={(e) => setCarrierForm({ ...carrierForm, location_id: e.target.value })}>
              <option value="">Adres seç</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input placeholder="Miktar" value={carrierForm.quantity_value} onChange={(e) => setCarrierForm({ ...carrierForm, quantity_value: e.target.value })} />
            <select value={carrierForm.quantity_unit} onChange={(e) => setCarrierForm({ ...carrierForm, quantity_unit: e.target.value })}><option value="ton">ton</option><option value="m3">m3</option></select>
            <input placeholder="Plaka" value={carrierForm.plate} onChange={(e) => setCarrierForm({ ...carrierForm, plate: e.target.value.toUpperCase() })} />
            <input placeholder="Şoför" value={carrierForm.driver_name} onChange={(e) => setCarrierForm({ ...carrierForm, driver_name: e.target.value })} />
            <input placeholder="Seri No" value={carrierForm.serial_no} onChange={(e) => setCarrierForm({ ...carrierForm, serial_no: e.target.value.toUpperCase() })} />
            <button className="big" onClick={() => saveDoc('carrier', carrierForm)}>Kaydet ve Eşleştir</button>
          </div>
        </section>
      )}

      {tab === 'supplier' && (
        <section className="form-wrap">
          <h2>Yeni Kum Ocağı İrsaliyesi</h2>
          <div className="form-grid">
            <input type="datetime-local" value={supplierForm.doc_datetime} onChange={(e) => setSupplierForm({ ...supplierForm, doc_datetime: e.target.value })} />
            <select value={supplierForm.location_id} onChange={(e) => setSupplierForm({ ...supplierForm, location_id: e.target.value })}>
              <option value="">Adres seç</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input placeholder="Miktar" value={supplierForm.quantity_value} onChange={(e) => setSupplierForm({ ...supplierForm, quantity_value: e.target.value })} />
            <select value={supplierForm.quantity_unit} onChange={(e) => setSupplierForm({ ...supplierForm, quantity_unit: e.target.value })}><option value="ton">ton</option><option value="m3">m3</option></select>
            <input placeholder="Seri No" value={supplierForm.serial_no} onChange={(e) => setSupplierForm({ ...supplierForm, serial_no: e.target.value.toUpperCase() })} />
            <button className="big" onClick={() => saveDoc('supplier', supplierForm)}>Kaydet</button>
          </div>
        </section>
      )}

      {tab === 'mutabakat' && (
        <section>
          <h2>Önerilen Eşleşmeler</h2>
          {matches.map((m) => (
            <div className="row" key={m.id}>
              <span>#{m.id} Skor:{m.confidence_score} Durum:{m.status}</span>
              {m.status === 'needs_review' && (
                <>
                  <button onClick={async () => { await fetch(`${api}/api/docs/matches/${m.id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept: true }) }); setMatches(await fetch(`${api}/api/docs/matches`).then((r) => r.json())); }}>Onayla</button>
                  <button onClick={async () => { await fetch(`${api}/api/docs/matches/${m.id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept: false }) }); setMatches(await fetch(`${api}/api/docs/matches`).then((r) => r.json())); }}>Reddet</button>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === 'ayarlar' && settings && (
        <section className="form-wrap">
          <h2>Ayarlar</h2>
          <div className="form-grid">
            <input value={(settings.whatsapp_recipients || []).join(',')} onChange={(e) => setSettings({ ...settings, whatsapp_recipients: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="WhatsApp numaraları, +905..." />
            <input value={settings.carrier_unmatched_minutes} onChange={(e) => setSettings({ ...settings, carrier_unmatched_minutes: Number(e.target.value) })} placeholder="Nakliyeci eşik dk" />
            <input value={settings.supplier_unmatched_minutes} onChange={(e) => setSettings({ ...settings, supplier_unmatched_minutes: Number(e.target.value) })} placeholder="Kum ocağı eşik dk" />
            <button className="big" onClick={async () => {
              await fetch(`${api}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
              alert('Ayarlar kaydedildi');
            }}>Kaydet</button>
          </div>
        </section>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
