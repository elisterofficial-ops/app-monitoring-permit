import { I } from '../icons.js';
import { esc, fmtDate, fmtLong, fmtRM, dayName, today, diffDays, scase, tcase, waNumber, mapsUrl, BULAN } from '../util.js';
import { state, chain, canEdit, updateRecord, missingForSurat, suratFor, uploadPhoto, compressImage } from '../store.js';
import { header, badge, empty, toast, busy, pickFile, getLocation } from '../ui.js';
import { scanPermit, confirmNumber } from './scan.js';

const COLOR = { ok: '#34d399', warn: '#fbbf24', bad: '#fb7185', mute: '#a3adc4' };
const clsOf = (s) => ({ 'SAH': 'ok', 'AKAN TAMAT': 'warn', 'TAMAT': 'bad' }[s] || 'mute');

function waText(r) {
  const lines = [
    `*${scase(r.jenis)}* · ${r.tempoh === 'BERMUSIM' ? 'Bermusim' : 'Tahunan'}`,
    r.nama,
    `ID rekod: ${r.id}${r.noPermit ? ` · No. permit: ${r.noPermit}` : ''}`,
    r.kawasan ? `Kawasan: ${tcase(r.kawasan)}${r.kedudukan ? `, ${r.kedudukan}` : ''}` : '',
    r.mula && r.tamat ? `Tempoh: ${fmtDate(r.mula)} hingga ${fmtDate(r.tamat)}` : '',
    `Status: ${r.status}${r.baki != null && r.baki >= 0 && (r.status === 'SAH' || r.status === 'AKAN TAMAT') ? ` (${r.baki} hari lagi)` : ''}`,
    r.koordinat ? `Lokasi: ${mapsUrl(r.koordinat)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function row(label, value, extra = '') {
  return `<div class="drow"><span class="dl">${esc(label)}</span><span class="dv">${value}${extra}</span></div>`;
}

function hero(r) {
  const cls = clsOf(r.status);
  const col = COLOR[cls];
  let big = '';
  let line = '';
  if (r.status === 'SAH' || r.status === 'AKAN TAMAT') {
    big = String(r.baki);
    line = `hari lagi · tamat ${dayName(r.tamat)}, ${fmtLong(r.tamat)}`;
  } else if (r.status === 'TAMAT') {
    big = String(Math.abs(r.baki));
    line = `hari lalu · tamat ${fmtLong(r.tamat)}`;
  } else if (r.status === 'DIPERBAHARUI') {
    const n = state.renewals.get(r.id);
    line = `Diperbaharui${n ? ` oleh <a href="#/permit/${encodeURIComponent(n.id)}">${esc(n.id)}</a>` : ''} · tamat ${esc(fmtLong(r.tamat))}`;
  } else if (r.status === 'SELESAI') {
    line = `Permit bermusim selesai pada ${esc(fmtLong(r.tamat))}`;
  } else {
    line = 'Tarikh tamat belum diisi';
  }
  let bar = '';
  if (r.mula && r.tamat) {
    const span = diffDays(r.mula, r.tamat) + 1;
    const gone = Math.min(Math.max(diffDays(r.mula, today()) + 1, 0), span);
    const pct = Math.round((gone / span) * 100);
    const per = r.tempohBulan >= 1 ? `${r.tempohBulan} bulan` : `${span} hari`;
    bar = `<div><div class="pbar" role="img" aria-label="Tempoh permit sudah berjalan ${pct} peratus"><div style="width:${pct}%;background:${col};box-shadow:0 0 10px ${col}88"></div></div>
      <div class="pbar-l"><span>${fmtDate(r.mula)}</span><span>${per}</span><span>${fmtDate(r.tamat)}</span></div></div>`;
  }
  return `<section class="phero ${cls}">
    <div class="phero-top">
      <div><div class="phero-name">${esc(r.nama)}</div>
        <div class="tags"><span class="tag">${esc(scase(r.jenis))}</span><span class="tag">${r.tempoh === 'BERMUSIM' ? 'Bermusim' : 'Tahunan'}</span></div></div>
      ${badge(r.status)}
    </div>
    ${big ? `<div class="phero-big"><span class="num" style="color:${col}">${big}</span><span>${esc(line)}</span></div>` : `<div class="sub">${line}</div>`}
    ${bar}
  </section>`;
}

export default {
  nav: 'cari',
  render(ctx) {
    const r = state.byId.get(String(ctx.arg || '').toUpperCase());
    if (!r) return `<div class="page">${header('Butiran permit', { back: '#/cari' })}${empty('Rekod tidak dijumpai', 'Mungkin ID rekod telah ditukar dalam Sheet.')}</div>`;
    const edit = canEdit();
    const { prev, next } = chain(r);
    const missing = r.tempoh === 'TAHUNAN' ? missingForSurat(r) : [];
    const letters = suratFor(r.id);
    const bayar = r.dibayar != null
      ? `<b class="mono">${esc(fmtRM(r.dibayar))}</b>${r.tarikhBayar ? ` · ${BULAN[r.tarikhBayar.getUTCMonth()].slice(0, 3)} ${r.tarikhBayar.getUTCFullYear()}` : ''}`
      : '<span class="muted">Belum diisi</span>';
    const jumlah = r.jumlah != null ? `<b class="mono">${esc(fmtRM(r.jumlah))}</b>` : `<span class="muted">Kadar ${esc(scase(r.jenis))} belum ditetapkan</span>`;
    const actions = [];
    if (edit) actions.push(`<a class="act primary" href="#/baharui/${encodeURIComponent(r.id)}">${I.renew}Baharui</a>`);
    if (r.tempoh === 'TAHUNAN') actions.push(`<a class="act violet" href="#/surat?id=${encodeURIComponent(r.id)}">${I.mail}Surat</a>`);
    actions.push(`<a class="act green" href="https://wa.me/${waNumber(r.telefon)}?text=${encodeURIComponent(waText(r))}" target="_blank" rel="noopener">${I.wa}WhatsApp</a>`);
    if (r.koordinat) actions.push(`<a class="act" href="${esc(mapsUrl(r.koordinat))}" target="_blank" rel="noopener">${I.pin}Peta</a>`);
    else if (edit) actions.push(`<button type="button" class="act" data-act="lokasi">${I.locate}Tanda lokasi</button>`);

    const fileBtn = (link, label, act) => link
      ? `<a class="fbtn" href="${esc(link)}" target="_blank" rel="noopener">${I.image}<span>${esc(label)}</span>${I.ext}</a>`
      : edit ? `<button type="button" class="fbtn dashed" data-act="${act}">${I.camera}<span>Muat naik ${esc(label.toLowerCase())}</span></button>` : '';

    return `<div class="page">
      ${header('Butiran permit', { back: '#/cari', right: edit ? `<a class="icon-btn" href="#/sunting/${encodeURIComponent(r.id)}" aria-label="Sunting rekod">${I.edit}</a>` : `<span class="sub">${esc(r.id)}</span>` })}
      ${hero(r)}
      <div class="acts" style="--n:${actions.length}">${actions.join('')}</div>

      <section class="card dl-card">
        ${row('ID rekod', esc(r.id))}
        ${row('No. permit', r.noPermit ? esc(r.noPermit) : '<span class="amber">Belum diisi</span>', !r.noPermit && edit ? ` <button type="button" class="mini" data-act="imbas">Imbas permit</button>` : '')}
        ${row('Kawasan', r.kawasan ? esc(tcase(r.kawasan)) : '<span class="muted">-</span>')}
        ${r.kedudukan ? row('Kedudukan', esc(r.kedudukan)) : ''}
        ${r.kuantiti ? row('Kuantiti', esc(`${r.kuantiti} ${r.unitKuantiti || ''}`)) : ''}
        ${r.k10 || r.k20 || r.hiburan ? row('Tambahan', esc([r.k10 ? `${r.k10} khemah 10x10` : '', r.k20 ? `${r.k20} khemah 20x20` : '', r.hiburan ? `${r.hiburan} hiburan` : ''].filter(Boolean).join(', '))) : ''}
        ${row('Jumlah dibayar', bayar)}
        ${r.resit ? row('No. resit', esc(r.resit)) : ''}
        ${row('Jumlah keseluruhan', jumlah)}
        ${row('Pengurus premis', r.pengurus ? esc(r.pengurus) : '<span class="muted">-</span>')}
        ${r.alamat ? row('Alamat', esc(r.alamat).replace(/\n/g, '<br>')) : ''}
        ${r.telefon ? row('No. telefon', `<a href="tel:${esc(r.telefon.replace(/\s/g, ''))}">${esc(r.telefon)}</a>`) : ''}
        ${r.koordinat ? row('Koordinat', `<a href="${esc(mapsUrl(r.koordinat))}" target="_blank" rel="noopener">${esc(r.koordinat)}</a>`) : ''}
        ${row('Unit', esc(tcase(r.unit || '-')))}
        ${r.catatan ? row('Catatan', esc(r.catatan)) : ''}
      </section>

      <div class="files">${fileBtn(r.permitAsal, 'Permit asal', 'permit')}${fileBtn(r.gambarLokasi, 'Gambar lokasi', 'gambar')}</div>

      ${missing.length && edit ? `<section class="note warn">
        <div class="note-t">${I.alert}Lengkapkan untuk surat peringatan</div>
        <div class="sub2">${esc(missing.join(', '))} belum diisi. Ambil dari borang permohonan.</div>
        <a class="btn amber sm" href="#/sunting/${encodeURIComponent(r.id)}">Lengkapkan maklumat</a>
      </section>` : ''}

      ${letters.length ? `<section class="card"><h2 class="h2">Surat peringatan</h2>${letters.map((s) => `<div class="drow"><span class="dl">${esc(fmtDate(s.tarikh))}</span><span class="dv">${esc(s.ruj || '-')} ${s.pdf ? `· <a href="${esc(s.pdf)}" target="_blank" rel="noopener">PDF</a>` : ''}</span></div>`).join('')}</section>` : ''}

      <section class="card">
        <h2 class="h2">Sejarah</h2>
        ${prev.length || next.length ? `<div class="hist">
          ${next.reverse().map((x) => `<a href="#/permit/${encodeURIComponent(x.id)}" class="hist-i">${badge(x.status)}<span>${esc(x.id)} · ${esc(fmtDate(x.mula))} hingga ${esc(fmtDate(x.tamat))}</span></a>`).join('')}
          <div class="hist-i cur"><span class="badge mute">Rekod ini</span><span>${esc(r.id)} · ${esc(fmtDate(r.mula))} hingga ${esc(fmtDate(r.tamat))}</span></div>
          ${prev.map((x) => `<a href="#/permit/${encodeURIComponent(x.id)}" class="hist-i">${badge(x.status)}<span>${esc(x.id)} · ${esc(fmtDate(x.mula))} hingga ${esc(fmtDate(x.tamat))}</span></a>`).join('')}
        </div>` : '<div class="sub">Tiada permit terdahulu dalam daftar.</div>'}
      </section>
    </div>`;
  },
  bind(el, ctx) {
    const r = state.byId.get(String(ctx.arg || '').toUpperCase());
    if (!r) return;
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      try {
        if (act === 'lokasi') {
          busy(b, true, 'Mengesan…');
          const k = await getLocation();
          await ctx.withAuth(() => updateRecord(r.id, { koordinat: k }));
          toast('Lokasi disimpan.', 'ok');
          ctx.rerender();
        } else if (act === 'imbas') {
          const res = await ctx.withAuth(() => scanPermit(r.id));
          if (!res) return;
          const changes = r.permitAsal ? {} : { permitAsal: res.link };
          const num = await confirmNumber(res.candidates);
          if (num) changes.noPermit = num;
          await ctx.withAuth(() => updateRecord(r.id, changes));
          toast(num ? `No. permit ${num} disimpan.` : 'Gambar permit disimpan.', 'ok');
          ctx.rerender();
        } else if (act === 'permit' || act === 'gambar') {
          const file = await pickFile();
          if (!file) return;
          busy(b, true, 'Memuat naik…');
          const blob = await compressImage(file);
          const label = act === 'permit' ? 'permit asal' : 'gambar lokasi';
          const up = await ctx.withAuth(() => uploadPhoto(blob, `${r.id} - ${label}.jpg`));
          await ctx.withAuth(() => updateRecord(r.id, act === 'permit' ? { permitAsal: up.webViewLink } : { gambarLokasi: up.webViewLink }));
          toast('Gambar disimpan.', 'ok');
          ctx.rerender();
        }
      } catch (err) {
        busy(b, false);
        ctx.fail(err);
      }
    });
  },
};
