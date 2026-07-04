const FILLER_WORDS = ["um", "uh", "like", "you know", "basically", "actually", "so yeah", "kind of", "sort of"];

class SpeechController {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = !!SR;
    if (this.supported) {
      this.recognition = new SR();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-IN";
    }
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.onVolume = null;
    this.onTranscriptUpdate = null;
    this._finalTranscript = "";
    this._startTime = null;
  }

  countFillerWords(text) {
    const lower = ` ${text.toLowerCase()} `;
    let count = 0;
    FILLER_WORDS.forEach((f) => {
      const re = new RegExp(`\\b${f.replace(/ /g, "\\s+")}\\b`, "g");
      const matches = lower.match(re);
      if (matches) count += matches.length;
    });
    return count;
  }

  async start(onTranscriptUpdate, onVolume) {
    this._finalTranscript = "";
    this._startTime = Date.now();
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onVolume = onVolume;

    // Mic volume visualizer (independent of recognition support)
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this._pollVolume();
    } catch (e) {
      console.warn("Mic volume visualizer unavailable:", e.message);
    }

    if (this.supported) {
      this.recognition.onresult = (event) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += transcriptPiece + " ";
          else interim += transcriptPiece;
        }
        this._finalTranscript += final;
        if (this.onTranscriptUpdate) this.onTranscriptUpdate(this._finalTranscript + interim);
      };
      this.recognition.onerror = (e) => console.warn("Speech recognition error:", e.error);
      this.recognition.start();
    }
  }

  _pollVolume() {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      if (this.onVolume) this.onVolume(Math.min(1, avg / 90));
      this._raf = requestAnimationFrame(tick);
    };
    tick();
  }

  stop() {
    const durationSeconds = this._startTime ? Math.round((Date.now() - this._startTime) / 1000) : 0;
    if (this.supported && this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.mediaStream) this.mediaStream.getTracks().forEach((t) => t.stop());
    if (this.audioContext) this.audioContext.close();
    this.analyser = null;
    const text = this._finalTranscript.trim();
    return {
      transcript: text,
      fillerWordCount: this.countFillerWords(text),
      durationSeconds,
    };
  }

  speak(text, { onEnd } = {}) {
    if (!window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.98;
    utter.pitch = 1;
    if (onEnd) utter.onend = onEnd;
    window.speechSynthesis.speak(utter);
  }
}

const Speech = new SpeechController();
