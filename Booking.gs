/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI — Logika Reservasi
 * ================================================
 */

function cekWaktuTersedia(tanggal, terapis) {
  const cfg = getSettingKlinik();
  const hariAngka = new Date(tanggal).getDay();
  
  if (cfg.hariLibur.includes(hariAngka)) {
    const namaHari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][hariAngka];
    return `Klinik libur setiap hari ${namaHari}. Silakan pilih tanggal lain.`;
  }

  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const sekarang = new Date();
  const tglSekarang = Utilities.formatDate(sekarang, tz, "yyyy-MM-dd");
  const jamSekarang = Utilities.formatDate(sekarang, tz, "HH:mm");
  const currentMinutes = timeStringToMinutes(jamSekarang);

  // +++ OPTIMASI NEON: Ambil data booking hanya untuk tanggal & terapis ini (Cepat & Skalabel) +++
  const waktuTerbooking = [];
  try {
    const sql = "SELECT jam FROM booking WHERE tanggal = ?::DATE AND LOWER(TRIM(terapis)) = LOWER(TRIM(?)) AND status NOT IN ('Batal', 'Cancel', 'Dibatalkan', 'Batal (Otomatis)')";
    const rawBookings = queryNeon(sql, [tanggal, terapis]);
    
    rawBookings.forEach(r => {
      let jamStr = r.jam || "";
      let jamB = normalisirWaktu(jamStr.toString());
      if (jamB) waktuTerbooking.push(jamB);
    });
  } catch (e) {
    console.error("Gagal ambil data ketersediaan dari Neon: " + e.message);
    // Fallback ke Sheets jika Neon error (Opsional, tapi demi keamanan operasional)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Booking");
    if (sheet) {
      const allData = sheet.getDataRange().getValues();
      const tglPilih = tanggal.toString().trim();
      const terapisPilih = terapis.toString().trim().toLowerCase();

      for (let i = 1; i < allData.length; i++) {
        const rowData = allData[i];
        let tglRow = (rowData[0] instanceof Date) ? Utilities.formatDate(rowData[0], tz, "yyyy-MM-dd") : rowData[0].toString().trim();
        let jamRow = normalisirWaktu(rowData[1]);
        let terapisRow = rowData[2].toString().trim().toLowerCase();
        let statusRow = (rowData[7] || "").toString().trim().toLowerCase();
        let isBatal = ["batal", "cancel", "canceled", "cancelled", "dibatalkan"].includes(statusRow);

        if (tglRow === tglPilih && terapisRow === terapisPilih && !isBatal) {
          if (jamRow && !waktuTerbooking.includes(jamRow)) waktuTerbooking.push(jamRow);
        }
      }
    }
  }

  let jamAktif = generateBookingSlotsFromSettings(cfg, {
    bookedTimes: waktuTerbooking,
    isToday: tanggal.toString().trim() === tglSekarang,
    currentMinutes: currentMinutes
  });

  if (!Array.isArray(jamAktif) || jamAktif.length === 0) {
    return `Slot tidak terbentuk. Cek Pengaturan: jam_buka=${cfg.jamBuka || '-'}, jam_tutup=${cfg.jamTutup || '-'}, istirahat=${cfg.jamIstirahatMulai || '-'}-${cfg.jamIstirahatSelesai || '-'}, durasi=${cfg.durasiSlotMenit || '-'}`;
  }

  // Normalisir daftar jam dari config
  let jamAktifNormal = jamAktif.map(j => normalisirWaktu(j));
  
  // Jika tanggal yang dipilih adalah HARI INI, buang jam yang sudah lewat
  if (tanggal.toString().trim() === tglSekarang) {
    jamAktifNormal = jamAktifNormal.filter(j => j > jamSekarang);
  }

  return jamAktifNormal.filter(j => !waktuTerbooking.includes(j));
}

const CHECKIN_WINDOW_BEFORE_MINUTES = 45;
const CHECKIN_WINDOW_AFTER_MINUTES = 15;
const BOOKING_HEADER_ROW = [
  "Tanggal",
  "Waktu",
  "Nama Terapis",
  "Jenis Kelamin Pasien",
  "Nama Lengkap",
  "No. HP/WA",
  "Layanan/Sesi",
  "Status",
  "Tensi Darah",
  "Keluhan Awal",
  "Tindakan/Catatan",
  "Rating Bintang",
  "Teks Ulasan",
  "Booking ID",
  "Check-In At",
  "Sumber Check-In"
];

function normalisirWaktu(waktuStr) {
  if (!waktuStr) return "";
  let s = waktuStr.toString().trim();
  // Tangani format HH:mm:ss -> HH:mm
  if (s.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
    s = s.substring(0, 5);
  }
  // Tambah nol di depan jika hanya satu digit jam (misal 8:30 -> 08:30)
  if (s.match(/^\d:\d{2}$/)) {
    s = "0" + s;
  }
  return s;
}

function timeStringToMinutes(timeStr) {
  const normalized = normalisirWaktu(timeStr);
  if (!normalized || !/^\d{2}:\d{2}$/.test(normalized)) return null;
  const parts = normalized.split(":").map(function(v) { return parseInt(v, 10); });
  if (parts.length !== 2 || parts.some(function(v) { return isNaN(v); })) return null;
  return (parts[0] * 60) + parts[1];
}

function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return ("0" + hours).slice(-2) + ":" + ("0" + minutes).slice(-2);
}

function buildSlotsForWindow(windowStart, windowEnd, durationMinutes) {
  const slots = [];
  if (windowStart === null || windowEnd === null || !durationMinutes || windowEnd <= windowStart) return slots;

  for (let cursor = windowStart; cursor < windowEnd; cursor += durationMinutes) {
    if ((cursor + durationMinutes) > windowEnd) break;
    slots.push(minutesToTimeString(cursor));
  }
  return slots;
}

function timeRangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function buildMorningFlexibleSlots(openMinutes, breakStartMinutes, durationMinutes, bookedTimes) {
  if (openMinutes === null || breakStartMinutes === null || !durationMinutes || breakStartMinutes <= openMinutes) return [];
  const stepMinutes = Math.max(1, Math.floor(durationMinutes / 2));
  const strictSlots = buildSlotsForWindow(openMinutes, breakStartMinutes, durationMinutes);
  const shiftedSlots = buildSlotsForWindow(openMinutes + stepMinutes, breakStartMinutes, durationMinutes);
  const bookedMorningMinutes = (Array.isArray(bookedTimes) ? bookedTimes : [])
    .map(timeStringToMinutes)
    .filter(function(value) {
      return value !== null && value >= openMinutes && value < breakStartMinutes;
    })
    .sort(function(a, b) { return a - b; });

  let activeSlots = strictSlots.concat(shiftedSlots);
  if (bookedMorningMinutes.length > 0) {
    const firstBooked = bookedMorningMinutes[0];
    const useShiftedPattern = (firstBooked - openMinutes) === stepMinutes;
    activeSlots = useShiftedPattern ? shiftedSlots : strictSlots;
  } else {
    activeSlots = Array.from(new Set(activeSlots))
      .map(function(slot) { return normalisirWaktu(slot); })
      .filter(Boolean)
      .sort(function(a, b) {
        return timeStringToMinutes(a) - timeStringToMinutes(b);
      });
  }

  return activeSlots.filter(function(slot) {
    const slotMinutes = timeStringToMinutes(slot);
    if (slotMinutes === null) return false;
    return !bookedMorningMinutes.some(function(bookedMinute) {
      return timeRangesOverlap(slotMinutes, slotMinutes + durationMinutes, bookedMinute, bookedMinute + durationMinutes);
    });
  });
}

function generateBookingSlots(openTime, closeTime, breakStart, breakEnd, durationMinutes, fallbackSlots, fallbackBreaks) {
  const openMinutes = timeStringToMinutes(openTime);
  const closeMinutes = timeStringToMinutes(closeTime);
  const slotDuration = Math.max(1, parseInt(durationMinutes, 10) || 60);

  // Slot booking sekarang hanya mengikuti config inti.
  // `jam_operasional` tidak lagi dipakai agar tidak bentrok dengan jalur A/B.
  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
    return [];
  }

  const breakStartMinutes = timeStringToMinutes(breakStart);
  const breakEndMinutes = timeStringToMinutes(breakEnd);
  let slots = [];

  if (breakStartMinutes !== null && breakEndMinutes !== null && breakEndMinutes > breakStartMinutes) {
    slots = slots.concat(buildSlotsForWindow(openMinutes, breakStartMinutes, slotDuration));
    slots = slots.concat(buildSlotsForWindow(breakEndMinutes, closeMinutes, slotDuration));
  } else {
    slots = buildSlotsForWindow(openMinutes, closeMinutes, slotDuration);
  }

  return slots;
}

function generateBookingSlotsFromSettings(cfg, context) {
  const settings = cfg || {};
  const runtimeContext = context || {};
  let breakStart = settings.jamIstirahatMulai || "";
  let breakEnd = settings.jamIstirahatSelesai || "";

  if ((!breakStart || !breakEnd) && Array.isArray(settings.jamIstirahat)) {
    settings.jamIstirahat.forEach(function(item) {
      const value = String(item || "").trim();
      if (!value || value.indexOf("-") === -1) return;
      const parts = value.split("-").map(function(v) { return normalisirWaktu(v); });
      if (parts.length === 2 && !breakStart && !breakEnd) {
        breakStart = parts[0];
        breakEnd = parts[1];
      }
    });
  }

  const generated = generateBookingSlots(
    settings.jamBuka,
    settings.jamTutup,
    breakStart,
    breakEnd,
    settings.durasiSlotMenit,
    settings.jamOperasional,
    settings.jamIstirahat
  );

  const breakStartMinutes = timeStringToMinutes(breakStart);
  const openMinutes = timeStringToMinutes(settings.jamBuka);
  const slotDuration = Math.max(1, parseInt(settings.durasiSlotMenit, 10) || 60);
  if (openMinutes === null || breakStartMinutes === null || breakStartMinutes <= openMinutes) {
    return generated;
  }

  const afternoonSlots = generated.filter(function(slot) {
    const minutes = timeStringToMinutes(slot);
    return minutes === null || minutes >= breakStartMinutes;
  });

  const morningSlots = buildMorningFlexibleSlots(
    openMinutes,
    breakStartMinutes,
    slotDuration,
    runtimeContext.bookedTimes || []
  );

  return morningSlots.concat(afternoonSlots);
}

function simpanBookingData(dataForm) {
  // Proteksi jika dataForm undefined (misal dipanggil manual dari editor)
  if (!dataForm) {
    console.error("simpanBookingData dipanggil tanpa data!");
    return { status: "error", message: "Data form tidak ditemukan." };
  }
  
  const { nama, nohp, tanggal, terapis, waktu, jenisKelamin, sesiBekam, keluhan } = dataForm;

  if (!nama || !nohp || !tanggal || !terapis || !waktu || !jenisKelamin || !sesiBekam) {
    return { status: "error", message: "Semua kolom formulir wajib diisi." };
  }

  const namaSani = nama.toString().replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const hpSani   = nohp.toString().replace(/[^0-9+]/g, "");
  const keluhanSani = (keluhan || "").toString().replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const cache = CacheService.getScriptCache();
  if (cache.get("spam_" + hpSani)) {
    return { status: "error", message: "Nomor ini baru saja digunakan untuk booking. Tunggu 5 menit lagi." };
  }

  const lock = LockService.getScriptLock();
  let bookingId = "";
  let checkInPayload = "";
  let checkInWindow = null;
  try {
    lock.waitLock(30000); 
    
    const tersedia = cekWaktuTersedia(tanggal, terapis);
    if (typeof tersedia === "string") return { status: "error", message: tersedia };
    
    if (!tersedia.includes(waktu.toString().trim())) {
      return { status: "error", message: "Slot waktu ini baru saja diambil pasien lain. Silakan pilih jam lain." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Booking");
    if (!sheet) {
      sheet = ss.insertSheet("Booking");
    }
    
    // Gunakan fungsi mandiri untuk cek & buat header
    initSheetBooking(sheet);

    bookingId = buatBookingId(tanggal, hpSani);
    checkInPayload = buatCheckInPayload(bookingId, tanggal, waktu);
    checkInWindow = getCheckInWindowInfo(tanggal, waktu);

    // [Tanggal, Waktu, Terapis, JK, Nama, HP, Layanan, Status, Tensi, Keluhan, Tindakan, Rating, Ulasan, Booking ID, Check-In At, Sumber]
    sheet.appendRow([tanggal, waktu, terapis, jenisKelamin, namaSani, hpSani, sesiBekam, "Terjadwal", "", keluhanSani, "", "", "", bookingId, "", ""]);
    
    // +++ SIMPAN KE NEON (REAL-TIME) +++
    try {
      // 1. Sync ke Pasien
      executeNeon("INSERT INTO pasien (nama, hp) VALUES (?, ?) ON CONFLICT (hp) DO UPDATE SET nama = EXCLUDED.nama, last_synced = CURRENT_TIMESTAMP", [namaSani, hpSani]);
      
      // 2. Sync ke Booking
      const sqlB = `INSERT INTO booking (booking_id, nama, hp, tanggal, jam, terapis, layanan, status, catatan) VALUES (?, ?, ?, ?::DATE, ?, ?, ?, ?, ?)`;
      executeNeon(sqlB, [bookingId, namaSani, hpSani, tanggal, waktu, terapis, sesiBekam, "Terjadwal", keluhanSani]);
      
    } catch(e) { console.error("Gagal sinkronisasi ke Neon: " + e.message); }

    cache.put("spam_" + hpSani, "block", 300); // limit 300 detik (5 menit)
    
    try { updateLaporanSheets(); } catch(e) { console.error("Update sheet gagal: " + e.message); }
    
  } catch (err) {
    return { status: "error", message: "Gagal menyimpan (Gantrian Penuh/Spreadsheet Error): " + err.message };
  } finally {
    lock.releaseLock();
  }

  try {
    const cfg = getSettingKlinik();
    try {
      const startTime = new Date(`${tanggal}T${waktu}:00`);
      const endTime   = new Date(startTime.getTime() + (90 * 60 * 1000));
      const cal = CalendarApp.getDefaultCalendar();
      cal.createEvent(`Bekam: ${namaSani}`, startTime, endTime, {
        description: `Terapis: ${terapis}\nLayanan: ${sesiBekam}\nNo. HP: ${hpSani}`,
        location: cfg.mapsLink || "Rumah Sehat Dani Sabri"
      });
    } catch (e) { console.error("Gagal buat kalender: " + e.message); }

    const adminEmail = cfg.adminEmail; 
    if (adminEmail && adminEmail.includes("@")) {
      try {
        const subjek = `[BOOKING BARU] ${namaSani} - ${tanggal}`;
        const bodyHTML = `<div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;"><div style="background: #064e3b; color: white; padding: 20px; text-align: center;"><h2 style="margin: 0;">Reservasi Baru Masuk</h2></div><div style="padding: 20px; color: #333;"><p>Halo Admin <b>Rumah Sehat Dani Sabri</b>,</p><p>Ada pendaftaran reservasi baru melalui sistem online:</p><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><b>Nama</b></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">: ${namaSani}</td></tr><tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><b>HP/WA</b></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">: ${hpSani}</td></tr><tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><b>Jadwal</b></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">: ${tanggal} jam ${waktu}</td></tr><tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><b>Terapis</b></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">: ${terapis}</td></tr><tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><b>Layanan</b></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">: ${sesiBekam}</td></tr></table><div style="margin-top: 20px; text-align: center;"><a href="https://docs.google.com/spreadsheets/d/${SpreadsheetApp.getActiveSpreadsheet().getId()}" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Buka Spreadsheet</a></div></div></div>`;
        MailApp.sendEmail({ to: adminEmail, subject: subjek, htmlBody: bodyHTML });
      } catch (e) { console.error("Gagal kirim email: " + e.message); }
    }

    // +++ NOTIFIKASI EMAIL KE TERAPIS YANG BERSANGKUTAN +++
    try {
      const semuaTerapis = getDaftarTerapisInternal();
      const dataTerapis  = semuaTerapis.find(t => t.nama.trim().toLowerCase() === terapis.trim().toLowerCase());
      const emailTerapis = dataTerapis ? dataTerapis.email : "";

      if (emailTerapis && emailTerapis.includes("@")) {
        const subjekTerapis = `[JADWAL BARU] ${namaSani} - ${tanggal} Jam ${waktu}`;
        const bodyTerapis = `
<div style="font-family: Arial, sans-serif; max-width: 580px; border: 1px solid #d1fae5; border-radius: 12px; overflow: hidden;">
  <div style="background: #047857; color: white; padding: 20px; text-align: center;">
    <h2 style="margin: 0; font-size: 18px;">📋 Ada Pasien Baru untuk Anda</h2>
  </div>
  <div style="padding: 24px; color: #1f2937; background: #f9fafb;">
    <p style="margin: 0 0 16px;">Assalamu'alaikum, <b>${terapis}</b>.</p>
    <p style="margin: 0 0 16px;">Ada pasien baru yang telah mendaftarkan jadwal bekam untuk <b>Anda</b> melalui sistem online klinik. Berikut rinciannya:</p>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr style="background: #ecfdf5;">
        <td style="padding: 10px 14px; font-weight: bold; width: 40%; border-bottom: 1px solid #d1fae5;">👤 Nama Pasien</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #d1fae5;">${namaSani}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: bold; border-bottom: 1px solid #f3f4f6;">📞 No. HP/WA</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f3f4f6;">${hpSani}</td>
      </tr>
      <tr style="background: #ecfdf5;">
        <td style="padding: 10px 14px; font-weight: bold; border-bottom: 1px solid #d1fae5;">📅 Tanggal</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #d1fae5;">${tanggal}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: bold; border-bottom: 1px solid #f3f4f6;">⏰ Jam</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f3f4f6;">${waktu} WIB</td>
      </tr>
      <tr style="background: #ecfdf5;">
        <td style="padding: 10px 14px; font-weight: bold; border-bottom: 1px solid #d1fae5;">💆 Layanan</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #d1fae5;">${sesiBekam}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: bold;">🩺 Keluhan</td>
        <td style="padding: 10px 14px;">${keluhanSani || "-"}</td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; font-size: 13px; color: #6b7280; text-align: center;">Mohon hadir tepat waktu dan siapkan perlengkapan terapi. Jazakallahu khairan. 🤲</p>
  </div>
</div>`;
        MailApp.sendEmail({ to: emailTerapis, subject: subjekTerapis, htmlBody: bodyTerapis });
        Logger.log("Email notifikasi terkirim ke terapis: " + emailTerapis);
      }
    } catch (e) { console.error("Gagal kirim email ke terapis: " + e.message); }

    
    const waNumber = cfg.waAdmin;
    const mapsInfo = cfg.mapsLink ? `\n📍 *Maps*: ${cfg.mapsLink}` : "";
    const pesanWA = `Halo Admin *Rumah Sehat Dani Sabri*,\n\nSaya ingin konfirmasi booking:\n📌 *Nama*: ${namaSani}\n📅 *Tanggal*: ${tanggal}\n⏰ *Waktu*: ${waktu}\n👨‍⚕️ *Terapis*: ${terapis}\n💆‍♂️ *Layanan*: ${sesiBekam}${mapsInfo}\n\nMohon diverifikasi segera ya. Terimakasih!`;
    const waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(pesanWA)}`;

    return {
      status: "success",
      message: "Booking berhasil disimpan!",
      data: {
        nama: namaSani,
        tanggal: tanggal,
        waktu: waktu,
        terapis: terapis,
        sesi: sesiBekam,
        whatsappUrl: waUrl,
        bookingId: bookingId,
        checkIn: {
          payload: checkInPayload,
          qrUrl: buildCheckInQrUrl(checkInPayload),
          validFrom: checkInWindow ? checkInWindow.validFrom : "",
          expiresAt: checkInWindow ? checkInWindow.expiresAt : "",
          note: `QR aktif ${CHECKIN_WINDOW_BEFORE_MINUTES} menit sebelum jadwal sampai ${CHECKIN_WINDOW_AFTER_MINUTES} menit sesudah jadwal.`
        }
      }
    };
  } catch (err) {
    console.error("Error ekstensi eksternal: " + err.message);
    return {
      status: "success",
      message: "Terjadwal, tetapi konektivitas notifikasi terhambat.",
      data: {
        nama: namaSani,
        tanggal: tanggal,
        waktu: waktu,
        terapis: terapis,
        sesi: sesiBekam,
        whatsappUrl: "",
        bookingId: bookingId,
        checkIn: {
          payload: checkInPayload,
          qrUrl: buildCheckInQrUrl(checkInPayload),
          validFrom: checkInWindow ? checkInWindow.validFrom : "",
          expiresAt: checkInWindow ? checkInWindow.expiresAt : "",
          note: `QR aktif ${CHECKIN_WINDOW_BEFORE_MINUTES} menit sebelum jadwal sampai ${CHECKIN_WINDOW_AFTER_MINUTES} menit sesudah jadwal.`
        }
      }
    };
  }
}

function cekStatusUser(hp) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return { status: "error", message: "Spreadsheet tidak ditemukan." };

  const sheet = ss.getSheetByName("Booking");
  if (!sheet) return { status: "error", message: "Belum ada data reservasi sama sekali." };

  const allData = sheet.getDataRange().getValues();
  // allDisplayData dihapus untuk efisiensi

  if (allData.length < 2) return { status: "success", data: [] };

  const tz = ss.getSpreadsheetTimeZone();
  const hasil = [];
  const noHpBersih = normalizeHp(hp);

  // Mulai dari indeks 1 (baris ke-2)
  for (let i = 1; i < allData.length; i++) {
    const rowData = allData[i];

    if (!rowData[0] && !rowData[4]) continue;

    let tglBooking = "";
    if (Object.prototype.toString.call(rowData[0]) === '[object Date]') {
      tglBooking = Utilities.formatDate(rowData[0], tz, "yyyy-MM-dd");
    } else {
      tglBooking = (rowData[0] || "").toString().trim();
    }

    let hpTabel = normalizeHp(rowData[5]);
    if (hpTabel !== "" && hpTabel === noHpBersih) {
       // --- LOGIKA AUTO-CANCEL (10 MENIT) ---
       let jamB = rowData[1];
       let jamBookingStr = (Object.prototype.toString.call(jamB) === '[object Date]') ? Utilities.formatDate(jamB, tz, "HH:mm") : (jamB || "").toString().trim().substring(0, 5);

       let currentStatus = bantuAutoCancel(sheet, i + 1, rowData, jamBookingStr, tz);

       hasil.push({ 
         row: i + 1, 
         tanggal: tglBooking, 
         waktu: jamBookingStr, 
         terapis: (rowData[2] || "").toString().trim(), 
         layanan: (rowData[6] || "").toString().trim(), 
         status: currentStatus,
         bookingId: (rowData[13] || "").toString().trim(),
         checkIn: (rowData[13] || "").toString().trim() ? {
           payload: buatCheckInPayload((rowData[13] || "").toString().trim(), tglBooking, jamBookingStr),
           validFrom: getCheckInWindowInfo(tglBooking, jamBookingStr).validFrom,
           expiresAt: getCheckInWindowInfo(tglBooking, jamBookingStr).expiresAt
         } : null
        });
    }
  }
  return { status: "success", data: hasil.reverse() };
}

function batalByUser(dataForm) {
  const hp = dataForm.hp;
  const row = parseInt(dataForm.row);
  
  const cfg = getSettingKlinik();
  const passAdmin = cfg.adminPass;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Booking");
    if (!sheet) return { status: "error", message: "Gagal membatalkan." };

    const targetRowData = sheet.getRange(row, 1, 1, 8).getValues()[0];
    const hpSheet = normalizeHp(targetRowData[5]);
    const targetHp = normalizeHp(hp);

    if (hpSheet === targetHp || hp === passAdmin) {
      sheet.getRange(row, 8).setValue("Batal");
      
      // +++ BARU: Hapus dari kalender & Send Notif Batal +++
      notifDanUbahKalenderBatal(targetRowData, "PASIEN SENDIRI (Lacak Booking)");
      
      return { status: "success", message: "Jadwal berhasil dibatalkan." };
    } else {
      return { status: "error", message: "Otorisasi gagal, bukan pemilik valid." };
    }
  } catch (err) {
    return { status: "error", message: "Sistem sibuk, silakan coba lagi: " + err.message };
  } finally {
    lock.releaseLock();
  }
}


// ── FUNGSI BARU: OTOMATIS UBAH GOOGLE CALENDAR DAN KIRIM EMAIL SAAT BATAL ──
function notifDanUbahKalenderBatal(rowData, pelakunya) {
  try {
    const cfg = getSettingKlinik();
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "Asia/Jakarta";
    
    // Ekstrak data dari array baris
    let tanggalStr = "";
    if (Object.prototype.toString.call(rowData[0]) === '[object Date]') {
      tanggalStr = Utilities.formatDate(rowData[0], tz, "yyyy-MM-dd");
    } else {
      tanggalStr = rowData[0].toString().trim();
    }
    
    const waktuStr = rowData[1].toString().substring(0, 5);
    const terapis = rowData[2].toString().trim();
    const nama = rowData[4].toString().trim();
    
    // 1. UBAH GOOGLE CALENDAR JADI "MERAH" DAN "[DIBATALKAN]"
    try {
      const startTime = new Date(`${tanggalStr}T${waktuStr}:00`);
      const endTime   = new Date(startTime.getTime() + (90 * 60 * 1000));
      const cal = CalendarApp.getDefaultCalendar();
      
      // Ambil semua event terkait nama ini di rentang hari tersebut
      const tglAwal = new Date(`${tanggalStr}T00:00:00`);
      const tglAkhir = new Date(`${tanggalStr}T23:59:59`);
      const events = cal.getEvents(tglAwal, tglAkhir, { search: nama });
      
      for (let evi of events) {
        evi.setTitle(`[DIBATALKAN] Bekam: ${nama}`);
        evi.setColor(CalendarApp.EventColor.RED); // Merah untuk batal
      }
    } catch (e) {
      console.error("Gagal cari/ubah kalender saat dibatalkan: " + e.message); 
    }

    // 2. KIRIM EMAIL NOTIFIKASI KE ADMIN
    const adminEmail = cfg.adminEmail; 
    if (adminEmail && adminEmail.includes("@")) {
      try {
        const subjek = `[BATAL] Reservasi ${nama} - ${tanggalStr}`;
        const bodyHTML = `<div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;"><div style="background: #e11d48; color: white; padding: 20px; text-align: center;"><h2 style="margin: 0;">Terjadi Pembatalan Jadwal</h2></div><div style="padding: 20px; color: #333;"><p>Halo Admin,</p><p>Jadwal berikut baru saja <b>DIBATALKAN</b> melalui sistem:</p><ul><li><b>Nama Pasien:</b> ${nama}</li><li><b>Jadwal Lama:</b> ${tanggalStr} jam ${waktuStr}</li><li><b>Terapis:</b> ${terapis}</li><li><b>Dibatalkan oleh:</b> ${pelakunya}</li></ul><p>Sistem telah sukses mengubah jadwal di Google Calendar Bapak menjadi tulisan [DIBATALKAN] dan diberi warna <b>MERAH</b>.</p></div></div>`;
        MailApp.sendEmail({ to: adminEmail, subject: subjek, htmlBody: bodyHTML });
      } catch (e) { 
        console.error("Gagal kirim notif email pembatalan: " + e.message); 
      }
    }

    // 3. KIRIM EMAIL NOTIFIKASI BATAL KE TERAPIS YANG BERSANGKUTAN
    try {
      const semuaTerapis = getDaftarTerapisInternal();
      const dataTerapis  = semuaTerapis.find(t => t.nama.trim().toLowerCase() === terapis.trim().toLowerCase());
      const emailTerapis = dataTerapis ? dataTerapis.email : "";

      if (emailTerapis && emailTerapis.includes("@")) {
        const subjekTerapis = `[JADWAL DIBATALKAN] ${nama} - ${tanggalStr} Jam ${waktuStr}`;
        const bodyTerapis = `
<div style="font-family: Arial, sans-serif; max-width: 580px; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden;">
  <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
    <h2 style="margin: 0; font-size: 18px;">❌ Jadwal Anda Dibatalkan</h2>
  </div>
  <div style="padding: 24px; color: #1f2937; background: #fff7f7;">
    <p style="margin: 0 0 16px;">Assalamu'alaikum, <b>${terapis}</b>.</p>
    <p style="margin: 0 0 16px;">Informasi penting: Jadwal pasien berikut telah <b style="color:#dc2626;">DIBATALKAN</b>. Slot waktu tersebut kini kembali tersedia.</p>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr style="background: #fef2f2;">
        <td style="padding: 10px 14px; font-weight: bold; width: 40%; border-bottom: 1px solid #fee2e2;">👤 Nama Pasien</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #fee2e2;">${nama}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: bold; border-bottom: 1px solid #f3f4f6;">📅 Tanggal</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f3f4f6;">${tanggalStr}</td>
      </tr>
      <tr style="background: #fef2f2;">
        <td style="padding: 10px 14px; font-weight: bold; border-bottom: 1px solid #fee2e2;">⏰ Jam</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #fee2e2;">${waktuStr} WIB</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: bold;">🙍 Dibatalkan oleh</td>
        <td style="padding: 10px 14px;">${pelakunya}</td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; font-size: 13px; color: #6b7280; text-align: center;">Jika ada pertanyaan, silakan hubungi admin klinik. Jazakallahu khairan. 🤲</p>
  </div>
</div>`;
        MailApp.sendEmail({ to: emailTerapis, subject: subjekTerapis, htmlBody: bodyTerapis });
        Logger.log("Email batal terkirim ke terapis: " + emailTerapis);
      }
    } catch (e) { console.error("Gagal kirim email batal ke terapis: " + e.message); }

  } catch (err) {
    console.error("Fatal Notif Batal: " + err.message);
  }
}

function initSheetBooking(customSheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = customSheet || ss.getSheetByName("Booking") || ss.insertSheet("Booking");
  
  if (sheet.getMaxColumns() < BOOKING_HEADER_ROW.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), BOOKING_HEADER_ROW.length - sheet.getMaxColumns());
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(BOOKING_HEADER_ROW);
    sheet.getRange(1, 1, 1, BOOKING_HEADER_ROW.length).setFontWeight("bold").setBackground("#2e7d32").setFontColor("white");
  } else {
    const currentHeader = sheet.getRange(1, 1, 1, BOOKING_HEADER_ROW.length).getValues()[0];
    let changed = false;
    for (let i = 0; i < BOOKING_HEADER_ROW.length; i++) {
      if ((currentHeader[i] || "").toString().trim() !== BOOKING_HEADER_ROW[i]) {
        currentHeader[i] = BOOKING_HEADER_ROW[i];
        changed = true;
      }
    }
    if (changed) {
      sheet.getRange(1, 1, 1, BOOKING_HEADER_ROW.length).setValues([currentHeader]);
      sheet.getRange(1, 1, 1, BOOKING_HEADER_ROW.length).setFontWeight("bold").setBackground("#2e7d32").setFontColor("white");
    }
  }
}

function buatBookingId(tanggal, hpSani) {
  return `B-${tanggal.toString().replace(/-/g,'')}-${hpSani.slice(-4)}-${Date.now().toString().slice(-4)}`;
}

function getCheckInSecret() {
  try {
    const cms = getLandingSettings();
    if (cms && cms.status === "success" && cms.data && cms.data.cms_checkin_secret_code) {
      return cms.data.cms_checkin_secret_code.toString().trim();
    }
  } catch (e) {}
  const apiToken = getRahasia('API_TOKEN');
  if (apiToken) return apiToken;
  throw new Error("Rahasia check-in belum dikonfigurasi. Atur cms_checkin_secret_code atau API_TOKEN.");
}

function buildCheckInSignature(baseText) {
  const raw = Utilities.computeHmacSha256Signature(baseText, getCheckInSecret());
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/g, "");
}

function buatCheckInPayload(bookingId, tanggal, waktu) {
  const windowInfo = getCheckInWindowInfo(tanggal, waktu);
  const expMs = windowInfo.expiresAtMs;
  const baseText = `${bookingId}|${expMs}`;
  const signature = buildCheckInSignature(baseText);
  return `RSDS|${bookingId}|${expMs}|${signature}`;
}

function parseCheckInPayload(payload) {
  const raw = (payload || "").toString().trim();
  const parts = raw.split("|");
  if (parts.length !== 4 || parts[0] !== "RSDS") {
    throw new Error("Format QR check-in tidak valid.");
  }
  return {
    bookingId: parts[1],
    expiresAtMs: parseInt(parts[2], 10),
    signature: parts[3]
  };
}

function buildCheckInQrUrl(payload) {
  return "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" + encodeURIComponent(payload);
}

function getClinicCheckInPayload() {
  return "RSDS-CLINIC|" + getCheckInSecret();
}

function parseSheetLocalDateTime(tanggal, waktu) {
  const dateStr = (tanggal || "").toString().trim();
  const timeStr = normalisirWaktu(waktu);
  if (!dateStr || !timeStr) return null;

  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "Asia/Jakarta";
  const baseUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  if (isNaN(baseUtc.getTime())) return null;

  const offsetRaw = Utilities.formatDate(baseUtc, tz, "Z");
  const sign = offsetRaw.charAt(0) === "-" ? -1 : 1;
  const hours = parseInt(offsetRaw.substring(1, 3), 10) || 0;
  const minutes = parseInt(offsetRaw.substring(3, 5), 10) || 0;
  const offsetMinutes = sign * ((hours * 60) + minutes);

  return new Date(baseUtc.getTime() - (offsetMinutes * 60 * 1000));
}

function getCheckInWindowInfo(tanggal, waktu) {
  const schedule = parseSheetLocalDateTime(tanggal, waktu);
  if (!schedule) {
    return {
      schedule: null,
      validFrom: "",
      expiresAt: "",
      validFromMs: 0,
      expiresAtMs: 0
    };
  }
  const validFrom = new Date(schedule.getTime() - (CHECKIN_WINDOW_BEFORE_MINUTES * 60 * 1000));
  const expiresAt = new Date(schedule.getTime() + (CHECKIN_WINDOW_AFTER_MINUTES * 60 * 1000));
  return {
    schedule: schedule,
    validFrom: formatDateTimeLocal(validFrom),
    expiresAt: formatDateTimeLocal(expiresAt),
    validFromMs: validFrom.getTime(),
    expiresAtMs: expiresAt.getTime()
  };
}

function formatDateTimeLocal(dateObj) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "Asia/Jakarta";
  return Utilities.formatDate(dateObj, tz, "yyyy-MM-dd HH:mm");
}

function findBookingRowByBookingId(sheet, bookingId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const bookingIds = sheet.getRange(2, 14, lastRow - 1, 1).getValues();
  for (let i = 0; i < bookingIds.length; i++) {
    if ((bookingIds[i][0] || "").toString().trim() === bookingId) {
      return i + 2;
    }
  }
  return -1;
}

function findBookingRowByNeonFallback(sheet, bookingId) {
  try {
    const rows = queryNeon("SELECT hp, tanggal, jam FROM booking WHERE booking_id = ? LIMIT 1", [bookingId]);
    if (!rows || rows.length === 0) return -1;

    const match = rows[0] || {};
    const targetHp = normalizeHp(match.hp || "");
    const targetTanggal = (match.tanggal || "").toString().trim().substring(0, 10);
    const targetWaktu = normalisirWaktu(match.jam || "");
    if (!targetHp || !targetTanggal || !targetWaktu) return -1;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tz = ss.getSpreadsheetTimeZone() || "Asia/Jakarta";
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;

    const allRows = sheet.getRange(2, 1, lastRow - 1, BOOKING_HEADER_ROW.length).getValues();
    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const rowTanggal = rowData[0] instanceof Date ? Utilities.formatDate(rowData[0], tz, "yyyy-MM-dd") : (rowData[0] || "").toString().trim();
      const rowWaktu = normalisirWaktu(rowData[1]);
      const rowHp = normalizeHp(rowData[5]);
      if (rowTanggal === targetTanggal && rowWaktu === targetWaktu && rowHp === targetHp) {
        const rowNumber = i + 2;
        sheet.getRange(rowNumber, 14).setValue(bookingId);
        return rowNumber;
      }
    }
  } catch (e) {
    console.error("Fallback cari booking via Neon gagal: " + e.message);
  }
  return -1;
}

function selfCheckIn(dataForm) {
  const rowHint = parseInt(dataForm && dataForm.row, 10);
  const payload = (dataForm && (dataForm.payload || dataForm.code || dataForm.token || "")).toString().trim();
  const clinicCode = (dataForm && (dataForm.clinicCode || dataForm.scannedCode || "")).toString().trim();
  if (!payload) {
    return { status: "error", message: "Kode check-in belum diisi." };
  }
  if (!clinicCode) {
    return { status: "error", message: "Silakan scan QR check-in di meja admin terlebih dahulu." };
  }
  if (clinicCode !== getClinicCheckInPayload()) {
    return { status: "error", message: "QR klinik tidak valid. Arahkan kamera ke QR resmi di meja admin." };
  }

  let parsed;
  try {
    parsed = parseCheckInPayload(payload);
  } catch (err) {
    return { status: "error", message: err.message };
  }

  const expectedSignature = buildCheckInSignature(`${parsed.bookingId}|${parsed.expiresAtMs}`);
  if (expectedSignature !== parsed.signature) {
    return { status: "error", message: "QR check-in tidak valid atau sudah dimodifikasi." };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Booking");
    if (!sheet) return { status: "error", message: "Data booking tidak ditemukan." };

    initSheetBooking(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { status: "error", message: "Belum ada data booking." };

    let targetRow = -1;
    if (!isNaN(rowHint) && rowHint >= 2 && rowHint <= lastRow) {
      const hintedBookingId = (sheet.getRange(rowHint, 14).getValue() || "").toString().trim();
      if (hintedBookingId === parsed.bookingId) {
        targetRow = rowHint;
      }
    }
    if (targetRow < 2) {
      targetRow = findBookingRowByBookingId(sheet, parsed.bookingId);
    }
    if (targetRow < 2) {
      targetRow = findBookingRowByNeonFallback(sheet, parsed.bookingId);
    }
    if (targetRow < 2) {
      return { status: "error", message: "Booking untuk QR ini tidak ditemukan." };
    }

    const rowData = sheet.getRange(targetRow, 1, 1, BOOKING_HEADER_ROW.length).getValues()[0];
    const tz = ss.getSpreadsheetTimeZone() || "Asia/Jakarta";
    const tanggal = rowData[0] instanceof Date ? Utilities.formatDate(rowData[0], tz, "yyyy-MM-dd") : (rowData[0] || "").toString().trim();
    const waktu = normalisirWaktu(rowData[1]);
    const statusSaatIni = (rowData[7] || "Terjadwal").toString().trim();
    const statusLower = statusSaatIni.toLowerCase();

    if (["batal", "cancel", "dibatalkan", "batal (otomatis)"].includes(statusLower)) {
      return { status: "error", message: "Booking ini sudah dibatalkan, tidak bisa check-in." };
    }
    if (["hadir", "selesai"].includes(statusLower)) {
      return { status: "error", message: "Booking ini sudah pernah diproses check-in." };
    }

    const windowInfo = getCheckInWindowInfo(tanggal, waktu);
    const now = Date.now();
    if (now < windowInfo.validFromMs) {
      return {
        status: "error",
        message: `QR belum aktif. Check-in dibuka mulai ${windowInfo.validFrom}.`
      };
    }
    if (parsed.expiresAtMs !== windowInfo.expiresAtMs) {
      return { status: "error", message: "QR check-in sudah tidak sesuai dengan jadwal booking. Buka ulang halaman status untuk memuat QR terbaru." };
    }
    if (now > windowInfo.expiresAtMs) {
      return {
        status: "error",
        message: `QR sudah kedaluwarsa. Batas check-in sampai ${windowInfo.expiresAt}.`
      };
    }

    const checkInTime = formatDateTimeLocal(new Date(now));
    sheet.getRange(targetRow, 8).setValue("HADIR");
    sheet.getRange(targetRow, 15, 1, 2).setValues([[checkInTime, "QR Scan"]]);

    try {
      const hp = (rowData[5] || "").toString().replace(/[^0-9+]/g, "");
      executeNeon("UPDATE booking SET status = ? WHERE booking_id = ? OR (tanggal = ?::DATE AND hp = ?)", ["HADIR", parsed.bookingId, tanggal, hp]);
    } catch (e) { console.error("Gagal update status check-in ke Neon: " + e.message); }

    return {
      status: "success",
      message: "Check-in berhasil. Status pasien diperbarui menjadi HADIR.",
      data: {
        row: targetRow,
        bookingId: parsed.bookingId,
        nama: (rowData[4] || "").toString().trim(),
        terapis: (rowData[2] || "").toString().trim(),
        tanggal: tanggal,
        waktu: waktu,
        checkInAt: checkInTime
      }
    };
  } catch (err) {
    return { status: "error", message: "Gagal memproses check-in: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

function submitReview(dataForm) {
  const { row, rating, ulasan, hp } = dataForm;
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Booking");
    
    if (!sheet) return { status: "error", message: "Gagal menyimpan ulasan." };

    const targetRowData = sheet.getRange(row, 1, 1, 8).getValues()[0];
    const hpSheet = normalizeHp(targetRowData[5]);
    const targetHp = normalizeHp(hp);

    if (hpSheet === targetHp) {
      // Kolom 12 (L = Rating), Kolom 13 (M = Ulasan)
      sheet.getRange(row, 12, 1, 2).setValues([[rating, ulasan || ""]]);
      return { status: "success", message: "Terima kasih atas ulasan Anda!" };
    } else {
      return { status: "error", message: "Validasi kepemilikan gagal." };
    }
  } catch (err) {
    return { status: "error", message: "Gagal menyimpan: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

// FUNGSI TESTING: Bisa diklik RUN di Editor untuk ujicoba
function testSimpan() {
  const dataDummy = {
    nama: "Pasien Ujicoba",
    nohp: "081234567890",
    tanggal: "2026-03-31",
    terapis: "Marsudi",
    waktu: "10:30",
    jenisKelamin: "Laki-laki",
    sesiBekam: "Bekam Sunnah Titik Utama"
  };
  const hasil = simpanBookingData(dataDummy);
  console.log(hasil);
}
function bantuAutoCancel(sheet, rowIdx, rowData, waktuStr, tz) {
  let status = (rowData[7] || "Terjadwal").toString().trim();
  
  if (status === "Terjadwal" || status === "MENUNGGU" || status === "DITERIMA") {
    try {
      let tglStr = "";
      if (Object.prototype.toString.call(rowData[0]) === '[object Date]') {
        tglStr = Utilities.formatDate(rowData[0], tz, "yyyy-MM-dd");
      } else {
        tglStr = rowData[0].toString().trim();
      }
      
      if (!tglStr || !waktuStr) return status;

      const scheduledTime = new Date(`${tglStr}T${waktuStr}:00`);
      const now = new Date();

      // Jika sekarang sudah lewat 10 menit dari jadwal mulai
      if (now.getTime() > (scheduledTime.getTime() + (10 * 60 * 1000))) {
        status = "Batal (Otomatis)";
        sheet.getRange(rowIdx, 8).setValue(status);
        
        // Notifikasi & Update Kalender
        notifDanUbahKalenderBatal(rowData, "SISTEM (Auto-Cancel)");
      }
    } catch (e) { console.error("Gagal auto-cancel baris " + rowIdx + ": " + e.message); }
  }
  return status;
}
