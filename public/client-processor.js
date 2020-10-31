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
    const pcm = [...array];
    const outputsample = {
      packageIndex: this.index,
      pcm,
    };
    this.port.postMessage(outputsample);

    return true;
  }
}

registerProcessor("client-processor", ClientProcessor);
