/**
 * Quran Studio Pro - Core Application Logic
 * Architecture: Object-Oriented JS (ES6)
 * Features: Audio Visualizer, Canvas Rendering, Proxy Fetching, Chunked Export
 */

const App = {
    // 1. إدارة الحالة المركزية (State Management)
    State: {
        playlist: [],
        currentIndex: 0,
        isPlaying: false,
        isExporting: false,
        surahName: '',
        animationId: null,
        mediaType: 'none', // 'video', 'image', 'none'
        visualizerData: new Uint8Array(0),
        proxyUrl: "https://api.allorigins.win/raw?url="
    },

    // 2. كاش عناصر واجهة المستخدم (DOM Caching)
    DOM: {},

    // 3. تهيئة التطبيق (Initialization)
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.setupTabs();
        this.API.loadSurahs();
        this.Canvas.initContext();
        lucide.createIcons();
        
        // بدء حلقة الرسم المستمرة
        this.Canvas.renderLoop();
    },

    cacheDOM() {
        const get = id => document.getElementById(id);
        this.DOM = {
            // Data Tab
            selEdition: get('sel-edition'),
            selSurah: get('sel-surah'),
            inpStart: get('inp-start'),
            inpEnd: get('inp-end'),
            btnFetch: get('btn-fetch'),
            // Player
            btnPlay: get('btn-play'),
            iconPlay: get('icon-play'),
            txtStatus: get('txt-status'),
            txtSubtitle: get('txt-subtitle'),
            // Design Tab
            inpBg: get('inp-bg'),
            selFont: get('sel-font'),
            rngSize: get('rng-size'),
            inpColor: get('inp-color'),
            colorHex: get('color-hex'),
            rngPos: get('rng-pos'),
            inpWatermark: get('inp-watermark'),
            // Effects Tab
            rngOverlay: get('rng-overlay'),
            valOverlay: get('val-overlay'),
            rngBlur: get('rng-blur'),
            valBlur: get('val-blur'),
            chkVisualizer: get('chk-visualizer'),
            inpVisColor: get('inp-vis-color'),
            // Export & Canvas
            btnExport: get('btn-export'),
            progressUI: get('export-progress-container'),
            mediaVideo: get('media-video'),
            mediaImage: get('media-image'),
            renderCanvas: get('render-canvas'),
            coreAudio: get('core-audio')
        };
    },

    bindEvents() {
        // API Events
        this.DOM.selSurah.addEventListener('change', () => this.API.updateLimits());
        this.DOM.btnFetch.addEventListener('click', () => this.API.fetchAyahs());
        
        // Media Upload
        this.DOM.inpBg.addEventListener('change', (e) => this.UI.handleMediaUpload(e));
        
        // Playback
        this.DOM.btnPlay.addEventListener('click', () => this.Audio.togglePlay());
        this.DOM.coreAudio.addEventListener('ended', () => this.Audio.handleTrackEnd());
        
        // UI Realtime Updates (Design & Effects)
        ['input', 'change'].forEach(evt => {
            this.DOM.inpColor.addEventListener(evt, (e) => this.DOM.colorHex.innerText = e.target.value.toUpperCase());
            this.DOM.rngOverlay.addEventListener(evt, (e) => this.DOM.valOverlay.innerText = e.target.value + '%');
            this.DOM.rngBlur.addEventListener(evt, (e) => this.DOM.valBlur.innerText = e.target.value + 'px');
        });

        // Export System
        this.DOM.btnExport.addEventListener('click', () => this.Export.start());
    },

    // 4. إدارة التبويبات (Tabs Logic)
    setupTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        const contents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // إزالة التنشيط من الجميع
                tabs.forEach(t => {
                    t.classList.remove('text-emerald-400', 'border-emerald-500');
                    t.classList.add('text-gray-400', 'border-transparent');
                });
                contents.forEach(c => c.classList.add('hidden'));
                
                // تنشيط الهدف
                tab.classList.remove('text-gray-400', 'border-transparent');
                tab.classList.add('text-emerald-400', 'border-emerald-500');
                document.getElementById(tab.dataset.target).classList.remove('hidden');
            });
        });
    },

    // 5. واجهة المستخدم والتفاعلات (UI Handler)
    UI: {
        handleMediaUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            const fileURL = URL.createObjectURL(file);
            
            if (file.type.startsWith('video/')) {
                App.DOM.mediaVideo.src = fileURL;
                App.State.mediaType = 'video';
                App.DOM.mediaVideo.play();
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

    // 6. الاتصال بالخوادم (API Interactor)
    API: {
        async loadSurahs() {
            try {
                const res = await fetch('https://api.alquran.cloud/v1/surah');
                const data = await res.json();
                App.DOM.selSurah.innerHTML = '';
                data.data.forEach(s => {
                    App.DOM.selSurah.add(new Option(`${s.number}. ${s.name}`, s.number));
                });
                this.updateLimits();
            } catch (err) {
                App.DOM.selSurah.innerHTML = '<option>تعذر الاتصال بالخادم</option>';
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
            const surah = App.DOM.selSurah.value;
            const edition = App.DOM.selEdition.value;
            const start = parseInt(App.DOM.inpStart.value);
            const end = parseInt(App.DOM.inpEnd.value);

            if (start > end) return alert("ترتيب الآيات غير صحيح.");
            
            App.UI.setLoading(App.DOM.btnFetch, true);

            try {
                const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/${edition}`);
                const data = await res.json();
                
                App.State.surahName = data.data.name;
                App.State.playlist = data.data.ayahs.slice(start - 1, end);
                App.State.currentIndex = 0;

                App.UI.updateStatus(`تم استيراد ${App.State.playlist.length} آية`, `سورة ${App.State.surahName}`);
                App.Audio.loadTrack(0);

            } catch (error) {
                alert("خطأ في جلب البيانات.");
            } finally {
                App.UI.setLoading(App.DOM.btnFetch, false, "استيراد الآيات", "download");
            }
        }
    },

    // 7. إدارة الصوتيات والموجات (تم إصلاح مشكلة الأيقونات)
    Audio: {
        context: null,
        analyser: null,
        source: null,

        initWebAudio() {
            if (this.context) return;
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 256;
            
            this.source = this.context.createMediaElementSource(App.DOM.coreAudio);
            this.source.connect(this.analyser);
            this.analyser.connect(this.context.destination);
            
            App.State.visualizerData = new Uint8Array(this.analyser.frequencyBinCount);
        },

        loadTrack(index) {
            if (index >= App.State.playlist.length) return;
            
            const track = App.State.playlist[index];
            App.DOM.coreAudio.src = App.State.proxyUrl + encodeURIComponent(track.audio);
            
            if (App.State.isPlaying || App.State.isExporting) {
                App.DOM.coreAudio.play().catch(e => console.log("تأخير في التشغيل:", e));
            }
        },

        togglePlay() {
            if (App.State.playlist.length === 0) return alert("قم باستيراد الآيات أولاً.");
            
            if (!this.context) this.initWebAudio();
            if (this.context.state === 'suspended') this.context.resume();

            if (App.State.isPlaying) {
                // إيقاف مؤقت
                App.DOM.coreAudio.pause();
                if(App.State.mediaType === 'video') App.DOM.mediaVideo.pause();
                
                // تحديث الأيقونة بالطريقة الصحيحة
                App.DOM.btnPlay.innerHTML = `<i data-lucide="play" class="w-5 h-5 fill-current"></i>`;
                App.DOM.btnPlay.classList.remove('audio-active-pulse');
            } else {
                // تشغيل
                if(App.State.currentIndex >= App.State.playlist.length) {
                    App.State.currentIndex = 0;
                    this.loadTrack(0);
                }
                App.DOM.coreAudio.play();
                if(App.State.mediaType === 'video') App.DOM.mediaVideo.play();
                
                // تحديث الأيقونة بالطريقة الصحيحة
                App.DOM.btnPlay.innerHTML = `<i data-lucide="pause" class="w-5 h-5 fill-current"></i>`;
                App.DOM.btnPlay.classList.add('audio-active-pulse');
            }
            
            lucide.createIcons(); // إعادة رسم الأيقونات
            App.State.isPlaying = !App.State.isPlaying;
        },

        handleTrackEnd() {
            App.State.currentIndex++;
            if (App.State.currentIndex < App.State.playlist.length) {
                this.loadTrack(App.State.currentIndex);
            } else {
                App.State.isPlaying = false;
                App.DOM.btnPlay.innerHTML = `<i data-lucide="play" class="w-5 h-5 fill-current"></i>`;
                App.DOM.btnPlay.classList.remove('audio-active-pulse');
                lucide.createIcons();
                
                if(App.State.mediaType === 'video') App.DOM.mediaVideo.pause();
                
                // إنهاء التصدير التلقائي
                if (App.State.isExporting) App.Export.stop();
            }
        }
    },

    // 8. محرك الرسم المتطور (Canvas 2D Rendering Engine)
    Canvas: {
        ctx: null,
        width: 1080,
        height: 1920,

        initContext() {
            this.ctx = App.DOM.renderCanvas.getContext('2d', { alpha: false });
        },

        renderLoop() {
            // استدعاء دالة الرسم باستمرار (60 FPS)
            App.State.animationId = requestAnimationFrame(() => App.Canvas.renderLoop());
            
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;

            // 1. رسم الخلفية (صورة أو فيديو أو أسود)
            ctx.filter = `blur(${App.DOM.rngBlur.value}px)`;
            if (App.State.mediaType === 'video') {
                ctx.drawImage(App.DOM.mediaVideo, 0, 0, w, h);
            } else if (App.State.mediaType === 'image') {
                ctx.drawImage(App.DOM.mediaImage, 0, 0, w, h);
            } else {
                ctx.fillStyle = '#0f172a'; // slate-900
                ctx.fillRect(0, 0, w, h);
            }
            ctx.filter = 'none';

            // 2. رسم طبقة التعتيم
            const overlayOpacity = App.DOM.rngOverlay.value / 100;
            ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
            ctx.fillRect(0, 0, w, h);

            // 3. رسم المتخيل الصوتي (Visualizer) إذا كان مفعل
            if (App.DOM.chkVisualizer.checked && App.Audio.analyser) {
                App.Audio.analyser.getByteFrequencyData(App.State.visualizerData);
                this.drawVisualizer(ctx, w, h);
            }

            // 4. إعدادات النصوص
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.direction = 'rtl';
            
            const yPos = (App.DOM.rngPos.value / 100) * h;
            const fontSize = parseInt(App.DOM.rngSize.value) * 1.5;
            const fontFam = App.DOM.selFont.value;

            // 5. رسم الآية الحالية
            if (App.State.playlist.length > 0 && App.State.currentIndex < App.State.playlist.length) {
                const currentAyah = App.State.playlist[App.State.currentIndex];
                const text = `${currentAyah.text} ﴿${currentAyah.numberInSurah}﴾`;
                
                ctx.font = `bold ${fontSize}px "${fontFam}"`;
                ctx.fillStyle = App.DOM.inpColor.value;
                
                // تأثير الظل الفاخر للنص
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 25;
                ctx.shadowOffsetY = 10;
                
                this.wrapText(ctx, text, w/2, yPos, w - 180, fontSize * 1.6);
                
                // إعادة ضبط الظل
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;

                // رسم اسم السورة أسفل الشاشة
                ctx.font = `40px "Cairo"`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.fillText(`سورة ${App.State.surahName}`, w/2, h - 200);
            }

            // 6. رسم العلامة المائية (Watermark)
            const watermark = App.DOM.inpWatermark.value;
            if (watermark) {
                ctx.direction = 'ltr';
                ctx.font = `35px "Cairo"`;
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillText(watermark, w/2, 100);
            }
        },

        drawVisualizer(ctx, w, h) {
            const data = App.State.visualizerData;
            const barWidth = 15;
            const spacing = 5;
            const bars = Math.floor(w / (barWidth + spacing));
            const startX = (w - (bars * (barWidth + spacing))) / 2;
            
            ctx.fillStyle = App.DOM.inpVisColor.value;
            
            for (let i = 0; i < bars; i++) {
                const dataIndex = Math.floor(i * (data.length / bars));
                let barHeight = data[dataIndex] * 1.5;
                
                const x = startX + i * (barWidth + spacing);
                const y = h - 300 - barHeight;
                
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, Math.max(barHeight, 5), 10);
                ctx.fill();
            }
        },

        wrapText(ctx, text, x, y, maxWidth, lineHeight) {
            const words = text.split(' ');
            let line = '';
            const lines = [];
            
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);
            
            const startY = y - ((lines.length - 1) * lineHeight) / 2;
            for(let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], x, startY + (i * lineHeight));
            }
        }
    },

    // 9. نظام التصدير المدمج (تم إصلاح مشكلة الصوت وتوافقية المتصفحات)
    Export: {
        recorder: null,
        chunks: [],

        start() {
            if (App.State.playlist.length === 0) return alert("لا يوجد محتوى لتصديره.");

            // 1. تهيئة واجهة التصدير
            App.DOM.btnExport.classList.add('hidden');
            App.DOM.progressUI.classList.remove('hidden');
            App.DOM.progressUI.classList.add('flex');
            App.State.isExporting = true;

            // 2. إجبار تهيئة محرك الصوت (لضمان وجود صوت حتى لو لم يضغط المعاينة)
            if (!App.Audio.context) App.Audio.initWebAudio();
            if (App.Audio.context.state === 'suspended') App.Audio.context.resume();

            // 3. التقاط الفيديو والصوت
            const canvasStream = App.DOM.renderCanvas.captureStream(30); // 30 FPS
            const dest = App.Audio.context.createMediaStreamDestination();
            
            // توصيل الصوت لملف التصدير وللسماعات في نفس الوقت
            App.Audio.source.connect(dest);
            App.Audio.source.connect(App.Audio.context.destination);

            const combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ]);

            this.initRecorder(combinedStream);

            // 4. إعادة التشغيل من البداية لبدء التسجيل
            if(App.State.mediaType === 'video') {
                App.DOM.mediaVideo.currentTime = 0;
                App.DOM.mediaVideo.play();
            }
            App.State.currentIndex = 0;
            App.Audio.loadTrack(0);
            
            this.recorder.start(1000); 
        },

        initRecorder(stream) {
            this.chunks = [];
            
            // البحث عن أفضل صيغة مدعومة في متصفح المستخدم
            const types = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm',
                'video/mp4'
            ];
            
            let options = {};
            for (let type of types) {
                if (MediaRecorder.isTypeSupported(type)) {
                    options = { mimeType: type };
                    break;
                }
            }

            this.recorder = new MediaRecorder(stream, options);

            this.recorder.ondataavailable = e => {
                if (e.data.size > 0) this.chunks.push(e.data);
            };

            this.recorder.onstop = () => this.saveFile();
        },

        stop() {
            if (this.recorder && this.recorder.state !== 'inactive') {
                this.recorder.stop();
            }
        },

        saveFile() {
            document.getElementById('export-status-text').innerText = "جاري تجميع الفيديو...";
            
            setTimeout(() => {
                // حفظ الملف
                const blob = new Blob(this.chunks, { type: this.recorder.mimeType || 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `Quran_Reel_${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);

                // استعادة شكل الزر والواجهة
                App.State.isExporting = false;
                App.DOM.progressUI.classList.add('hidden');
                App.DOM.progressUI.classList.remove('flex');
                App.DOM.btnExport.classList.remove('hidden');
                document.getElementById('export-status-text').innerText = "جاري المعالجة...";
            }, 800);
        }
    }
};

// بدء تشغيل التطبيق عند اكتمال تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => App.init());
