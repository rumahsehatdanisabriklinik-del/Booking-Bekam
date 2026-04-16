function onLayananSelectedSafe(encodedName) {
    const namaLayanan = decodeURIComponent(escape(atob(encodedName)));
    selectedLayanan = layananByNama.get(normalizeName(namaLayanan)) || null;
    console.log("Layanan dipilih (Safe):", selectedLayanan);
    if (document.getElementById('tanggal').value) {
        checkAvailability();
    }
    scrollToElement('section-tanggal');
}

function onGenderSelected() {
    selectedGender = document.querySelector('input[name="gender_terapis"]:checked').value;
    filterTerapisName();
    document.getElementById('section-layanan').classList.add('hidden');
    selectedLayanan = null;
    selectedTerapisName = "";
    scrollToElement('section-nama-terapis');
}

function filterTerapisName() {
    if (!selectedGender) return;

    const genderLabel = (selectedGender === "Pria") ? "Laki-laki" : "Perempuan";
    const container = document.getElementById('section-nama-terapis');
    const list = document.getElementById('list-terapis-nama');

    const addedExtraNames = new Set();
    const terapisKhususExtra = allTerapis.filter(t => {
        const cleanNama = normalizeName(t.nama);
        if (addedExtraNames.has(cleanNama)) return false;

        if (t.gender === "lintas" || namaTerapisKhususSet.has(cleanNama)) {
            addedExtraNames.add(cleanNama);
            return true;
        }
        return false;
    });

    const extraNamaSet = new Set(terapisKhususExtra.map(t => normalizeName(t.nama)));
    const matches = allTerapis.filter(t => t.gender === genderLabel && !extraNamaSet.has(normalizeName(t.nama)));

    const getLabelLayananKhusus = (namaTerapis) => {
        return (specialLabelsByTerapis.get(normalizeName(namaTerapis)) || []).join(", ");
    };

    list.innerHTML = "";
    const fragment = document.createDocumentFragment();

    const renderTerapisCard = (t, index, isKhusus = false) => {
        const div = document.createElement('label');
        div.className = "w-full animate-fade-up";
        div.style.animationDelay = `${index * 50}ms`;

        const cleanNama = normalizeName(t.nama);
        const hasSpecialty = isKhusus || namaTerapisKhususSet.has(cleanNama);
        const labelKhusus = hasSpecialty
            ? `<span class="text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">${getLabelLayananKhusus(t.nama)}</span>`
            : '';

        div.innerHTML = `
            <input type="radio" name="pilih_nama_terapis" value="${t.nama}" class="radio-hidden">
            <div class="pill-label !py-4 !rounded-[1rem] !text-sm flex flex-row gap-3 !justify-start pl-5">
                <div class="w-8 h-8 rounded-full ${hasSpecialty ? 'bg-teal-50 text-teal-500' : 'bg-emerald-50 text-emerald-500'} flex items-center justify-center icon-wrapper transition-colors"><i class="fas ${hasSpecialty ? 'fa-star-and-crescent' : 'fa-user-md'}"></i></div>
                <div class="flex flex-col gap-0.5">
                    <span class="text-title text-base font-bold">${t.nama}</span>
                    ${labelKhusus}
                </div>
            </div>
        `;
        fragment.appendChild(div);
    };

    if (matches.length > 0 || terapisKhususExtra.length > 0) {
        container.classList.remove('hidden');
        matches.forEach((t, i) => renderTerapisCard(t, i, false));

        if (terapisKhususExtra.length > 0) {
            const sep = document.createElement('div');
            sep.className = "col-span-full flex items-center gap-3 my-1 animate-fade-up";
            sep.innerHTML = `<div class="flex-1 h-px bg-teal-100"></div><span class="text-[9px] font-black uppercase tracking-widest text-teal-500">Layanan Khusus</span><div class="flex-1 h-px bg-teal-100"></div>`;
            fragment.appendChild(sep);
            terapisKhususExtra.forEach((t, i) => renderTerapisCard(t, matches.length + i, true));
        }
        list.appendChild(fragment);
    } else {
        container.classList.remove('hidden');
        list.innerHTML = `<div class="col-span-full p-4 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-100 flex items-center gap-3">
            <i class="fas fa-info-circle text-lg"></i> Maaf, tidak ada terapis ${selectedGender} yang tersedia saat ini.
        </div>`;
    }
}

function selectSpecificTerapis(nama) {
    selectedTerapisName = nama;
    renderLayanan();
    if (document.getElementById('tanggal').value) {
        checkAvailability();
    }
    scrollToElement('section-layanan');
}

function renderLayanan() {
    if (!selectedTerapisName) return;
    const container = document.getElementById('section-layanan');
    const list = document.getElementById('list-layanan');

    list.innerHTML = `
        <div class="skeleton-box h-24 w-full"></div>
        <div class="skeleton-box h-24 w-full"></div>
        <div class="skeleton-box h-24 w-full"></div>
    `;
    container.classList.remove('hidden');

    setTimeout(() => {
        list.innerHTML = "";

        if (allLayanan.length === 0) {
            list.innerHTML = `
                <div class="col-span-full p-4 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-100 text-center">
                    <i class="fas fa-database mb-2 block text-lg"></i>
                    Database Layanan Kosong secara teknis.<br>
                    <span class="font-normal text-[10px]">Cek log console atau jalankan ulang Migrasi Data.</span>
                </div>`;
            return;
        }

        const cleanTarget = normalizeName(selectedTerapisName);
        const availableServices = layananByTerapisName.get(cleanTarget) || [];

        if (availableServices.length === 0) {
            const debugInfo = allLayanan
                .map(l => `${l.nama}(${Array.isArray(l.terapisKhusus) ? l.terapisKhusus.join(",") : ""})`)
                .join(" | ");
            list.innerHTML = `
                <div class="col-span-full p-6 bg-slate-50 text-slate-500 rounded-[1.5rem] text-[11px] font-bold text-center border-2 border-dashed border-slate-200">
                    Maaf, Terapis <b class="text-slate-800">${selectedTerapisName}</b> tidak terdaftar untuk layanan manapun di Sheet.<br>
                    <button type="button" onclick="this.nextElementSibling.classList.toggle('hidden')" class="mt-2 text-emerald-600 underline hover:text-emerald-700 transition-colors">Klik untuk Lihat Detail Debug</button>
                    <div class="hidden mt-4 p-4 bg-white border rounded-xl font-mono text-[9px] text-left break-all shadow-inner">
                        <b>Data dari Sheet:</b><br>${debugInfo}<br><br>
                        <b>Target:</b> [${cleanTarget}]
                    </div>
                </div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        availableServices.forEach((lay, index) => {
            const card = document.createElement('label');
            card.className = "w-full cursor-pointer animate-fade-up";
            card.style.animationDelay = `${index * 50}ms`;
            const iconClass = lay.icon || 'fa-hand-holding-heart';
            const safeName = btoa(unescape(encodeURIComponent(lay.nama)));

            card.innerHTML = `
                <input type="radio" name="layanan" value="${safeName}" class="radio-hidden">
                <div class="pill-label group relative overflow-hidden h-full !rounded-[1.25rem]">
                    <div class="icon-wrapper w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl mb-2 transition-transform duration-300">
                        <i class="fas ${iconClass}"></i>
                    </div>
                    <span class="text-title text-[11px] font-black uppercase tracking-wider text-slate-800 leading-tight px-2">${lay.nama}</span>
                    ${lay.terlaris ? '<div class="absolute -top-1 -right-6 bg-amber-400 text-[9px] font-black py-1 px-6 rotate-45 text-white shadow-sm tracking-widest">TOP</div>' : ''}
                </div>
            `;
            fragment.appendChild(card);
        });
        list.appendChild(fragment);
    }, 300);
}

async function checkAvailability() {
    const tgl = document.getElementById('tanggal').value;
    if (!tgl || !selectedTerapisName) return;

    const gridWaktu = document.querySelector('#step-2 .grid');
    let currentSignal = null;

    if (availabilityAbortController) {
        availabilityAbortController.abort();
        availabilityAbortController = null;
    }

    if (selectedLayanan && selectedLayanan.hariAktif && selectedLayanan.hariAktif.length > 0) {
        const parts = tgl.split('-').map(Number);
        const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
        const day = dObj.getDay();

        if (!selectedLayanan.hariAktif.includes(day)) {
            const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
            const hariNama = selectedLayanan.hariAktif.map(h => daysMap[h]).join(", ");
            gridWaktu.innerHTML = `
                <div class="col-span-full p-6 bg-red-50 text-red-700 rounded-2xl border-2 border-red-100 text-center animate-fade-up">
                    <div class="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-3"><i class="fas fa-calendar-times"></i></div>
                    <div class="font-black uppercase text-xs tracking-widest mb-1">Layanan Libur</div>
                    <p class="text-xs font-bold font-sans opacity-80 uppercase leading-relaxed">
                        Mohon maaf, layanan <b class="text-red-600">${selectedLayanan.nama}</b><br>hanya tersedia pada hari: <span class="underline">${hariNama}</span>.
                    </p>
                </div>
            `;
            showCustomToast(`Layanan ${selectedLayanan.nama} libur di hari tersebut.`, "error");
            return;
        }
    }

    gridWaktu.innerHTML = `
        <div class="skeleton-box h-12 w-full !rounded-xl"></div>
        <div class="skeleton-box h-12 w-full !rounded-xl"></div>
        <div class="skeleton-box h-12 w-full !rounded-xl"></div>
        <div class="skeleton-box h-12 w-full !rounded-xl"></div>
    `;

    try {
        const requestKey = `${tgl}__${selectedTerapisName}`;
        availabilityRequestKey = requestKey;
        availabilityAbortController = new AbortController();
        currentSignal = availabilityAbortController.signal;
        const res = await fetch(buildApiUrl('cekWaktu', { tanggal: tgl, terapis: selectedTerapisName }), {
            signal: currentSignal
        });
        const result = await res.json();

        if (availabilityRequestKey !== requestKey) return;

        if (result.status === "success") {
            if (result.data.length > 0) {
                gridWaktu.innerHTML = "";
                const now = new Date();
                const parts = tgl.split('-').map(Number);
                const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
                const isToday = now.toDateString() === selectedDate.toDateString();

                let dataWaktu = result.data;
                if (isToday) {
                    const currentHour = now.getHours();
                    const currentMin = now.getMinutes();
                    dataWaktu = dataWaktu.filter(slot => {
                        const [h, m] = slot.split(':').map(Number);
                        if (h < currentHour) return false;
                        if (h === currentHour && m < (currentMin + 11)) return false;
                        return true;
                    });
                }

                if (dataWaktu.length === 0) {
                    gridWaktu.innerHTML = `<div class="col-span-full text-center py-6 px-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 font-bold text-sm"><i class="fas fa-clock mb-2 text-2xl block text-amber-400"></i>Maaf, jadwal untuk hari ini sudah terlewati.</div>`;
                    return;
                }

                dataWaktu.forEach((jam, idx) => {
                    const label = document.createElement('label');
                    label.className = "animate-fade-up";
                    label.style.animationDelay = `${idx * 40}ms`;
                    label.innerHTML = `
                        <input type="radio" name="waktu" value="${jam}" class="radio-hidden" ${idx === 0 ? 'checked' : ''}>
                        <div class="pill-label !py-3 !rounded-xl !text-sm hover:!bg-emerald-50 hover:!border-emerald-300 transition-colors">
                            <span class="text-title flex items-center gap-2"><i class="far fa-clock opacity-50"></i> ${jam} WIB</span>
                        </div>
                    `;
                    gridWaktu.appendChild(label);
                });

                if (dataWaktu.length > 0) scrollToElement('section-waktu');
            } else {
                gridWaktu.innerHTML = `<div class="col-span-full text-center py-6 px-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 font-bold text-sm"><i class="fas fa-calendar-times mb-2 text-2xl block text-red-400"></i>${result.info || "Maaf, jadwal penuh."}</div>`;
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') return;
        gridWaktu.innerHTML = '<div class="col-span-full text-center py-6 bg-red-50 rounded-2xl border border-red-100 text-red-500 font-bold"><i class="fas fa-wifi mb-2 block text-xl"></i> Gagal memuat jadwal jaringan Anda.</div>';
    } finally {
        if (availabilityAbortController && availabilityAbortController.signal === currentSignal) {
            availabilityAbortController = null;
        }
    }
}
