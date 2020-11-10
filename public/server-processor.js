// white-noise-processor.js

// https://github.com/WebAudio/web-audio-api/issues/1503

// https://developers.google.com/web/updates/2017/12/audio-worklet
import { Mutex } from "./mutex.js";

class ServerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.masterDelayBufferAmount =
      options.processorOptions.masterDelayBufferAmount;
    this.clientAmount = options.processorOptions.clientAmount;
    this.status = {};
    this.PCMbuffer = [];
    this.bufferLock = new Map();
    this.port.onmessage = event => {
      //console.log('receive',event.data);
      // Handling data from the node.
      if (event.data.start) {
        this.status.serverStarted = true;
      } else if (event.data.stop) {
        this.status.serverStarted = false;
        this.scriptNodeIndex = undefined;
        // when restart it will start from 0
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

    if (!this.bufferLock.has(PCMPacket.packageIndex)) {
      this.bufferLock.set(PCMPacket.packageIndex, new Mutex());
    }

    this.bufferLock
      .get(PCMPacket.packageIndex)
      .acquire()
      .then(async release => {
        try {
          const existPCMPacket = PCMbuffer[PCMPacket.packageIndex];
          if (!existPCMPacket) {
            PCMbuffer[PCMPacket.packageIndex] = { ...PCMPacket, pcm: avgPCM };
          } else {
            PCMbuffer[PCMPacket.packageIndex].pcm = PCMbuffer[
              PCMPacket.packageIndex
            ].pcm.map((num, idx) => {
              return num + avgPCM[idx];
            });
          }
        } catch (error) {
        } finally {
          release();
        }
      });

    /*
    if (!PCMbuffer[PCMPacket.packageIndex]) {
      console.log("new index", PCMPacket.packageIndex);
      PCMbuffer[PCMPacket.packageIndex] = [
        ...PCMbuffer[PCMPacket.packageIndex],
        { ...PCMPacket, pcm: avgPCM }
      ];
    } else {
      console.log("existing index", PCMPacket.packageIndex);
      //summing averaged buffer
      PCMbuffer[PCMPacket.packageIndex].pcm = PCMbuffer[
        PCMPacket.packageIndex
      ].pcm.map((num, idx) => {
        return num + avgPCM[idx];
      });
      //sum counter
      PCMbuffer[PCMPacket.packageIndex].counter += PCMPacket.counter;
    }
    */

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
      console.log("PCMbuffer length", this.PCMbuffer.length);
    }
    //  if (this.status.serverStarted === true) console.log('output',outputData);

    this.scriptNodeIndex += 1;
    return true;
  }
}

registerProcessor("server-processor", ServerProcessor);
