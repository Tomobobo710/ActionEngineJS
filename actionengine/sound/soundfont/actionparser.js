// actionengine/sound/actionparser.js
// ActionParser - SoundFont2 file parser

/**
 * RIFF Chunk Class
 */
class ActionRiffChunk {
  constructor(type, size, offset) {
    this.type = type;
    this.size = size;
    this.offset = offset;
  }
}

/**
 * RIFF Parser Class
 */
class ActionRiff {
  constructor(input, optParams = {}) {
    this.input = input;
    this.ip = optParams.index || 0;
    this.length = optParams.length || input.length - this.ip;
    this.chunkList = [];
    this.offset = this.ip;
    this.padding = optParams.padding !== undefined ? optParams.padding : true;
    this.bigEndian = optParams.bigEndian !== undefined ? optParams.bigEndian : false;
  }

  parse() {
    const end = this.length + this.offset;
    this.chunkList = [];
    
    while (this.ip < end) {
      this.parseChunk();
    }
  }

  parseChunk() {
    const data = this.input;
    let ip = this.ip;

    // Read chunk type (4 chars)
    const type = String.fromCharCode(
      data[ip++], data[ip++], data[ip++], data[ip++]
    );

    // Read chunk size (4 bytes)
    const size = this.bigEndian ?
      ((data[ip++] << 24) | (data[ip++] << 16) | (data[ip++] << 8) | data[ip++]) >>> 0 :
      ((data[ip++]) | (data[ip++] << 8) | (data[ip++] << 16) | (data[ip++] << 24)) >>> 0;

    this.chunkList.push(new ActionRiffChunk(type, size, ip));

    ip += size;

    // Apply padding if needed
    if (this.padding && ((ip - this.offset) & 1) === 1) {
      ip++;
    }

    this.ip = ip;
  }

  getChunk(index) {
    return this.chunkList[index] || null;
  }

  getNumberOfChunks() {
    return this.chunkList.length;
  }
}

/**
 * ActionParser Class
 * Parses SoundFont2 files
 */
class ActionParser {
  constructor(input, optParams = {}) {
    this.input = input;
    this.parserOption = optParams.parserOption || {};
    this.sampleRate = optParams.sampleRate || 22050;

    // SF2 data structures
    this.presetHeader = [];
    this.presetZone = [];
    this.presetZoneModulator = [];
    this.presetZoneGenerator = [];
    this.instrument = [];
    this.instrumentZone = [];
    this.instrumentZoneModulator = [];
    this.instrumentZoneGenerator = [];
    this.sampleHeader = [];
    this.sample = [];
    this.samplingData = null;

    // Generator enumerator table
    this.GeneratorEnumeratorTable = [
      'startAddrsOffset',
      'endAddrsOffset',
      'startloopAddrsOffset',
      'endloopAddrsOffset',
      'startAddrsCoarseOffset',
      'modLfoToPitch',
      'vibLfoToPitch',
      'modEnvToPitch',
      'initialFilterFc',
      'initialFilterQ',
      'modLfoToFilterFc',
      'modEnvToFilterFc',
      'endAddrsCoarseOffset',
      'modLfoToVolume',
      undefined, // 14
      'chorusEffectsSend',
      'reverbEffectsSend',
      'pan',
      undefined, undefined, undefined, // 18, 19, 20
      'delayModLFO',
      'freqModLFO',
      'delayVibLFO',
      'freqVibLFO',
      'delayModEnv',
      'attackModEnv',
      'holdModEnv',
      'decayModEnv',
      'sustainModEnv',
      'releaseModEnv',
      'keynumToModEnvHold',
      'keynumToModEnvDecay',
      'delayVolEnv',
      'attackVolEnv',
      'holdVolEnv',
      'decayVolEnv',
      'sustainVolEnv',
      'releaseVolEnv',
      'keynumToVolEnvHold',
      'keynumToVolEnvDecay',
      'instrument',
      undefined, // 42
      'keyRange',
      'velRange',
      'startloopAddrsCoarseOffset',
      'keynum',
      'velocity',
      'initialAttenuation',
      undefined, // 49
      'endloopAddrsCoarseOffset',
      'coarseTune',
      'fineTune',
      'sampleID',
      'sampleModes',
      undefined, // 55
      'scaleTuning',
      'exclusiveClass',
      'overridingRootKey',
      'endOper'
    ];
  }

  parse() {
    const parser = new ActionRiff(this.input, this.parserOption);
    parser.parse();
    
    if (parser.chunkList.length !== 1) {
      throw new Error('Wrong chunk length');
    }

    const chunk = parser.getChunk(0);
    if (!chunk) {
      throw new Error('Chunk not found');
    }

    this.parseRiffChunk(chunk);
    this.input = null;
  }

  parseRiffChunk(chunk) {
    const data = this.input;
    let ip = chunk.offset;

    if (chunk.type !== 'RIFF') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }

    // Check signature
    const signature = String.fromCharCode(data[ip++], data[ip++], data[ip++], data[ip++]);
    if (signature !== 'sfbk') {
      throw new Error('Invalid signature: ' + signature);
    }

    const parser = new ActionRiff(data, { index: ip, length: chunk.size - 4 });
    parser.parse();

    if (parser.getNumberOfChunks() !== 3) {
      throw new Error('Invalid sfbk structure');
    }

    // Parse the three main lists
    this.parseInfoList(parser.getChunk(0));
    this.parseSdtaList(parser.getChunk(1));
    this.parsePdtaList(parser.getChunk(2));
  }

  parseInfoList(chunk) {
    const data = this.input;
    let ip = chunk.offset;

    if (chunk.type !== 'LIST') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }

    const signature = String.fromCharCode(data[ip++], data[ip++], data[ip++], data[ip++]);
    if (signature !== 'INFO') {
      throw new Error('Invalid signature: ' + signature);
    }

    // INFO list parsed (contains metadata we don't currently need)
    const parser = new ActionRiff(data, { index: ip, length: chunk.size - 4 });
    parser.parse();
  }

  parseSdtaList(chunk) {
    const data = this.input;
    let ip = chunk.offset;

    if (chunk.type !== 'LIST') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }

    const signature = String.fromCharCode(data[ip++], data[ip++], data[ip++], data[ip++]);
    if (signature !== 'sdta') {
      throw new Error('Invalid signature: ' + signature);
    }

    const parser = new ActionRiff(data, { index: ip, length: chunk.size - 4 });
    parser.parse();
    
    if (parser.chunkList.length !== 1) {
      throw new Error('Invalid sdta structure');
    }
    
    this.samplingData = parser.getChunk(0);
  }

  parsePdtaList(chunk) {
    const data = this.input;
    let ip = chunk.offset;

    if (chunk.type !== 'LIST') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }

    const signature = String.fromCharCode(data[ip++], data[ip++], data[ip++], data[ip++]);
    if (signature !== 'pdta') {
      throw new Error('Invalid signature: ' + signature);
    }

    const parser = new ActionRiff(data, { index: ip, length: chunk.size - 4 });
    parser.parse();

    if (parser.getNumberOfChunks() !== 9) {
      throw new Error('Invalid pdta chunk');
    }

    // Parse all preset data chunks
    this.parsePhdr(parser.getChunk(0));
    this.parsePbag(parser.getChunk(1));
    this.parsePmod(parser.getChunk(2));
    this.parsePgen(parser.getChunk(3));
    this.parseInst(parser.getChunk(4));
    this.parseIbag(parser.getChunk(5));
    this.parseImod(parser.getChunk(6));
    this.parseIgen(parser.getChunk(7));
    this.parseShdr(parser.getChunk(8));
  }

  parsePhdr(chunk) {
    const data = this.input;
    let ip = chunk.offset;
    const size = chunk.offset + chunk.size;

    if (chunk.type !== 'phdr') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }

    this.presetHeader = [];

    while (ip < size) {
      this.presetHeader.push({
        presetName: String.fromCharCode.apply(null, data.subarray(ip, ip += 20)),
        preset: data[ip++] | (data[ip++] << 8),
        bank: data[ip++] | (data[ip++] << 8),
        presetBagIndex: data[ip++] | (data[ip++] << 8),
        library: (data[ip++] | (data[ip++] << 8) | (data[ip++] << 16) | (data[ip++] << 24)) >>> 0,
        genre: (data[ip++] | (data[ip++] << 8) | (data[ip++] << 16) | (data[ip++] << 24)) >>> 0,
        morphology: (data[ip++] | (data[ip++] << 8) | (data[ip++] << 16) | (data[ip++] << 24)) >>> 0
      });
    }
  }

  parsePbag(chunk) {
    const data = this.input;
    let ip = chunk.offset;
    const size = chunk.offset + chunk.size;

    if (chunk.type !== 'pbag') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }

    this.presetZone = [];

    while (ip < size) {
      this.presetZone.push({
        presetGeneratorIndex: data[ip++] | (data[ip++] << 8),
        presetModulatorIndex: data[ip++] | (data[ip++] << 8)
      });
    }
  }

  parsePmod(chunk) {
    if (chunk.type !== 'pmod') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }
    this.presetZoneModulator = this.parseModulator(chunk);
  }

  parsePgen(chunk) {
    if (chunk.type !== 'pgen') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }
    this.presetZoneGenerator = this.parseGenerator(chunk);
  }

  parseInst(chunk) {
    const data = this.input;
    let ip = chunk.offset;
    const size = chunk.offset + chunk.size;

    if (chunk.type !== 'inst') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }

    this.instrument = [];

    while (ip < size) {
      this.instrument.push({
        instrumentName: String.fromCharCode.apply(null, data.subarray(ip, ip += 20)),
        instrumentBagIndex: data[ip++] | (data[ip++] << 8)
      });
    }
  }

  parseIbag(chunk) {
    const data = this.input;
    let ip = chunk.offset;
    const size = chunk.offset + chunk.size;

    if (chunk.type !== 'ibag') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }

    this.instrumentZone = [];

    while (ip < size) {
      this.instrumentZone.push({
        instrumentGeneratorIndex: data[ip++] | (data[ip++] << 8),
        instrumentModulatorIndex: data[ip++] | (data[ip++] << 8)
      });
    }
  }

  parseImod(chunk) {
    if (chunk.type !== 'imod') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }
    this.instrumentZoneModulator = this.parseModulator(chunk);
  }

  parseIgen(chunk) {
    if (chunk.type !== 'igen') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }
    this.instrumentZoneGenerator = this.parseGenerator(chunk);
  }

  parseShdr(chunk) {
    const data = this.input;
    let ip = chunk.offset;
    const size = chunk.offset + chunk.size;

    if (chunk.type !== 'shdr') {
      throw new Error('Invalid chunk type: ' + chunk.type);
    }

    this.sample = [];
    this.sampleHeader = [];

    while (ip < size) {
      const sampleName = String.fromCharCode.apply(null, data.subarray(ip, ip += 20));
      let start = ((data[ip++] << 0) | (data[ip++] << 8) | (data[ip++] << 16) | (data[ip++] << 24)) >>> 0;
      let end = ((data[ip++] << 0) | (data[ip++] << 8) | (data[ip++] << 16) | (data[ip++] << 24)) >>> 0;
      let startLoop = ((data[ip++] << 0) | (data[ip++] << 8) | (data[ip++] << 16) | (data[ip++] << 24)) >>> 0;
      let endLoop = ((data[ip++] << 0) | (data[ip++] << 8) | (data[ip++] << 16) | (data[ip++] << 24)) >>> 0;
      let sampleRate = ((data[ip++] << 0) | (data[ip++] << 8) | (data[ip++] << 16) | (data[ip++] << 24)) >>> 0;
      const originalPitch = data[ip++];
      const pitchCorrection = (data[ip++] << 24) >> 24;
      const sampleLink = data[ip++] | (data[ip++] << 8);
      const sampleType = data[ip++] | (data[ip++] << 8);

      // Extract sample data
      let sample = new Int16Array(new Uint8Array(data.subarray(
        this.samplingData.offset + start * 2,
        this.samplingData.offset + end * 2
      )).buffer);

      startLoop -= start;
      endLoop -= start;

      // Adjust sample rate if needed
      if (sampleRate > 0) {
        const adjust = this.adjustSampleData(sample, sampleRate);
        sample = adjust.sample;
        sampleRate *= adjust.multiply;
        startLoop *= adjust.multiply;
        endLoop *= adjust.multiply;
      }

      this.sample.push(sample);
      this.sampleHeader.push({
        sampleName,
        start,
        end,
        startLoop,
        endLoop,
        sampleRate,
        originalPitch,
        pitchCorrection,
        sampleLink,
        sampleType
      });
    }
  }

  adjustSampleData(sample, sampleRate) {
    let newSample;
    let multiply = 1;

    // Upsample if sample rate is too low
    while (sampleRate < this.sampleRate) {
      newSample = new Int16Array(sample.length * 2);
      let j = 0;
      for (let i = 0; i < sample.length; i++) {
        newSample[j++] = sample[i];
        newSample[j++] = sample[i];
      }
      sample = newSample;
      multiply *= 2;
      sampleRate *= 2;
    }

    return { sample, multiply };
  }

  parseModulator(chunk) {
    const data = this.input;
    let ip = chunk.offset;
    const size = chunk.offset + chunk.size;
    const output = [];

    while (ip < size) {
      ip += 2; // Src Oper
      
      const code = data[ip++] | (data[ip++] << 8);
      const key = this.GeneratorEnumeratorTable[code];
      
      if (key === undefined) {
        output.push({
          type: key,
          value: {
            code,
            amount: (data[ip] | (data[ip + 1] << 8)) << 16 >> 16,
            lo: data[ip++],
            hi: data[ip++]
          }
        });
      } else {
        switch (key) {
          case 'keyRange':
          case 'velRange':
          case 'keynum':
          case 'velocity':
            output.push({
              type: key,
              value: {
                lo: data[ip++],
                hi: data[ip++]
              }
            });
            break;
          default:
            output.push({
              type: key,
              value: {
                amount: (data[ip++] | (data[ip++] << 8)) << 16 >> 16
              }
            });
            break;
        }
      }
      
      ip += 2; // AmtSrcOper
      ip += 2; // Trans Oper
    }

    return output;
  }

  parseGenerator(chunk) {
    const data = this.input;
    let ip = chunk.offset;
    const size = chunk.offset + chunk.size;
    const output = [];

    while (ip < size) {
      const code = data[ip++] | (data[ip++] << 8);
      const key = this.GeneratorEnumeratorTable[code];
      
      if (key === undefined) {
        output.push({
          type: key,
          value: {
            code,
            amount: (data[ip] | (data[ip + 1] << 8)) << 16 >> 16,
            lo: data[ip++],
            hi: data[ip++]
          }
        });
        continue;
      }

      switch (key) {
        case 'keynum':
        case 'keyRange':
        case 'velRange':
        case 'velocity':
          output.push({
            type: key,
            value: {
              lo: data[ip++],
              hi: data[ip++]
            }
          });
          break;
        default:
          output.push({
            type: key,
            value: {
              amount: (data[ip++] | (data[ip++] << 8)) << 16 >> 16
            }
          });
          break;
      }
    }

    return output;
  }

  createInstrument() {
    const output = [];

    for (let i = 0; i < this.instrument.length; i++) {
      const bagIndex = this.instrument[i].instrumentBagIndex;
      const bagIndexEnd = this.instrument[i + 1] ? this.instrument[i + 1].instrumentBagIndex : this.instrumentZone.length;
      const zoneInfo = [];

      for (let j = bagIndex; j < bagIndexEnd; j++) {
        const instrumentGenerator = this.createInstrumentGenerator(this.instrumentZone, j);
        const instrumentModulator = this.createInstrumentModulator(this.instrumentZone, j);

        zoneInfo.push({
          generator: instrumentGenerator.generator,
          generatorSequence: instrumentGenerator.generatorInfo,
          modulator: instrumentModulator.modulator,
          modulatorSequence: instrumentModulator.modulatorInfo
        });
      }

      output.push({
        name: this.instrument[i].instrumentName,
        info: zoneInfo
      });
    }

    return output;
  }

  createPreset() {
    const output = [];

    for (let i = 0; i < this.presetHeader.length; i++) {
      const bagIndex = this.presetHeader[i].presetBagIndex;
      const bagIndexEnd = this.presetHeader[i + 1] ? this.presetHeader[i + 1].presetBagIndex : this.presetZone.length;
      const zoneInfo = [];
      let instrument = null;

      for (let j = bagIndex; j < bagIndexEnd; j++) {
        const presetGenerator = this.createPresetGenerator(this.presetZone, j);
        const presetModulator = this.createPresetModulator(this.presetZone, j);

        zoneInfo.push({
          generator: presetGenerator.generator,
          generatorSequence: presetGenerator.generatorInfo,
          modulator: presetModulator.modulator,
          modulatorSequence: presetModulator.modulatorInfo
        });

        instrument = presetGenerator.generator.instrument !== undefined ?
          presetGenerator.generator.instrument.amount :
          presetModulator.modulator.instrument !== undefined ?
            presetModulator.modulator.instrument.amount :
            null;
      }

      output.push({
        name: this.presetHeader[i].presetName,
        info: zoneInfo,
        header: this.presetHeader[i],
        instrument
      });
    }

    return output;
  }

  createInstrumentGenerator(zone, index) {
    const modgen = this.createBagModGen(
      zone,
      zone[index].instrumentGeneratorIndex,
      zone[index + 1] ? zone[index + 1].instrumentGeneratorIndex : this.instrumentZoneGenerator.length,
      this.instrumentZoneGenerator
    );

    return {
      generator: modgen.modgen,
      generatorInfo: modgen.modgenInfo
    };
  }

  createInstrumentModulator(zone, index) {
    const modgen = this.createBagModGen(
      zone,
      zone[index].instrumentModulatorIndex,
      zone[index + 1] ? zone[index + 1].instrumentModulatorIndex : this.instrumentZoneModulator.length,
      this.instrumentZoneModulator
    );

    return {
      modulator: modgen.modgen,
      modulatorInfo: modgen.modgenInfo
    };
  }

  createPresetGenerator(zone, index) {
    const modgen = this.createBagModGen(
      zone,
      zone[index].presetGeneratorIndex,
      zone[index + 1] ? zone[index + 1].presetGeneratorIndex : this.presetZoneGenerator.length,
      this.presetZoneGenerator
    );

    return {
      generator: modgen.modgen,
      generatorInfo: modgen.modgenInfo
    };
  }

  createPresetModulator(zone, index) {
    const modgen = this.createBagModGen(
      zone,
      zone[index].presetModulatorIndex,
      zone[index + 1] ? zone[index + 1].presetModulatorIndex : this.presetZoneModulator.length,
      this.presetZoneModulator
    );

    return {
      modulator: modgen.modgen,
      modulatorInfo: modgen.modgenInfo
    };
  }

  createBagModGen(zone, indexStart, indexEnd, zoneModGen) {
    const modgenInfo = [];
    const modgen = {
      unknown: [],
      keyRange: {
        hi: 127,
        lo: 0
      }
    };

    for (let i = indexStart; i < indexEnd; i++) {
      const info = zoneModGen[i];
      modgenInfo.push(info);

      if (info.type === 'unknown') {
        modgen.unknown.push(info.value);
      } else {
        modgen[info.type] = info.value;
      }
    }

    return {
      modgen,
      modgenInfo
    };
  }
}

window.ActionParser = ActionParser;
