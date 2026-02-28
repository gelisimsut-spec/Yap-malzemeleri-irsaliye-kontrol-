import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'carrier', label: 'Yeni Nakliyeci' },
  { key: 'supplier', label: 'Yeni Kum Ocağı' },
  { key: 'matches', label: 'Mutabakat' },
  { key: 'settings', label: 'Ayarlar' }
];

const emptyForm = {
  doc_datetime: new Date().toISOString().slice(0, 16),
  location_id: '',
  amount_value: '',
  amount_unit: 'ton',
  plate: '',
  driver_name: '',
  serial_no: '',
  file: null
};

const badgeClass = (status) => ({
  matched: 'badge green',
  needs_review: 'badge orange',
  unmatched: 'badge red'
}[status] || 'badge');

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [docs, setDocs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [locations, setLocations] = useState([{ id: 1, name: 'Ana Depo' }, { id: 2, name: 'Merkez Şantiye' }]);
  const [filter, setFilter] = useState({ q: '', status: '' });
  const [resultMsg, setResultMsg] = useState('');

  const fetchAll = async () => {
    const [d, docList, m, s] = await Promise.all([
      fetch(`${API}/dashboard`).then((r) => r.json()),
      fetch(`${API}/docs`).then((r) => r.json()),
      fetch(`${API}/matches`).then((r) => r.json()),
      fetch(`${API}/settings`).then((r) => r.json())
    ]);
    setDashboard(d);
    setDocs(docList);
    setMatches(m);
    setSettings(s);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredDocs = useMemo(() => docs.filter((d) => {
    if (filter.status && d.status !== filter.status) return false;
    if (filter.q && !`${d.serial_no || ''} ${d.plate || ''}`.toLowerCase().includes(filter.q.toLowerCase())) return false;
    return true;
  }), [docs, filter]);

  const handleSaveDoc = async (type) => {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && v !== null) body.append(k, v);
    });
    const res = await fetch(`${API}/docs/${type}`, { method: 'POST', body });
    const data = await res.json();
    if (!res.ok) {
      setResultMsg(`Hata: ${data.error}`);
      return;
    }

    const matchStatus = data.match?.status === 'matched' ? 'Mutabık' : data.match?.status === 'needs_review' ? 'Şüpheli eşleşme önerildi' : 'Açıkta';
    setResultMsg(`Kaydedildi → Otomatik eşleştirme: ${matchStatus}`);
    setForm({ ...emptyForm, doc_datetime: new Date().toISOString().slice(0, 16) });
    await fetchAll();
  };

  const renderQuickForm = (type) => (
    <section className="card mobile-form">
      <h2>{type === 'carrier' ? 'Nakliyeci İrsaliyesi' : 'Kum Ocağı İrsaliyesi'}</h2>
      <div className="form-grid">
        <label>Tarih / Saat
          <input type="datetime-local" value={form.doc_datetime} onChange={(e) => setForm({ ...form, doc_datetime: e.target.value })} required />
        </label>
        <label>Sevk Adresi
          <select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
            <option value="">Seçiniz</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label>Miktar
          <div className="inline">
            <input type="number" placeholder="Değer" value={form.amount_value} onChange={(e) => setForm({ ...form, amount_value: e.target.value })} required />
            <select value={form.amount_unit} onChange={(e) => setForm({ ...form, amount_unit: e.target.value })}>
              <option value="ton">Ton</option>
              <option value="m3">m³</option>
            </select>
          </div>
        </label>
        <label>Plaka
          <input list="plates" placeholder="34 ABC 123" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
          <datalist id="plates">
            {[...new Set(docs.map((d) => d.plate).filter(Boolean))].map((plate) => <option key={plate} value={plate} />)}
          </datalist>
        </label>
        <label>Şoför
          <input placeholder="Opsiyonel" value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
        </label>
        <label>Seri No
          <input placeholder="A-2024/001" value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value.toUpperCase() })} />
        </label>
        <label>Ek Dosya (Foto/PDF)
          <input type="file" accept="image/*,.pdf" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] })} />
        </label>
      </div>
      <button className="primary" onClick={() => handleSaveDoc(type)}>Kaydet ve Eşleştir</button>
      {resultMsg && <p className="result">{resultMsg}</p>}
    </section>
  );

  return (
    <main>
      <header>
        <h1>Kum Sevkiyat / İrsaliye Takip</h1>
        <p>3 tıkla giriş, otomatik mutabakat, WhatsApp uyarı.</p>
      </header>

      <nav>
        {tabs.map((t) => <button key={t.key} className={tab === t.key ? 'tab active' : 'tab'} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </nav>

      {tab === 'dashboard' && dashboard && (
        <section className="stats">
          <article><h3>Bugün</h3><strong>{dashboard.today_total}</strong></article>
          <article className="red"><h3>Açıkta</h3><strong>{dashboard.unmatched}</strong></article>
          <article className="orange"><h3>Şüpheli</h3><strong>{dashboard.needs_review}</strong></article>
          <article className="green"><h3>Mutabık</h3><strong>{dashboard.matched}</strong></article>
        </section>
      )}

      {tab === 'carrier' && renderQuickForm('carrier')}
      {tab === 'supplier' && renderQuickForm('supplier')}

      {tab === 'matches' && (
        <section className="card">
          <h2>Mutabakat & Açıkta Kalanlar</h2>
          <div className="inline filters">
            <input placeholder="Seri / plaka ara" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
              <option value="">Tüm durumlar</option>
              <option value="matched">Mutabık</option>
              <option value="needs_review">Şüpheli</option>
              <option value="unmatched">Açıkta</option>
            </select>
          </div>
          <ul className="list">
            {filteredDocs.slice(0, 20).map((d) => (
              <li key={d.id}>
                <div>
                  <strong>{d.doc_type === 'carrier' ? 'Nakliyeci' : 'Kum Ocağı'}</strong>
                  <p>Seri: {d.serial_no || '-'} · {d.amount_value} {d.amount_unit} · {d.location_name || '-'}</p>
                </div>
                <span className={badgeClass(d.status)}>{d.status}</span>
              </li>
            ))}
          </ul>
          <h3>Önerilen Eşleşmeler</h3>
          <ul className="list">
            {matches.filter((m) => m.status === 'needs_review').map((m) => (
              <li key={m.id}>
                <span>#{m.id} | Güven: {Number(m.confidence_score).toFixed(0)}%</span>
                <div className="inline">
                  <button onClick={async () => { await fetch(`${API}/matches/${m.id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'matched' }) }); fetchAll(); }}>Onayla</button>
                  <button onClick={async () => { await fetch(`${API}/matches/${m.id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'unmatched' }) }); fetchAll(); }}>Reddet</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'settings' && (
        <section className="card">
          <h2>WhatsApp ve Eşik Ayarları</h2>
          <button className="primary" onClick={async () => {
            const qr = await fetch(`${API}/whatsapp/qr`).then((r) => r.json());
            setResultMsg(`QR oturumu yenilendi (${qr.status})`);
          }}>WhatsApp QR Yenile</button>
          <div className="form-grid">
            <label>Bildirim Numaraları (virgül)
              <input value={settings?.notify_numbers?.join(',') || ''} onChange={(e) => setSettings({ ...settings, notify_numbers: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </label>
            <label>Nakliyeci açıkta uyarı (dk)
              <input type="number" value={settings?.carrier_unmatched_minutes || 60} onChange={(e) => setSettings({ ...settings, carrier_unmatched_minutes: Number(e.target.value) })} />
            </label>
            <label>Kum ocağı açıkta uyarı (dk)
              <input type="number" value={settings?.supplier_unmatched_minutes || 60} onChange={(e) => setSettings({ ...settings, supplier_unmatched_minutes: Number(e.target.value) })} />
            </label>
          </div>
          <button className="primary" onClick={async () => {
            await fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
            setResultMsg('Ayarlar kaydedildi');
            fetchAll();
          }}>Ayarları Kaydet</button>
          {resultMsg && <p className="result">{resultMsg}</p>}
        </section>
      )}
    </main>
  );
}
