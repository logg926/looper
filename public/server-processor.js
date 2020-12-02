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
    this.PCMbuffer = new Map();
    this.bufferLock = new Map();
    this.volumeControl = new Map();
    this.port.onmessage = (event) => {
      //console.log('receive',event.data);
      // Handling data from the node.
      if (event.data.start) {
        this.status.serverStarted = true;
      } else if (event.data.stop) {
        this.status.serverStarted = false;
        this.scriptNodeIndex = undefined;
        // when restart it will start from 0
        this.PCMbuffer = new Map();
        //clean PCMbuffer
      } else if (event.data.command == "addParticipant") {
        this.volumeControl.set(event.data.participantId, 1);
      } else if (event.data.command == "changeGain") {
        this.volumeControl.set(event.data.participantId, event.data.gain);
        // console.log(event.data);
      } else {
        const PCMPacket = event.data;
        this.pushPCMbuffer(PCMPacket, this.PCMbuffer, this.clientAmount);
      }
    };
  }

  pushPCMbuffer(PCMPacket, PCMbuffer, clientAmount) {
    const gain = this.volumeControl.get(PCMPacket.clientID);
    const avgPCM = PCMPacket.pcm.map((val) => {
      //TODO cuz want to change gain in play time instead of push buffer
      return Math.max(Math.min(val * gain, 1), -1) / clientAmount;
    });

    // console.log(gain, PCMPacket.clientID);
    // PCMbuffer.set(PCMPacket.packageIndex, {
    //   ...PCMPacket,
    //   pcm: avgPCM,
    // });

    if (!this.bufferLock.has(PCMPacket.packageIndex)) {
      this.bufferLock.set(PCMPacket.packageIndex, new Mutex());
    }

    this.bufferLock
      .get(PCMPacket.packageIndex)
      .acquire()
      .then(async (release) => {
        try {
          const existPCMPacket = PCMbuffer.get(PCMPacket.packageIndex);
          if (!existPCMPacket) {
            PCMbuffer.set(PCMPacket.packageIndex, {
              ...PCMPacket,
              pcm: avgPCM,
            });
          } else {
            PCMbuffer.get(PCMPacket.packageIndex).pcm = PCMbuffer.get(
              PCMPacket.packageIndex
            ).pcm.map((num, idx) => {
              return num + avgPCM[idx];
            });
          }
        } catch (error) {
        } finally {
          release();
        }
      });
    return PCMbuffer;
  }
  process(inputs, outputs, parameters) {
    const outputData = outputs[0][0];
    const delayBufferAmount = this.masterDelayBufferAmount;
    const playingIndex = this.scriptNodeIndex - delayBufferAmount;
    if (playingIndex == 0) {
      this.port.postMessage({ indexIsZero: true });
    }
    this.port.postMessage({ playingIndex });
    if (!this.scriptNodeIndex) {
      if (this.status.serverStarted) {
        // init scriptNode
        this.scriptNodeIndex = 0;
      } else {
        return true;
      }
    }

    if (playingIndex >= 0) {
      const bufferToPlay = this.PCMbuffer.get(playingIndex);
      // console.log(bufferToPlay);
      if (bufferToPlay) {
        for (var sample = 0; sample < outputData.length; sample++) {
          // make output equal to the same as the input
          outputData[sample] = bufferToPlay.pcm[sample];
        }
        // console.log(playingIndex,'output', outputData);
        // console.log("serverPlayingIndex", playingIndex);
      } else {
        for (var sample = 0; sample < outputData.length; sample++) {
          // make output equal to the same as the input
          outputData[sample] = 0;
        }
      }

      this.PCMbuffer.delete(playingIndex);
      // console.log("PCMbuffer length", this.PCMbuffer.size);
    }
    //if (this.status.serverStarted === true) console.log('output sound',outputData);

    this.scriptNodeIndex += 1;
    return true;
  }
}

registerProcessor("server-processor", ServerProcessor);
