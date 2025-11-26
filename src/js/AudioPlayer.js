export default class AudioPlayer {
  static _cache = new Map();
  static _playing = new Set();

  static async preloadSound(soundUrl) {
    if (!this._cache.has(soundUrl)) {
      const audio = new Audio(soundUrl);
      audio.preload = "auto";
      await new Promise((resolve, reject) => {
        audio.addEventListener("canplaythrough", resolve);
        audio.addEventListener("error", reject);
      });
      this._cache.set(soundUrl, audio);
    }
  }

  static playSound(soundUrl, fadeTime = 0, loop = false, fadeOnLoop = false) {
    let audio;

    if (this._cache.has(soundUrl)) {
      const original = this._cache.get(soundUrl);
      audio = original.cloneNode();
    } else {
      audio = new Audio(soundUrl);
    }

    audio.loop = loop;
    this._playing.add(audio); // Track this instance

    audio.addEventListener("ended", () => this._playing.delete(audio));
    audio.addEventListener("pause", () => {
      if (!audio.loop) this._playing.delete(audio);
    });

    if (fadeTime > 0) {
      audio.volume = 0;
      const fadeSteps = 20;
      const fadeStepTime = fadeTime / fadeSteps;
      const fadeInterval = setInterval(() => {
        if (audio.volume >= 1) {
          clearInterval(fadeInterval);
        } else {
          audio.volume = Math.min(1, audio.volume + 1 / fadeSteps);
        }
      }, fadeStepTime);

      if (fadeOnLoop && loop) {
        audio.addEventListener("timeupdate", () => {
          const timeLeft = audio.duration - audio.currentTime;
          if (timeLeft <= fadeTime) {
            audio.volume = Math.max(0, timeLeft / fadeTime);
          }
        });
      }
    }

    audio.play().catch((err) => {
      console.warn(`Failed to play sound "${soundUrl}"`, err);
      this._playing.delete(audio);
    });
  }

  static stopAll() {
    this._playing.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this._playing.clear(); // Clear the set after stopping
  }
}
