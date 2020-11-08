import {
  PCMbufferSize,
  MasterDelay,
  masterDelayBufferAmount
} from "./constants.js";

export function createServerProcessorNode(audioContext, clientAmount) {
  return new AudioWorkletNode(audioContext, "server-processor", {
    processorOptions: {
      masterDelayBufferAmount,
      clientAmount
    }
  });
}

export function processAudioFromPCMFactory(PCMbuffer, scriptNodeIndex, status) {
  const processAudioFromPCM = event => {
    const bufferDuration = event.inputBuffer.duration;
    const delayBufferAmount = masterDelayBufferAmount;
    let outputBuffer = event.outputBuffer;
    let outputData = outputBuffer.getChannelData(0);
    const playingIndex = scriptNodeIndex - delayBufferAmount;
    console.log(playingIndex, PCMbuffer);

    if (!scriptNodeIndex) {
      if (status.serverStarted) {
        // init scriptNode
        scriptNodeIndex = 0;
      } else {
        return;
      }
    }
    if (playingIndex >= 0) {
      const bufferToPlay = PCMbuffer[playingIndex];
      // console.log(bufferToPlay);
      if (bufferToPlay) {
        for (var sample = 0; sample < outputBuffer.length; sample++) {
          // make output equal to the same as the input
          outputData[sample] = bufferToPlay.pcm[sample];
        }
      } else {
        for (var sample = 0; sample < outputBuffer.length; sample++) {
          // make output equal to the same as the input
          outputData[sample] = 0;
        }
      }

      PCMbuffer[playingIndex] = null;
    }
    scriptNodeIndex += 1;
  };
  return processAudioFromPCM;
}
