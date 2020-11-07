// white-noise-processor.js

// https://github.com/WebAudio/web-audio-api/issues/1503

// https://developers.google.com/web/updates/2017/12/audio-worklet
class ClientProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }
  process(inputs, outputs, parameters) {
    const array = inputs[0][0];

    if (!this.index) {
      this.index = 0;
    }
    if (!array) {
      return true;
    }
    const pcm = [...array];
    const outputsample = {
      packageIndex: this.index,
      pcm,
    };
    this.port.postMessage(outputsample);
    this.index += 1;
    return true;
  }
}

registerProcessor("client-processor", ClientProcessor);
