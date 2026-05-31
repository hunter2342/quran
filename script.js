// تهيئة أيقونات Lucide
lucide.createIcons();

// --- عناصر واجهة المستخدم ---
const DOM = {
    surahSelect: document.getElementById('surah-select'),
    editionSelect: document.getElementById('edition-select'),
    ayahStart: document.getElementById('ayah-start'),
    ayahEnd: document.getElementById('ayah-end'),
    fetchBtn: document.getElementById('fetch-quran-btn'),
    
    bgUpload: document.getElementById('bg-upload'),
    fontFamily: document.getElementById('font-family'),
    fontSize: document.getElementById('font-size'),
    textColor: document.getElementById('text-color'),
    textPosition: document.getElementById('text-position'),
    textShadow: document.getElementById('text-shadow'),
    
    playBtn: document.getElementById('play-pause-btn'),
    playIcon: document.getElementById('play-icon'),
    audioStatus: document.getElementById('audio-status'),
    surahSubtitle: document.getElementById('surah-subtitle'),
    exportBtn: document.getElementById('export-btn'),
    
    // عناصر المعاينة
    bgVideo: document.getElementById('bg-video'),
    bgImage: document.getElementById('bg-image'),
    textContainer: document.getElementById('text-container'),
    previewQuran: document.getElementById('preview-quran'),
    previewSub: document.getElementById('preview-sub'),
    
    audioPlayer: document.getElementById('audio-player'),
    canvas: document.getElementById('export-canvas'),
};

// حل مشكلة CORS للصوتيات (مهم جداً للتصدير)
DOM.audioPlayer.crossOrigin = "anonymous";

let isPlaying = false;
let mediaRecorder;
let recordedChunks = [];
let animationFrameId;

// متغيرات قائمة التشغيل (Playlist) للآيات
let playlist = [];
let currentTrackIndex = 0;
let surahGlobalName = '';

// --- 1. جلب قائمة السور عند تحميل الصفحة ---
async function loadSurahs() {
    try {
        const response = await fetch('https://api.alquran.cloud/v1/surah');
        const data = await response.json();
        DOM.surahSelect.innerHTML = '';
        data.data.forEach(surah => {
            const option = document.createElement('option');
            option.value = surah.number;
            option.text = `${surah.number}. ${surah.name}`;
            DOM.surahSelect.appendChild(option);
        });
        updateAyahLimits();
    } catch (error) {
        DOM.surahSelect.innerHTML = '<option>خطأ في تحميل السور</option>';
        console.error("خطأ في جلب السور:", error);
    }
}
loadSurahs();

// تحديث الحد الأقصى للآيات عند تغيير السورة
DOM.surahSelect.addEventListener('change', updateAyahLimits);
async function updateAyahLimits() {
    const surahNum = DOM.surahSelect.value;
    if (!surahNum) return;
    try {
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}`);
        const data = await response.json();
        const totalAyahs = data.data.numberOfAyahs;
        
        DOM.ayahStart.max = totalAyahs;
        DOM.ayahEnd.max = totalAyahs;
        // تعيين 3 آيات كافتراضي لمنع الأخطاء
        DOM.ayahEnd.value = Math.min(parseInt(DOM.ayahStart.value) + 2, totalAyahs); 
    } catch (error) {
        console.error("خطأ في جلب بيانات السورة", error);
    }
}

// --- 2. جلب نص الآيات والملف الصوتي ---
DOM.fetchBtn.addEventListener('click', async () => {
    const surah = DOM.surahSelect.value;
    const edition = DOM.editionSelect.value;
    const start = parseInt(DOM.ayahStart.value);
    const end = parseInt(DOM.ayahEnd.value);

    if (start > end) {
        alert("خطأ: آية البدء يجب أن تكون قبل أو تساوي آية الانتهاء.");
        return;
    }

    DOM.fetchBtn.innerText = "جاري الجلب...";
    DOM.fetchBtn.disabled = true;

    try {
        // نجلب السورة مع الصوت للنطاق المختار
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/${edition}`);
        const data = await response.json();
        
        surahGlobalName = data.data.name;
        
        // استخراج الآيات المطلوبة فقط
        playlist = data.data.ayahs.slice(start - 1, end);
        currentTrackIndex = 0;

        DOM.audioStatus.innerText = "تم الجلب بنجاح";
        DOM.surahSubtitle.innerText = `سورة ${surahGlobalName} (آية ${start}-${end})`;
        
        // تحميل الآية الأولى في المعاينة
        loadTrack(0);

    } catch (error) {
        alert("حدث خطأ أثناء جلب البيانات. تأكد من اتصالك بالإنترنت.");
        console.error(error);
    } finally {
        DOM.fetchBtn.innerHTML = `<i data-lucide="cloud-download"></i> جلب الآيات والصوت`;
        DOM.fetchBtn.disabled = false;
        lucide.createIcons();
    }
});

// دالة تحميل الآية الحالية وتشغيلها
function loadTrack(index) {
    if (index >= playlist.length) return; // تم انتهاء القائمة

    const currentAyah = playlist[index];
    
    // إضافة أنيميشن بسيط عند تغير النص
    DOM.previewQuran.classList.remove('fade-in');
    void DOM.previewQuran.offsetWidth; // Trigger reflow
    DOM.previewQuran.classList.add('fade-in');

    // تحديث النص (آية واحدة مع رقمها)
    DOM.previewQuran.innerText = `${currentAyah.text} ﴿${currentAyah.numberInSurah}﴾`;
    DOM.previewSub.innerText = `سورة ${surahGlobalName}`;
    
    // 🌟 الإصلاح السحري لمشكلة الـ CORS باستخدام خدمة Proxy مجانية 🌟
    const proxyUrl = "https://api.allorigins.win/raw?url=";
    DOM.audioPlayer.src = proxyUrl + encodeURIComponent(currentAyah.audio);
    
    // إذا كان في وضع التشغيل أو جاري التصدير، قم بتشغيل المقطع الجديد
    if (isPlaying || (mediaRecorder && mediaRecorder.state === 'recording')) {
        DOM.audioPlayer.play().catch(e => console.log("تأخير في تشغيل الصوت:", e));
    }
    
    updateStyles();
}

// الانتقال للآية التالية عند انتهاء الآية الحالية
DOM.audioPlayer.addEventListener('ended', () => {
    currentTrackIndex++;
    if (currentTrackIndex < playlist.length) {
        loadTrack(currentTrackIndex); // تشغيل الآية التالية
    } else {
        // انتهاء كل الآيات
        isPlaying = false;
        DOM.playIcon.setAttribute('data-lucide', 'play');
        lucide.createIcons();
        
        // إيقاف تسجيل الفيديو إذا كان يسجل
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopExport();
        }
    }
});

// --- 3. تحديث مظهر النصوص ---
function updateStyles() {
    DOM.previewQuran.style.fontFamily = DOM.fontFamily.value;
    DOM.previewQuran.style.fontSize = `${DOM.fontSize.value}px`;
    DOM.previewQuran.style.color = DOM.textColor.value;
    DOM.textContainer.style.top = `${DOM.textPosition.value}%`;
    
    if(DOM.textShadow.checked) {
        DOM.previewQuran.style.textShadow = '2px 2px 10px rgba(0,0,0,0.9)';
    } else {
        DOM.previewQuran.style.textShadow = 'none';
    }
}

['input', 'change'].forEach(evt => {
    DOM.fontFamily.addEventListener(evt, updateStyles);
    DOM.fontSize.addEventListener(evt, updateStyles);
    DOM.textColor.addEventListener(evt, updateStyles);
    DOM.textPosition.addEventListener(evt, updateStyles);
    DOM.textShadow.addEventListener(evt, updateStyles);
});

// رفع الخلفيات المخصصة
DOM.bgUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileURL = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
        DOM.bgVideo.src = fileURL; DOM.bgVideo.classList.remove('hidden'); DOM.bgImage.classList.add('hidden'); DOM.bgVideo.play();
    } else {
        DOM.bgImage.src = fileURL; DOM.bgImage.classList.remove('hidden'); DOM.bgVideo.classList.add('hidden');
    }
});

// --- 4. التحكم في التشغيل (المعاينة) ---
DOM.playBtn.addEventListener('click', () => {
    if (playlist.length === 0) return alert("الرجاء جلب الآيات أولاً.");
    
    if (isPlaying) {
        DOM.audioPlayer.pause(); 
        if(!DOM.bgVideo.classList.contains('hidden')) DOM.bgVideo.pause();
        DOM.playIcon.setAttribute('data-lucide', 'play');
    } else {
        // إذا انتهت القائمة وأراد إعادة التشغيل
        if(currentTrackIndex >= playlist.length) {
            currentTrackIndex = 0;
            loadTrack(0);
        }
        DOM.audioPlayer.play(); 
        if(!DOM.bgVideo.classList.contains('hidden')) DOM.bgVideo.play();
        DOM.playIcon.setAttribute('data-lucide', 'pause');
    }
    lucide.createIcons(); 
    isPlaying = !isPlaying;
});

// --- 5. نظام التصدير المتقدم عبر Canvas ---
DOM.exportBtn.addEventListener('click', () => {
    if (playlist.length === 0) return alert("الرجاء جلب الآيات أولاً.");

    const ctx = DOM.canvas.getContext('2d');
    const width = DOM.canvas.width;
    const height = DOM.canvas.height;
    recordedChunks = [];
    
    const canvasStream = DOM.canvas.captureStream(30);
    let combinedStream = canvasStream;

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const source = audioCtx.createMediaElementSource(DOM.audioPlayer);
        source.connect(dest); 
        source.connect(audioCtx.destination); // للسماع أثناء التصدير
        combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    } catch (e) {
        console.warn("تنبيه: قد لا يتم دمج الصوت في بعض المتصفحات بسبب قيود الأمان", e);
    }

    try {
        mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' });
    } catch (e) {
        // Fallback إذا كان ترميز vp9 غير مدعوم
        mediaRecorder = new MediaRecorder(combinedStream);
    }

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = downloadVideo;

    // تهيئة حالة التصدير
    DOM.exportBtn.innerText = "جاري معالجة الفيديو...";
    DOM.exportBtn.disabled = true;

    // إعادة ضبط وتدوير الفيديو والصوت من البداية
    if(!DOM.bgVideo.classList.contains('hidden')) { DOM.bgVideo.currentTime = 0; DOM.bgVideo.play(); }
    
    currentTrackIndex = 0;
    loadTrack(0); 
    
    mediaRecorder.start();

    function drawFrame() {
        // رسم الخلفية
        if (!DOM.bgVideo.classList.contains('hidden')) ctx.drawImage(DOM.bgVideo, 0, 0, width, height);
        else if (!DOM.bgImage.classList.contains('hidden')) ctx.drawImage(DOM.bgImage, 0, 0, width, height);
        else { ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, width, height); }

        // التعتيم لزيادة وضوح النص
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.fillRect(0, 0, width, height);

        // إعدادات النص العربي للكانفاس
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.direction = 'rtl'; 
        
        const yPos = (DOM.textPosition.value / 100) * height;
        const fontFam = DOM.fontFamily.value.replace(/['"]/g, '');
        const fontSize = DOM.fontSize.value * 2.8; 

        ctx.font = `${fontSize}px "${fontFam}"`;
        ctx.fillStyle = DOM.textColor.value;
        
        if (DOM.textShadow.checked) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'; ctx.shadowBlur = 20;
        } else {
            ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        }

        const currentText = DOM.previewQuran.innerText;
        wrapText(ctx, currentText, width / 2, yPos, width - 150, fontSize * 1.5);

        // اسم السورة في الأسفل
        ctx.font = `38px "Cairo"`; 
        ctx.fillStyle = '#9ca3af'; 
        ctx.shadowBlur = 0;
        ctx.fillText(`سورة ${surahGlobalName}`, width / 2, height - 150);

        if (mediaRecorder.state === 'recording') {
            animationFrameId = requestAnimationFrame(drawFrame);
        }
    }
    drawFrame();
});

function stopExport() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        cancelAnimationFrame(animationFrameId);
        if(!DOM.bgVideo.classList.contains('hidden')) DOM.bgVideo.pause();
    }
}

function downloadVideo() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Quran_Reels_${Date.now()}.webm`;
    document.body.appendChild(a); a.click();
    
    // استعادة شكل زر التصدير
    DOM.exportBtn.innerHTML = `<i data-lucide="download"></i> تصدير الفيديو (WebM)`;
    DOM.exportBtn.disabled = false; lucide.createIcons();
}

// دالة لكسر السطور في الكانفاس لتناسب أبعاد الموبايل
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' '); 
    let line = ''; 
    const lines = [];
    for(let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        if (context.measureText(testLine).width > maxWidth && n > 0) {
            lines.push(line); line = words[n] + ' ';
        } else { line = testLine; }
    }
    lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    for(let i = 0; i < lines.length; i++) { context.fillText(lines[i], x, startY + (i * lineHeight)); }
}
