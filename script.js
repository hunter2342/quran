/**
 * Quran Studio Pro - Bulletproof Edition
 * Architecture: Object-Oriented JS (ES6)
 * Features: Robust Async Handling, Error Boundaries, Safe MediaRecorder
 */

const App = {
    State: {
        playlist: [],
        currentIndex: 0,
        isPlaying: false,
        isExporting: false,
        surahName: '',
        animationId: null,
        mediaType: 'none',
        visualizerData: new Uint8Array(0),
        // استخدمنا بروكسي أسرع وأكثر استقراراً للميديا
        proxyUrl: "https://corsproxy.io/?" 
    },

    DOM: {},

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.setupTabs();
        this.API.loadSurahs();
        this.Canvas.initContext();
        lucide.createIcons();
        this.Canvas.renderLoop();
    },

    cacheDOM() {
        const get = id => document.getElementById(id);
        this.DOM = {
            selEdition: get('sel-edition'), selSurah: get('sel-surah'),
            inpStart: get('inp-start'), inpEnd: get('inp-end'), btnFetch: get('btn-fetch'),
            btnPlay: get('btn-play'), iconPlay: get('icon-play'),
            txtStatus: get('txt-status'), txtSubtitle: get('txt-subtitle'),
            inpBg: get('inp-bg'), selFont: get('sel-font'), rngSize: get('rng-size'),
            inpColor: get('inp-color'), colorHex: get('color-hex'), rngPos: get('rng-pos'),
            inpWatermark: get('inp-watermark'), rngOverlay: get('rng-overlay'),
            valOverlay: get('val-overlay'), rngBlur: get('rng-blur'), valBlur: get('val-blur'),
            chkVisualizer: get('chk-visualizer'), inpVisColor: get('inp-vis-color'),
            btnExport: get('btn-export'), progressUI: get('export-progress-container'),
            mediaVideo: get('media-video'), mediaImage: get('media-image'),
            renderCanvas: get('render-canvas'), coreAudio: get('core-audio')
        };

        // تأمين إعدادات الفيديو للتشغيل التلقائي بدون أخطاء
        this.DOM.mediaVideo.loop = true;
        this.DOM.mediaVideo.muted = true; // ضروري لتخطي حظر المتصفحات
        this.DOM.mediaVideo.setAttribute('playsinline', '');
    },

    bindEvents() {
        this.DOM.selSurah.addEventListener('change', () => this.API.updateLimits());
        this.DOM.btnFetch.addEventListener('click', () => this.API.fetchAyahs());
        this.DOM.inpBg.addEventListener('change', (e) => this.UI.handleMediaUpload(e));
        this.DOM.btnPlay.addEventListener('click', () => this.Audio.togglePlay());
        this.DOM.coreAudio.addEventListener('ended', () => this.Audio.handleTrackEnd());
        
        ['input', 'change'].forEach(evt => {
            this.DOM.inpColor.addEventListener(evt, (e) => this.DOM.colorHex.innerText = e.target.value.toUpperCase());
            this.DOM.rngOverlay.addEventListener(evt, (e) => this.DOM.valOverlay.innerText = e.target.value + '%');
            this.DOM.rngBlur.addEventListener(evt, (e) => this.DOM.valBlur.innerText = e.target.value + 'px');
        });

        this.DOM.btnExport.addEventListener('click', () => this.Export.start());
    },

    setupTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        const contents = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('text-emerald-400', 'border-emerald-500');
                    t.classList.add('text-gray-400', 'border-transparent');
                });
                contents.forEach(c => c.classList.add('hidden'));
                tab.classList.remove('text-gray-400', 'border-transparent');
                tab.classList.add('text-emerald-400', 'border-emerald-500');
                document.getElementById(tab.dataset.target).classList.remove('hidden');
            });
        });
    },

    UI: {
        handleMediaUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            const fileURL = URL.createObjectURL(file);
            
            if (file.type.startsWith('video/')) {
                App.DOM.mediaVideo.src = fileURL;
                App.State.mediaType = 'video';
                // محاولة التشغيل الصامت لمعاينة الفيديو فور رفعه
                App.DOM.mediaVideo.play().catch(err => console.warn("انتظار تفاعل المستخدم للتشغيل", err));
            } else if (file.type.startsWith('image/')) {
                App.DOM.mediaImage.src = fileURL;
                App.State.mediaType = 'image';
            }
        },
        updateStatus(title, subtitle) {
            App.DOM.txtStatus.innerText = title;
            if(subtitle) App.DOM.txtSubtitle.innerText = subtitle;
        },
        setLoading(btn, isLoading, originalText, iconClass) {
            if(isLoading) {
                btn.disabled = true;
                btn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> جاري المعالجة...`;
                btn.classList.add('opacity-75', 'cursor-wait');
            } else {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="${iconClass}" class="w-4 h-4"></i> ${originalText}`;
                btn.classList.remove('opacity-75', 'cursor-wait');
                lucide.createIcons();
            }
        }
    },

    API: {
        async loadSurahs() {
            try {
                const res = await fetch('https://api.alquran.cloud/v1/surah');
                const data = await res.json();
                App.DOM.selSurah.innerHTML = '';
                data.data.forEach(s => App.DOM.selSurah.add(new Option(`${s.number}. ${s.name}`, s.number)));
                this.updateLimits();
            } catch (err) {
                App.DOM.selSurah.innerHTML = '<option>تعذر الاتصال</option>';
            }
        },
        async updateLimits() {
            const num = App.DOM.selSurah.value;
            if (!num) return;
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${num}`);
            const data = await res.json();
            const total = data.data.numberOfAyahs;
            App.DOM.inpStart.max = total;
            App.DOM.inpEnd.max = total;
            App.DOM.inpEnd.value = Math.min(parseInt(App.DOM.inpStart.value) + 2, total);
        },
        async fetchAyahs() {
            const surah = App.DOM.selSurah.value, edition = App.DOM.selEdition.value;
            const start = parseInt(App.DOM.inpStart.value), end = parseInt(App.DOM.inpEnd.value);

            if (start > end) return alert("ترتيب الآيات غير صحيح.");
            App.UI.setLoading(App.DOM.btnFetch, true);

            try {
                const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/${edition}`);
                const data = await res.json();
                App.State.surahName = data.data.name;
                App.State.playlist = data.data.ayahs.slice(start - 1, end);
                App.State.currentIndex = 0;
                App.UI.updateStatus(`تم استيراد ${App.State.playlist.length} آية`, `سورة ${App.State.surahName}`);
            } catch (error) {
                alert("خطأ في جلب البيانات.");
            } finally {
                App.UI.setLoading(App.DOM.btnFetch, false, "استيراد الآيات", "download");
            }
        }
    },

    // 7. إدارة الصوت والفيديو المصلحة (Non-Blocking execution)
    Audio: {
        context: null, analyser: null, source: null,

        initWebAudio() {
            if (this.context) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.context = new AudioContext();
                this.analyser = this.context.createAnalyser();
                this.analyser.fftSize = 256;
                this.source = this.context.createMediaElementSource(App.DOM.coreAudio);
                this.source.connect(this.analyser);
                this.analyser.connect(this.context.destination);
                App.State.visualizerData = new Uint8Array(this.analyser.frequencyBinCount);
            } catch (e) {
                console.warn("بيئة الصوت غير مدعومة بالكامل، سيستمر العمل بدون متخيل صوتي.");
            }
        },

        updatePlayUI(isPlaying) {
            App.State.isPlaying = isPlaying;
            if (isPlaying) {
                App.DOM.btnPlay.innerHTML = `<i data-lucide="pause" class="w-5 h-5 fill-current"></i>`;
                App.DOM.btnPlay.classList.add('audio-active-pulse');
            } else {
                App.DOM.btnPlay.innerHTML = `<i data-lucide="play" class="w-5 h-5 fill-current"></i>`;
                App.DOM.btnPlay.classList.remove('audio-active-pulse');
            }
            lucide.createIcons();
        },

        loadTrack(index) {
            if (index >= App.State.playlist.length) return;
            const track = App.State.playlist[index];
            App.DOM.coreAudio.src = App.State.proxyUrl + encodeURIComponent(track.audio);
            
            if (App.State.isPlaying || App.State.isExporting) {
                App.DOM.coreAudio.play().catch(e => {
                    console.error("Audio playback prevented:", e);
                    if (App.State.isExporting) App.Export.forceStopWithError("تعذر تحميل المقطع الصوتي من الخادم.");
                });
            }
        },

        togglePlay() {
            if (App.State.playlist.length === 0) return alert("قم باستيراد الآيات أولاً.");
            
            this.initWebAudio();
            if (this.context && this.context.state === 'suspended') this.context.resume();

            if (App.State.isPlaying) {
                // إيقاف آمن
                App.DOM.coreAudio.pause();
                if(App.State.mediaType === 'video') App.DOM.mediaVideo.pause();
                this.updatePlayUI(false);
            } else {
                // تشغيل آمن (Non-blocking)
                if(App.State.currentIndex >= App.State.playlist.length) {
                    App.State.currentIndex = 0;
                    this.loadTrack(0);
                } else {
                    App.DOM.coreAudio.play().catch(e => console.warn(e));
                }

                if(App.State.mediaType === 'video') {
                    App.DOM.mediaVideo.play().catch(e => console.warn("Video blocked:", e));
                }
                
                this.updatePlayUI(true);
            }
        },

        handleTrackEnd() {
            App.State.currentIndex++;
            if (App.State.currentIndex < App.State.playlist.length) {
                this.loadTrack(App.State.currentIndex);
            } else {
                this.updatePlayUI(false);
                if(App.State.mediaType === 'video') App.DOM.mediaVideo.pause();
                if (App.State.isExporting) App.Export.stop(); // التصدير ينتهي هنا طبيعياً
            }
        }
    },

    // 8. Canvas Render Loop (مؤمن ضد الأخطاء)
    Canvas: {
        ctx: null, width: 1080, height: 1920,

        initContext() {
            this.ctx = App.DOM.renderCanvas.getContext('2d', { alpha: false });
        },

        renderLoop() {
            App.State.animationId = requestAnimationFrame(() => App.Canvas.renderLoop());
            
            try {
                const ctx = this.ctx, w = this.width, h = this.height;

                ctx.filter = `blur(${App.DOM.rngBlur.value}px)`;
                if (App.State.mediaType === 'video') {
                    ctx.drawImage(App.DOM.mediaVideo, 0, 0, w, h);
                } else if (App.State.mediaType === 'image') {
                    ctx.drawImage(App.DOM.mediaImage, 0, 0, w, h);
                } else {
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(0, 0, w, h);
                }
                ctx.filter = 'none';

                const overlayOpacity = App.DOM.rngOverlay.value / 100;
                ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
                ctx.fillRect(0, 0, w, h);

                if (App.DOM.chkVisualizer.checked && App.Audio.analyser) {
                    App.Audio.analyser.getByteFrequencyData(App.State.visualizerData);
                    this.drawVisualizer(ctx, w, h);
                }

                ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
                const yPos = (App.DOM.rngPos.value / 100) * h;
                const fontSize = parseInt(App.DOM.rngSize.value) * 1.5;
                const fontFam = App.DOM.selFont.value;

                if (App.State.playlist.length > 0 && App.State.currentIndex < App.State.playlist.length) {
                    const currentAyah = App.State.playlist[App.State.currentIndex];
                    const text = `${currentAyah.text} ﴿${currentAyah.numberInSurah}﴾`;
                    
                    ctx.font = `bold ${fontSize}px "${fontFam}"`;
                    ctx.fillStyle = App.DOM.inpColor.value;
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 25; ctx.shadowOffsetY = 10;
                    
                    this.wrapText(ctx, text, w/2, yPos, w - 180, fontSize * 1.6);
                    
                    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
                    ctx.font = `40px "Cairo"`; ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    ctx.fillText(`سورة ${App.State.surahName}`, w/2, h - 200);
                }

                const watermark = App.DOM.inpWatermark.value;
                if (watermark) {
                    ctx.direction = 'ltr'; ctx.font = `35px "Cairo"`;
                    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillText(watermark, w/2, 100);
                }
            } catch (error) {
                // منع انهيار اللوب إذا فشل فريم واحد
                console.error("Canvas Render Error:", error);
            }
        },

        drawVisualizer(ctx, w, h) {
            const data = App.State.visualizerData, barWidth = 15, spacing = 5;
            const bars = Math.floor(w / (barWidth + spacing));
            const startX = (w - (bars * (barWidth + spacing))) / 2;
            
            ctx.fillStyle = App.DOM.inpVisColor.value;
            for (let i = 0; i < bars; i++) {
                const dataIndex = Math.floor(i * (data.length / bars));
                let barHeight = data[dataIndex] * 1.5;
                const x = startX + i * (barWidth + spacing), y = h - 300 - barHeight;
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, Math.max(barHeight, 5), 10);
                ctx.fill();
            }
        },

        wrapText(ctx, text, x, y, maxWidth, lineHeight) {
            const words = text.split(' '); let line = ''; const lines = [];
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                    lines.push(line); line = words[n] + ' ';
                } else { line = testLine; }
            }
            lines.push(line);
            const startY = y - ((lines.length - 1) * lineHeight) / 2;
            for(let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], x, startY + (i * lineHeight));
            }
        }
    },

    // 9. التصدير المصلح (Fallbacks & Safety)
    Export: {
        recorder: null, chunks: [],

        setExportUI(isProcessing) {
            App.State.isExporting = isProcessing;
            const txt = document.getElementById('export-status-text');
            if (isProcessing) {
                App.DOM.btnExport.classList.add('hidden');
                App.DOM.progressUI.classList.remove('hidden');
                App.DOM.progressUI.classList.add('flex');
                if(txt) txt.innerText = "جاري التسجيل...";
            } else {
                App.DOM.progressUI.classList.add('hidden');
                App.DOM.progressUI.classList.remove('flex');
                App.DOM.btnExport.classList.remove('hidden');
            }
        },

        start() {
            if (App.State.playlist.length === 0) return alert("لا يوجد محتوى لتصديره.");

            try {
                this.setExportUI(true);
                if (!App.Audio.context) App.Audio.initWebAudio();
                if (App.Audio.context && App.Audio.context.state === 'suspended') App.Audio.context.resume();

                // 1. التقاط مسار الفيديو
                const canvasStream = App.DOM.renderCanvas.captureStream(30);
                let finalStream = canvasStream;

                // 2. دمج آمن لمسار الصوت (إذا كان المتصفح يدعم ذلك بدون انهيار)
                try {
                    if (App.Audio.context) {
                        const dest = App.Audio.context.createMediaStreamDestination();
                        App.Audio.source.connect(dest);
                        App.Audio.source.connect(App.Audio.context.destination);
                        const audioTracks = dest.stream.getAudioTracks();
                        if (audioTracks.length > 0) {
                            finalStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
                        }
                    }
                } catch (audioMergeErr) {
                    console.warn("تخطى دمج الصوت الخارجي بسبب المتصفح", audioMergeErr);
                    // سيتم التسجيل كفيديو صامت في أسوأ الحالات بدلاً من التعليق
                }

                this.initRecorder(finalStream);

                // إعادة التشغيل
                App.State.currentIndex = 0;
                if(App.State.mediaType === 'video') {
                    App.DOM.mediaVideo.currentTime = 0;
                    App.DOM.mediaVideo.play().catch(e=>console.warn(e));
                }

                // التشغيل المباشر للصوت وتفادي await الخانق
                App.Audio.loadTrack(0);
                
                // البدء الفوري للتسجيل
                this.recorder.start(500); 

            } catch (error) {
                console.error("فشل كارثي في بدء التصدير:", error);
                this.forceStopWithError("خطأ في نظام التشغيل الداخلي للمتصفح.");
            }
        },

        initRecorder(stream) {
            this.chunks = [];
            
            // اختيار الترميز الآمن
            let options = {};
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                options = { mimeType: 'video/webm;codecs=vp9' };
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
                options = { mimeType: 'video/webm' };
            } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                options = { mimeType: 'video/mp4' };
            }

            this.recorder = new MediaRecorder(stream, options);
            this.recorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data); };
            this.recorder.onstop = () => this.saveFile();
        },

        stop() {
            if (this.recorder && this.recorder.state !== 'inactive') {
                this.recorder.stop();
            } else {
                this.setExportUI(false); 
            }
        },

        forceStopWithError(message) {
            alert(message);
            if (this.recorder && this.recorder.state !== 'inactive') {
                this.recorder.onstop = null; // تعطيل حفظ الملف التالف
                this.recorder.stop();
            }
            App.DOM.coreAudio.pause();
            if(App.State.mediaType === 'video') App.DOM.mediaVideo.pause();
            App.Audio.updatePlayUI(false);
            this.setExportUI(false);
        },

        saveFile() {
            const txt = document.getElementById('export-status-text');
            if(txt) txt.innerText = "جاري تجميع الفيديو...";
            
            setTimeout(() => {
                try {
                    const blob = new Blob(this.chunks, { type: this.recorder.mimeType || 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    // تمديد متوافق مع نوع المخرجات
                    const ext = (this.recorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
                    a.download = `Quran_Studio_${Date.now()}.${ext}`;
                    
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                } catch (error) {
                    console.error("فشل في حفظ الملف:", error);
                    alert("حدث خطأ أثناء إخراج الملف إلى جهازك.");
                } finally {
                    this.setExportUI(false);
                }
            }, 800);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
