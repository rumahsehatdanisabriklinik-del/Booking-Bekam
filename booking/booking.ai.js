async function callGeminiAPI(promptText) {
    const connector = window.GAS_URL.includes('?') ? '&' : '?';
    const payload = {
        action: "generateAITips",
        prompt: promptText
    };

    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(`${window.GAS_URL}${connector}action=generateAITips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            if (result.status === "success") {
                return result.data.text;
            }
            throw new Error("Gagal mengambil tips: " + result.message);
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
        }
    }
}

async function generateAITips() {
    if (!window.lastBookingData) return;

    const btn = document.getElementById('btnAiTips');
    const resultContainer = document.getElementById('aiTipsResult');
    const resultContent = document.getElementById('aiTipsContent');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin text-indigo-200"></i><span>Menganalisis Keluhan...</span>';
    resultContainer.classList.remove('hidden');
    resultContent.innerHTML = `
        <div class="animate-pulse space-y-3">
            <div class="h-4 bg-indigo-100 rounded w-full"></div>
            <div class="h-4 bg-indigo-100 rounded w-5/6"></div>
            <div class="h-4 bg-indigo-100 rounded w-4/6"></div>
        </div>
    `;

    const { usia, layanan, keluhan } = window.lastBookingData;
    const userAge = usia ? `${usia} tahun` : "dewasa";
    const userComplaint = (keluhan && keluhan !== "-") ? keluhan : "Hanya ingin menjaga kesehatan umum";
    const prompt = `Saya pasien berusia ${userAge}, baru saja mendaftar layanan terapi ${layanan}. Keluhan medis atau tujuan terapi saya adalah: "${userComplaint}". Berikan 3 tips singkat, ramah, dan menenangkan untuk persiapan sebelum melakukan terapi ini agar hasilnya maksimal.`;

    try {
        const aiResponse = await callGeminiAPI(prompt);
        const styledResponse = aiResponse
            .replace(/<ul>/g, '<ul class="list-disc pl-5 space-y-2 marker:text-indigo-400">')
            .replace(/<strong>/g, '<strong class="text-indigo-900">');

        resultContent.innerHTML = styledResponse;
    } catch (error) {
        resultContent.innerHTML = `<span class="text-red-500 text-sm flex items-center gap-2 bg-red-50 p-3 rounded-lg border border-red-100"><i class="fas fa-exclamation-triangle"></i> Maaf, saat ini Asisten AI sedang sibuk atau mengalami gangguan koneksi. Mohon coba beberapa saat lagi ya.</span>`;
    } finally {
        btn.innerHTML = '<i class="fas fa-check text-indigo-200"></i><span>Tips Berhasil Dibuat</span>';
    }
}
