/* YooBird — CrazyGames SDK v3 adapter with a standalone browser fallback. */
(function (root) {
  'use strict';
  const SAVE_KEY = 'yoobird_save_v1';

  const P = {
    name: 'local', isCrazyGames: false, sdk: null, adOpen: false,
    onPause: null, onResume: null,
    _wantsGameplay: false, _playing: false, _loading: false,

    async init() {
      const sdk = root.CrazyGames && root.CrazyGames.SDK;
      if (!sdk) return;
      try {
        await sdk.init();
        if (sdk.environment !== 'crazygames' && sdk.environment !== 'local') return;
        this.sdk = sdk; this.isCrazyGames = true; this.name = 'crazygames';
        sdk.game.loadingStart(); this._loading = true;
      } catch (error) {
        console.warn('CrazyGames SDK initialization failed; using browser storage.', error);
      }
    },

    loadingReady() {
      if (!this.sdk || !this._loading) return;
      try { this.sdk.game.loadingStop(); this._loading = false; }
      catch (error) { console.warn('CrazyGames loading event failed.', error); }
    },
    gameplayStart() { this._wantsGameplay = true; this.syncGameplay(); },
    gameplayStop() { this._wantsGameplay = false; this.syncGameplay(); },
    syncGameplay() {
      if (!this.sdk) return;
      const game = root.YB.Game;
      // Focus changes are handled by the portal, not by gameplay events.
      const blocked = game && (game.paused || Array.from(game.extPause).some((r) => r !== 'hidden'));
      const playing = this._wantsGameplay && !this.adOpen && !blocked;
      if (playing === this._playing) return;
      try {
        this.sdk.game[playing ? 'gameplayStart' : 'gameplayStop']();
        this._playing = playing;
      } catch (error) { console.warn('CrazyGames gameplay event failed.', error); }
    },

    showInterstitial() { return this._requestAd('midgame'); },
    showRewarded() { return this._requestAd('rewarded'); },
    _requestAd(type) {
      // No simulated rewards outside the SDK, and no concurrent requests.
      if (!this.sdk || this.adOpen) return Promise.resolve(false);
      this.adOpen = true;
      this.syncGameplay();
      if (this.onPause) this.onPause('ad');
      return new Promise((resolve) => {
        let settled = false;
        const finish = (success) => {
          if (settled) return;
          settled = true;
          this.adOpen = false;
          if (this.onResume) this.onResume('ad');
          this.syncGameplay();
          resolve(success);
        };
        try {
          this.sdk.ad.requestAd(type, {
            adStarted: () => {},
            adFinished: () => finish(true),
            adError: (error) => { console.info('CrazyGames ad unavailable.', error); finish(false); },
          });
        } catch (error) {
          console.warn('CrazyGames ad request failed.', error); finish(false);
        }
        // Do not use a timeout: it could resume audio underneath a running ad.
      });
    },

    async load() {
      try {
        const value = this.sdk ? this.sdk.data.getItem(SAVE_KEY) : localStorage.getItem(SAVE_KEY);
        const data = JSON.parse(value || 'null');
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
      } catch (error) { console.warn('Unable to read saved progress.', error); return null; }
    },
    save(data) {
      try {
        const value = JSON.stringify(data);
        if (this.sdk) this.sdk.data.setItem(SAVE_KEY, value);
        else localStorage.setItem(SAVE_KEY, value);
      } catch (error) { console.warn('Unable to save progress.', error); }
    },

    haptic(style) {
      try {
        const ua = navigator.userActivation;
        if (!navigator.vibrate || (ua && !ua.hasBeenActive) || !root.matchMedia('(pointer: coarse)').matches) return;
        navigator.vibrate(style === 'heavy' ? 40 : style === 'medium' ? 22 : 10);
      } catch (error) { /* Haptics are optional. */ }
    },
  };
  root.YB = Object.assign(root.YB || {}, { Platform: P });
})(window);
