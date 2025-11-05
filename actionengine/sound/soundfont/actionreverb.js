// actionengine/sound/actionreverb.js
// ActionReverb - Reverb effect for audio processing

/**
 * ActionReverb Class
 * Provides reverb effect using convolver node
 */
class ActionReverb {
  constructor(ctx, providedOptions = {}) {
    const defaultOptions = {
      decay: 5,
      delay: 0,
      filterFreq: 2200,
      filterQ: 1,
      filterType: 'lowpass',
      mix: 0.5,
      reverse: false,
      time: 3
    };

    const options = { ...defaultOptions, ...providedOptions };

    this.ctx = ctx;
    this.wetGainNode = this.ctx.createGain();
    this.dryGainNode = this.ctx.createGain();
    this.filterNode = this.ctx.createBiquadFilter();
    this.convolverNode = this.ctx.createConvolver();
    this.outputNode = this.ctx.createGain();

    this._decay = options.decay;
    this._delay = options.delay;
    this._reverse = options.reverse;
    this._time = options.time;
    this._filterType = options.filterType;
    this._freq = options.filterFreq;
    this._q = options.filterQ;
    this._mix = options.mix;

    this.time(this._time);
    this.delay(this._delay);
    this.decay(this._decay);
    this.reverse(this._reverse);
    this.filterType(this._filterType);
    this.filterFreq(this._freq);
    this.filterQ(this._q);
    this.mix(this._mix);

    this.isConnected = false;

    this.buildImpulse();
  }

  /**
   * Connect source node through reverb
   * @param {AudioNode} sourceNode
   * @return {AudioNode}
   */
  connect(sourceNode) {
    this.isConnected = true;
    
    // Connect convolver to filter
    this.convolverNode.connect(this.filterNode);
    // Connect filter to wet gain
    this.filterNode.connect(this.wetGainNode);
    // Connect input to convolver
    sourceNode.connect(this.convolverNode);
    // Connect dry path
    sourceNode.connect(this.dryGainNode).connect(this.outputNode);
    // Connect wet path
    sourceNode.connect(this.wetGainNode).connect(this.outputNode);

    return this.outputNode;
  }

  /**
   * Disconnect source node from reverb
   * @param {AudioNode} sourceNode
   * @return {AudioNode}
   */
  disconnect(sourceNode) {
    try {
      this.convolverNode.disconnect(this.filterNode);
      this.filterNode.disconnect(this.wetGainNode);
      sourceNode.disconnect(this.convolverNode);
      sourceNode.disconnect(this.dryGainNode);
      this.dryGainNode.disconnect(this.outputNode);
      sourceNode.disconnect(this.wetGainNode);
      this.wetGainNode.disconnect(this.outputNode);
    } catch (e) {
      // Nodes may already be disconnected
    }

    this.isConnected = false;
    return sourceNode;
  }

  /**
   * Set dry/wet mix level
   * @param {number} mix - Mix level (0.0 to 1.0)
   */
  mix(mix) {
    if (!this.inRange(mix, 0, 1)) {
      console.warn('[ActionReverb] Dry/Wet level must be between 0 to 1.');
      return;
    }
    this._mix = mix;
    this.dryGainNode.gain.value = 1 - this._mix;
    this.wetGainNode.gain.value = this._mix;
  }

  /**
   * Set impulse response time length
   * @param {number} value - Time in seconds
   */
  time(value) {
    if (!this.inRange(value, 1, 50)) {
      console.warn('[ActionReverb] Time length of impulse response must be less than 50sec.');
      return;
    }
    this._time = value;
    this.buildImpulse();
  }

  /**
   * Set impulse response decay rate
   * @param {number} value - Decay level
   */
  decay(value) {
    if (!this.inRange(value, 0, 100)) {
      console.warn('[ActionReverb] Impulse Response decay level must be less than 100.');
      return;
    }
    this._decay = value;
    this.buildImpulse();
  }

  /**
   * Set impulse response delay time
   * @param {number} value - Delay time
   */
  delay(value) {
    if (!this.inRange(value, 0, 100)) {
      console.warn('[ActionReverb] Impulse Response delay time must be less than 100.');
      return;
    }
    this._delay = value;
    this.buildImpulse();
  }

  /**
   * Reverse the impulse response
   * @param {boolean} reverse
   */
  reverse(reverse) {
    this._reverse = reverse;
    this.buildImpulse();
  }

  /**
   * Set filter type
   * @param {BiquadFilterType} type
   */
  filterType(type) {
    this._filterType = type;
    this.filterNode.type = type;
  }

  /**
   * Set filter frequency
   * @param {number} freq - Frequency in Hz
   */
  filterFreq(freq) {
    if (!this.inRange(freq, 20, 5000)) {
      console.warn('[ActionReverb] Filter frequency must be between 20 and 5000.');
      return;
    }
    this._freq = freq;
    this.filterNode.frequency.value = this._freq;
  }

  /**
   * Set filter quality
   * @param {number} q - Quality value
   */
  filterQ(q) {
    if (!this.inRange(q, 0, 10)) {
      console.warn('[ActionReverb] Filter quality value must be between 0 and 10.');
      return;
    }
    this._q = q;
    this.filterNode.Q.value = this._q;
  }

  /**
   * Check if value is in range
   * @private
   * @param {number} x - Target value
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @return {boolean}
   */
  inRange(x, min, max) {
    return ((x - min) * (x - max) <= 0);
  }

  /**
   * Build impulse response buffer
   * @private
   */
  buildImpulse() {
    const rate = this.ctx.sampleRate;
    const length = Math.max(rate * this._time, 1);
    const delayDuration = rate * this._delay;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const impulseL = new Float32Array(length);
    const impulseR = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      let n = 0;

      if (i < delayDuration) {
        impulseL[i] = 0;
        impulseR[i] = 0;
        n = this._reverse ? length - (i - delayDuration) : i - delayDuration;
      } else {
        n = this._reverse ? length - i : i;
      }

      const pow = Math.pow(1 - n / length, this._decay);

      impulseL[i] = this.getNoise(pow);
      impulseR[i] = this.getNoise(pow);
    }

    impulse.getChannelData(0).set(impulseL);
    impulse.getChannelData(1).set(impulseR);

    this.convolverNode.buffer = impulse;
  }

  /**
   * Generate white noise
   * @private
   * @param {number} rate - Attenuation rate
   * @return {number}
   */
  getNoise(rate) {
    return (Math.random() * 2 - 1) * rate;
  }
}

window.ActionReverb = ActionReverb;
