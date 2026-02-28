import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../api/client.js';

const tabs = ['Dashboard', 'Nakliyeci', 'Kum Ocağı', 'Mutabakat', 'Açıkta Kalanlar', 'Ayarlar'];

function DocForm({ type, locations, vehicles, onSaved }) {
  const [form, setForm] = useState({
    docDate: dayjs().format('YYYY-MM-DDTHH:mm'), locationId: '', amountValue: '', amountUnit: 'ton', plate: '', driver: '', serialNo: ''
  });

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, amountValue: Number(form.amountValue) };
    if (type === 'supplier') {
      delete payload.plate;
      delete payload.driver;
    }
    await api(`/docs/${type}`, { method: 'POST', body: JSON.stringify(payload) });
    setForm({ ...form, amountValue: '', serialNo: '' });
    onSaved();
  };

  return <form className="card" onSubmit={submit}>
    <h3>{type === 'carrier' ? 'Yeni Nakliyeci İrsaliyesi' : 'Yeni Kum Ocağı İrsaliyesi'}</h3>
    <div className="grid two">
      <div><label>Tarih/Saat</label><input type="datetime-local" required value={form.docDate} onChange={e => setForm({ ...form, docDate: e.target.value })} /></div>
      <div><label>Sevk Adresi</label><select required value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })}><option value="">Seçin</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      <div><label>Miktar</label><input required type="number" step="0.01" value={form.amountValue} onChange={e => setForm({ ...form, amountValue: e.target.value })} /></div>
      <div><label>Birim</label><select value={form.amountUnit} onChange={e => setForm({ ...form, amountUnit: e.target.value })}><option value="ton">ton</option><option value="m3">m³</option></select></div>
      {type === 'carrier' && <>
        <div><label>Plaka</label><input list="plates" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} /><datalist id="plates">{vehicles.map(v => <option key={v.id} value={v.plate} />)}</datalist></div>
        <div><label>Şoför</label><input value={form.driver} onChange={e => setForm({ ...form, driver: e.target.value })} /></div>
      </>}
      <div><label>Seri No</label><input value={form.serialNo} onChange={e => setForm({ ...form, serialNo: e.target.value })} /></div>
    </div>
    <button>Kaydet ve Otomatik Eşleştir</button>
  </form>;
}

export default function App() {
  const [tab, setTab] = useState(tabs[0]);
  const [dashboard, setDashboard] = useState({});
  const [locations, setLocations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [needsReview, setNeedsReview] = useState([]);
  const [unmatched, setUnmatched] = useState({ carrier: [], supplier: [] });
  const [settings, setSettings] = useState(null);

  const load = async () => {
    const [d, l, v, r, u, s] = await Promise.all([
      api('/dashboard'), api('/metadata/locations'), api('/metadata/vehicles'), api('/matches/needs-review'), api('/docs/unmatched'), api('/settings')
    ]);
    setDashboard(d); setLocations(l); setVehicles(v); setNeedsReview(r); setUnmatched(u); setSettings(s);
  };

  useEffect(() => { load(); }, []);

  const unmatchedCount = useMemo(() => (unmatched.carrier?.length || 0) + (unmatched.supplier?.length || 0), [unmatched]);

  return <div className="container">
    <div className="pills">{tabs.map(t => <button key={t} className={`pill ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</div>

    {tab === 'Dashboard' && <div className="grid two">
      <div className="card"><div>Bugün Nakliyeci</div><div className="stat">{dashboard.carrierToday || 0}</div></div>
      <div className="card"><div>Bugün Kum Ocağı</div><div className="stat">{dashboard.supplierToday || 0}</div></div>
      <div className="card"><div>Açıkta Kalanlar</div><div className="stat" style={{ color: '#b91c1c' }}>{unmatchedCount}</div></div>
      <div className="card"><div>Şüpheli Eşleşmeler</div><div className="stat" style={{ color: '#c2410c' }}>{needsReview.length}</div></div>
    </div>}

    {tab === 'Nakliyeci' && <DocForm type="carrier" locations={locations} vehicles={vehicles} onSaved={load} />}
    {tab === 'Kum Ocağı' && <DocForm type="supplier" locations={locations} vehicles={vehicles} onSaved={load} />}

    {tab === 'Mutabakat' && <div className="card">
      <h3>Önerilen Eşleşmeler</h3>
      {needsReview.map(m => <div className="item" key={m.id}>
        <div><span className="badge needs_review">Şüpheli</span> Güven: %{Math.round(m.confidenceScore)}</div>
        <small>Carrier #{m.carrierDocId} ↔ Supplier #{m.supplierDocId}</small>
        <div className="grid two" style={{ marginTop: 8 }}>
          <button onClick={async () => { await api(`/matches/${m.id}/review`, { method: 'POST', body: JSON.stringify({ approve: true }) }); load(); }}>Onayla</button>
          <button className="secondary" onClick={async () => { await api(`/matches/${m.id}/review`, { method: 'POST', body: JSON.stringify({ approve: false }) }); load(); }}>İptal</button>
        </div>
      </div>)}
      {needsReview.length === 0 && <div>Şüpheli eşleşme yok.</div>}
    </div>}

    {tab === 'Açıkta Kalanlar' && <div className="card">
      <h3>Nakliyeci Açıkları</h3>
      {unmatched.carrier.map(d => <div className="item" key={`c-${d.id}`}><span className="badge unmatched">Açıkta</span> {d.serialNo || '-'} • {d.amountValue} {d.amountUnit} • {d.location?.name}</div>)}
      <h3>Kum Ocağı Açıkları</h3>
      {unmatched.supplier.map(d => <div className="item" key={`s-${d.id}`}><span className="badge unmatched">Açıkta</span> {d.serialNo || '-'} • {d.amountValue} {d.amountUnit} • {d.location?.name}</div>)}
    </div>}

    {tab === 'Ayarlar' && settings && <div className="card grid">
      <h3>Bildirim Ayarları</h3>
      <label>WhatsApp Alıcıları (virgülle)</label>
      <input value={settings.notifyPhones.join(',')} onChange={e => setSettings({ ...settings, notifyPhones: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
      <div className="grid two">
        <div><label>Nakliyeci Eşik (dk)</label><input type="number" value={settings.carrierThresholdMinutes} onChange={e => setSettings({ ...settings, carrierThresholdMinutes: Number(e.target.value) })} /></div>
        <div><label>Kum Ocağı Eşik (dk)</label><input type="number" value={settings.supplierThresholdMinutes} onChange={e => setSettings({ ...settings, supplierThresholdMinutes: Number(e.target.value) })} /></div>
      </div>
      <button onClick={async () => { await api('/settings', { method: 'PUT', body: JSON.stringify(settings) }); load(); }}>Ayarları Kaydet</button>
    </div>}
  </div>;
}
