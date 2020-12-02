// white-noise-processor.js

// https://github.com/WebAudio/web-audio-api/issues/1503

// https://developers.google.com/web/updates/2017/12/audio-worklet

import { compressPCM } from "./audioCompressor.js";
class ClientProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.status = {};
    this.port.onmessage = event => {
      //console.log('receive',event.data);
      // Handling data from the node.
      if (event.data.start) {
        this.status.serverStarted = true;
      } else if (event.data.stop) {
        this.status.serverStarted = false;
        this.index = undefined;
        // when restart it will start from 0
      }
    };
    if (options && options.processorOptions) {
      this.userDelayInBufferUnit =
        options.processorOptions.userDelayInBufferUnit;
    } else {
      this.userDelayInBufferUnit = 0;
    }
  }
  process(inputs, outputs, parameters) {
    const array = inputs[0][0];

    if (!this.index) {
      if (this.status.serverStarted) {
        // init scriptNode
        this.index = 0;
      } else {
        return true;
      }
    }
    if (!array) {
      return true;
    }
    const pcm = [...array];
    const packageIndex = this.index - this.userDelayInBufferUnit;
    if (packageIndex >= 0) {
      const outputsample = {
        packageIndex,
        pcm: compressPCM(pcm),
        count: 1
      };
      this.port.postMessage(outputsample);
    }

    this.index += 1;
    return true;
  }
}

registerProcessor("client-processor", ClientProcessor);
