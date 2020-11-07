// white-noise-processor.js

// https://github.com/WebAudio/web-audio-api/issues/1503

// https://developers.google.com/web/updates/2017/12/audio-worklet

class ServerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.masterDelayBufferAmount =
      options.processorOptions.masterDelayBufferAmount;
    this.clientAmount = options.processorOptions.clientAmount;
    this.status = {};
    this.PCMbuffer = [];
    this.port.onmessage = event => {
      //console.log('receive',event.data);
      // Handling data from the node.
      if (event.data.start) {
        this.status.serverStarted = true;
      } else {
        const PCMPacket = event.data;
        this.pushPCMbuffer(PCMPacket, this.PCMbuffer, this.clientAmount);
      }
      //   console.log(event.data);
    };
  }

  pushPCMbuffer(PCMPacket, PCMbuffer, clientAmount) {
    const avgPCM = PCMPacket.pcm.map(val => {
      return val / clientAmount;
    });
    if (!PCMbuffer[PCMPacket.packageIndex]) {
      PCMbuffer[PCMPacket.packageIndex] = { ...PCMPacket, pcm: avgPCM };
    } else {
      //summing averaged buffer
      PCMbuffer[PCMPacket.packageIndex].pcm = PCMbuffer[
        PCMPacket.packageIndex
      ].pcm.map((num, idx) => {
        return num + avgPCM[idx];
      });
    }

    return PCMbuffer;
  }
  process(inputs, outputs, parameters) {
    const outputData = outputs[0][0];
    const delayBufferAmount = this.masterDelayBufferAmount;
    const playingIndex = this.scriptNodeIndex - delayBufferAmount;

    if (!this.scriptNodeIndex) {
      if (this.status.serverStarted) {
        // init scriptNode
        this.scriptNodeIndex = 0;
      } else {
        return true;
      }
    }
    if (playingIndex >= 0) {
      const bufferToPlay = this.PCMbuffer[playingIndex];
      // console.log(bufferToPlay);
      if (bufferToPlay) {
        for (var sample = 0; sample < outputData.length; sample++) {
          // make output equal to the same as the input
          outputData[sample] = bufferToPlay.pcm[sample];
        }
        console.log(playingIndex, bufferToPlay);
      } else {
        for (var sample = 0; sample < outputData.length; sample++) {
          // make output equal to the same as the input
          outputData[sample] = 0;
        }
      }

      this.PCMbuffer[playingIndex] = undefined;
    }
    //  if (this.status.serverStarted === true) console.log('output',outputData);

    this.scriptNodeIndex += 1;
    return true;
  }
}

registerProcessor("server-processor", ServerProcessor);
