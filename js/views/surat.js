// Surat peringatan pembaharuan: senarai perlu dijana, akan datang, dan yang sudah dijana.
import { I } from '../icons.js';
import { esc, fmtDate, fmtLong, fmtShort, scase, tcase } from '../util.js';
import {
  state, canEdit, suratDue, suratUpcoming, missingForSurat, suratValues, janaSurat, nextRuj, pdfBlobFromLink, suratFor, setting,
} from '../store.js';
import { header, empty, toast, busy, shareFile } from '../ui.js';

const hl = (v, label) => (v ? esc(v) : `<mark>${esc(label)}</mark>`);

function preview(r, ruj) {
  const v = suratValues(r, ruj);
  const org = String(setting('nama majlis') || '').trim();
  return `<div class="paper" role="img" aria-label="Pratonton surat peringatan untuk ${esc(r.nama)}">
    <div class="paper-h"><span class="paper-org">${esc(org.toUpperCase() || 'KEPALA SURAT')}</span><span class="paper-addr">Kepala surat ikut templat</span></div>
    <div class="paper-row"><span>Ruj. Kami : ${hl(ruj, 'isi di bawah')}</span><span>Tarikh : ${esc(v.TARIKH_SURAT)}</span></div>
    <div><div class="b">${hl(v.NAMA_PENGURUS, 'Nama pengurus premis')}</div><div>${esc(v.NAMA_PREMIS)}</div><div>${hl(v.ALAMAT_1, 'Alamat')}</div>${v.ALAMAT_2 ? `<div>${esc(v.ALAMAT_2)}</div>` : ''}</div>
    <div class="paper-salam">Tuan,</div>
    <div class="b">NOTIS PERINGATAN UNTUK MEMPERBAHARUI ${esc(v.JENIS_PERMIT)} BAGI TAHUN ${esc(v.TAHUN)}</div>
    <div>Dengan hormatnya, perkara di atas adalah dirujuk.</div>
    <div class="just">1.&#160;&#160;Dengan ini dimaklumkan bahawa tempoh sah laku ${esc(v.NAMA_PERMIT)} tuan bagi premis ${esc(v.NAMA_PREMIS)} di ${esc(v.KAWASAN)} dengan nombor ${hl(v.NO_PERMIT, 'No. permit')} akan tamat tempoh pada ${esc(v.TARIKH_TAMAT)}. Oleh itu, pihak tuan adalah diingatkan untuk memperbaharui ${esc(v.NAMA_PERMIT)} tersebut sebelum ${esc(v.TARIKH_TAMAT)} (${esc(v.HARI_TAMAT)}).</div>
    <div class="fade">2.&#160;&#160;Sehubungan dengan itu, disertakan bersama surat ini borang permohonan pembaharuan…</div>
    <div class="paper-sign"><div class="b">(${hl(v.NAMA_PENANDATANGAN, 'Penandatangan')})</div><div>${esc(v.JAWATAN_PENANDATANGAN)}</div>${org ? `<div>${esc(tcase(org))}</div>` : ''}</div>
  </div>`;
}

function dueCard(r) {
  const m = missingForSurat(r);
  return `<a class="rcard violet-b" href="#/surat?id=${encodeURIComponent(r.id)}">
    <div class="rcard-top"><div class="rcard-name">${esc(r.nama)}</div>
      ${m.length ? `<span class="pill warn">${m.length} ruang kosong</span>` : `<span class="pill warn">${r.baki} hari</span>`}</div>
    <div class="sub">${esc(scase(r.jenis))} · ${esc(tcase(r.kawasan))} · tamat ${esc(fmtDate(r.tamat))}</div>
  </a>`;
}

function single(r) {
  const edit = canEdit();
  const m = missingForSurat(r);
  const ruj = nextRuj();
  const log = suratFor(r.id);
  return `<div class="page">
    ${header('Surat peringatan', { back: '#/surat', sub: `${r.id} · tamat ${fmtDate(r.tamat)}` })}
    <a class="rcard violet-b" href="#/permit/${encodeURIComponent(r.id)}">
      <div class="rcard-top"><div class="rcard-name">${esc(r.nama)}</div>${m.length ? `<span class="pill warn">${m.length} ruang kosong</span>` : `<span class="pill ok">Lengkap</span>`}</div>
      <div class="sub">${esc(scase(r.jenis))} · tamat ${esc(fmtDate(r.tamat))}</div>
    </a>
    ${log.length ? `<div class="note ok"><div class="note-t">${I.check}Surat sudah dijana ${esc(fmtDate(log[log.length - 1].tarikh))}</div><div class="sub2">Jana sekali lagi hanya jika perlu.</div></div>` : ''}
    <div id="pv">${preview(r, ruj)}</div>
    ${edit ? `<div class="fld"><label class="lbl" for="ruj">Ruj. Kami</label><input id="ruj" class="inp violet" value="${esc(ruj)}" placeholder="Contoh: RUJ/700/31 Jld.1 (15)" autocomplete="off"></div>
    <div class="row2">
      ${m.length ? `<a class="btn amber-o" href="#/sunting/${encodeURIComponent(r.id)}">Lengkapkan</a>` : '<span></span>'}
      <button type="button" class="btn violet" id="jana"${m.length ? ' disabled' : ''}>${I.doc}Jana surat</button>
    </div>
    ${m.length ? `<div class="sub">Perlu diisi dahulu: ${esc(m.join(', '))}.</div>` : ''}` : '<div class="sub">Hanya admin dan focal person boleh menjana surat.</div>'}
    <div id="done"></div>
  </div>`;
}

export default {
  nav: 'surat',
  render(ctx) {
    const id = String(ctx.q.get('id') || '').toUpperCase();
    if (id) {
      const r = state.byId.get(id);
      return r ? single(r) : `<div class="page">${header('Surat peringatan', { back: '#/surat' })}${empty('Rekod tidak dijumpai')}</div>`;
    }
    const tab = ctx.q.get('tab') || 'perlu';
    const due = suratDue();
    const up = suratUpcoming();
    const log = [...state.surat].sort((a, b) => (b.tarikh || 0) - (a.tarikh || 0));
    let body = '';
    if (tab === 'perlu') {
      body = due.length ? `<div class="list">${due.map(dueCard).join('')}</div>` : empty('Tiada surat perlu dijana', 'Surat muncul di sini 30 hari sebelum permit tahunan tamat.');
    } else if (tab === 'akan') {
      if (!up.length) body = empty('Tiada dalam 90 hari', 'Tiada permit tahunan yang tamat dalam tempoh 90 hari akan datang.');
      else {
        const groups = new Map();
        for (const x of up) {
          const k = +x.tarikhSurat;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(x.r);
        }
        body = [...groups.entries()].map(([k, rs]) => `<div class="count">Dijana ${esc(fmtLong(new Date(k)))} · ${rs.length} permit</div>
          <div class="list">${rs.map((r) => `<a class="rcard" href="#/surat?id=${encodeURIComponent(r.id)}"><div class="rcard-top"><div class="rcard-name">${esc(r.nama)}</div><span class="pill">${r.baki} hari</span></div><div class="sub">${esc(scase(r.jenis))} · tamat ${esc(fmtDate(r.tamat))}${missingForSurat(r).length ? ` · <span class="amber">${missingForSurat(r).length} ruang kosong</span>` : ''}</div></a>`).join('')}</div>`).join('');
      }
    } else {
      body = log.length ? `<div class="list">${log.map((s) => `<div class="rcard"><div class="rcard-top"><div class="rcard-name">${esc(s.nama)}</div><span class="sub">${esc(fmtShort(s.tarikh))}</span></div>
        <div class="sub">${esc(s.ruj || '-')} · ${esc(s.id)}</div>
        <div class="row-btns">${s.pdf ? `<a class="btn ghost sm" href="${esc(s.pdf)}" target="_blank" rel="noopener">${I.doc}PDF</a><button type="button" class="btn ghost sm" data-share="${esc(s.pdf)}" data-name="${esc(s.nama)}">${I.share}Kongsi</button>` : ''}${s.doc ? `<a class="btn ghost sm" href="${esc(s.doc)}" target="_blank" rel="noopener">${I.edit}Docs</a>` : ''}</div></div>`).join('')}</div>`
        : empty('Belum ada surat dijana');
    }
    const tabs = [['perlu', `Perlu dijana · ${due.length}`], ['akan', `Akan datang · ${up.length}`], ['dijana', `Dijana · ${log.length}`]];
    return `<div class="page">
      <div class="pt"><h1 class="h1">Surat peringatan</h1><div class="sub">Pembaharuan permit tahunan, 30 hari sebelum tamat</div></div>
      <div class="tabs" role="tablist" aria-label="Status surat">${tabs.map(([k, l]) => `<a role="tab" href="#/surat?tab=${k}" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div>
      ${body}
    </div>`;
  },
  bind(el, ctx) {
    const id = String(ctx.q.get('id') || '').toUpperCase();
    el.addEventListener('click', async (e) => {
      const sh = e.target.closest('[data-share]');
      if (sh) {
        try {
          busy(sh, true, '');
          const blob = await ctx.withAuth(() => pdfBlobFromLink(sh.dataset.share));
          await shareFile(blob, `Surat peringatan ${sh.dataset.name}.pdf`);
        } catch (err) { ctx.fail(err); } finally { busy(sh, false); }
      }
    });
    if (!id) return;
    const r = state.byId.get(id);
    if (!r) return;
    const ruj = el.querySelector('#ruj');
    if (ruj) {
      ruj.addEventListener('input', () => {
        el.querySelector('#pv').innerHTML = preview(r, ruj.value.trim());
      });
    }
    const jana = el.querySelector('#jana');
    if (jana) {
      jana.addEventListener('click', async () => {
        const v = ruj.value.trim();
        if (!v) { ruj.classList.add('err'); ruj.focus(); toast('Isi Ruj. Kami dahulu.', 'err'); return; }
        busy(jana, true, 'Menjana surat…');
        try {
          const res = await ctx.withAuth(() => janaSurat(r, v));
          busy(jana, false);
          const done = el.querySelector('#done');
          done.innerHTML = `<section class="note ok">
            <div class="note-t">${I.check}Surat dijana dan disimpan dalam Drive</div>
            <div class="row-btns">
              <a class="btn ghost sm" href="${esc(res.pdf)}" target="_blank" rel="noopener">${I.doc}Buka PDF</a>
              ${res.pdfBlob ? `<button type="button" class="btn ghost sm" id="share-now">${I.share}Kongsi PDF</button>` : ''}
              <a class="btn ghost sm" href="${esc(res.doc)}" target="_blank" rel="noopener">${I.edit}Sunting di Docs</a>
            </div></section>`;
          const s = done.querySelector('#share-now');
          if (s) s.addEventListener('click', () => shareFile(res.pdfBlob, `${res.nama}.pdf`));
          done.scrollIntoView({ behavior: 'smooth', block: 'center' });
          toast('Surat siap.', 'ok');
        } catch (err) {
          busy(jana, false);
          ctx.fail(err);
        }
      });
    }
  },
};
