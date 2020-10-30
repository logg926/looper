import { PCMbufferSize, MasterDelay } from "./constants.js";

export let PCMbuffer = [];

let scriptEndNodeStartingTime;
export function pushPCMbuffer(PCMPacket) {
  PCMbuffer[PCMPacket.index] = PCMPacket;
  PCMbuffer.push(PCMPacket);
  return PCMbuffer;
}

let scriptNodeIndex;
export function processAudioFromPCM(event) {
  const startSecond = event.playbackTime;
  const bufferSize = event.inputBuffer.length;
  const bufferDuration = event.inputBuffer.duration;
  const endSecond = event.playbackTime + bufferDuration;
  const delayBufferAmount = 10;
  if (!scriptNodeIndex) {
    if (PCMbuffer.length > 0) {
      scriptNodeIndex = 0;
    } else {
      return;
    }
  }
  const playingIndex = scriptNodeIndex - delayBufferAmount;
  if (playingIndex >= 0) {
    const bufferToPlay = PCMbuffer[playingIndex];
    if (bufferToPlay) {
      let outputBuffer = event.outputBuffer;
      let outputData = outputBuffer.getChannelData(0);
      outputData = [...bufferToPlay.pcm];
    }
  }
  scriptNodeIndex += 1;
}
