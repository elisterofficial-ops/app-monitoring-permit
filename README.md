# APP Monitoring Permit

App telefon (PWA) untuk Bahagian Penguatkuasa memantau permit: hasil kutipan ikut unit dan bulan, carian permit, butiran permit dengan peta dan WhatsApp, tambah, ulang dan baharui permit, imbas nombor permit dari gambar, dan surat peringatan pembaharuan 30 hari sebelum tamat.

## Di mana data disimpan

Repo ini hanya mengandungi kod. **Tiada data permit di sini.** Semua rekod kekal dalam Google Sheet jabatan (tab DAFTAR, TETAPAN dan SURAT). Gambar dan surat disimpan dalam Google Drive pemilik Sheet. App membaca dan menulis terus ke Google menggunakan akaun Google pengguna sendiri, jadi hanya orang yang Sheet dikongsikan dengannya boleh melihat data.

ID Google Sheet juga tidak disimpan dalam kod. Ia dimasukkan sekali pada setiap telefon, sama ada ditampal di skrin log masuk atau melalui pautan `…/?sheet=<ID Sheet>` yang dikongsi oleh admin.

## Peranan

Peranan diambil dari tab TETAPAN (lajur Emel Pengguna APP, Nama dan Peranan):

- **ADMIN**: semua fungsi. Pemilik Sheet sentiasa ADMIN.
- **FOCAL PERSON**: tambah, sunting, imbas dan jana surat.
- **KETUA**: lihat sahaja.

Jika senarai emel kosong, semua orang yang ada akses ke Sheet dikira ADMIN.

Anggota ronda dan ketua boleh melihat tanpa log masuk melalui **pautan lihat sahaja**. Data pautan ini datang dari skrip Google milik admin yang hanya membaca lajur terpilih (tiada alamat, telefon, nama pengurus, no. resit, catatan atau gambar). Admin menghidupkan, menukar atau mematikan pautan di skrin Profil. ID skrip dan kunci disimpan dalam TETAPAN, bukan dalam repo.

## Tetapan

`js/config.js` mengandungi OAuth Client ID Google (jenis Web application). Asal (origin) yang dibenarkan untuk Client ID itu ialah alamat GitHub Pages repo ini.

## Pasang di telefon

Buka pautan app dalam Chrome, log masuk dengan Google, kemudian tekan **Pasang** (atau menu ⋮ → Tambah ke skrin utama).
