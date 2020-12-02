import { masterDelayBufferAmount } from "./constants.js";

import { decompressPCM } from "./audioCompressor.js";
import {
  indexToMs,
  urlToArrayBuffer,
  arrayBufferDecode,
} from "./helperFunctions.js";

function recording(
  audioContext,
  scriptProcessorEnd,
  publishBlob,
  changeAudioTrack
) {
  var chunks = [];
  const mediaRecorderNode = audioContext.createMediaStreamDestination();
  scriptProcessorEnd.connect(mediaRecorderNode);
  const mediaRecorder = new MediaRecorder(mediaRecorderNode.stream);
  mediaRecorder.ondataavailable = function (evt) {
    // push each chunk (blobs) in an array
    chunks.push(evt.data);
  };
  mediaRecorder.onstop = async function (evt) {
    const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
    const arrayBuffer = await blob.arrayBuffer();
    changeAudioTrack(arrayBuffer);
    publishBlob(blob);
    chunks = [];
  };

  return { mediaRecorder, mediaRecorderNode };
}

export async function startServerNode(
  defaultSampleRate,
  clientAmount,
  updateUITime,
  publishBlob,
  link
) {
  const audioContext = new AudioContext({ sampleRate: defaultSampleRate });
  await audioContext.audioWorklet.addModule("server-processor.js");
  const scriptProcessorEnd = createServerProcessorNode(
    audioContext,
    clientAmount
  );
  scriptProcessorEnd.connect(audioContext.destination);

  let backgroundPlayNode;

  let songBuffer;
  async function changeAudioTrack(arrayBuffer) {
    // mutex lock
    songBuffer = await arrayBufferDecode(arrayBuffer, audioContext);
  }
  const arrayBuffer = await urlToArrayBuffer(link);
  await changeAudioTrack(arrayBuffer);

  const { mediaRecorder, mediaRecorderNode } = recording(
    audioContext,
    scriptProcessorEnd,
    publishBlob,
    changeAudioTrack
  );

  // playNode.loop = loop;

  let startTime = 0;
  const mediaRecorderState = { started: false };
  function onStartSound(startTime) {
    mediaRecorderState.started = true;
    backgroundPlayNode.start(audioContext.currentTime, startTime); //in second
    mediaRecorder.start();
  }

  function onStart(inputStartTime) {
    startTime = inputStartTime;
    // mutex lock
    backgroundPlayNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer,
    });
    backgroundPlayNode.connect(mediaRecorderNode);
    backgroundPlayNode.connect(audioContext.destination);
    scriptProcessorEnd.port.postMessage({ start: true });
  }
  function onStop() {
    if (mediaRecorderState.started) {
      mediaRecorder.stop();
      mediaRecorderState.started = false;
      backgroundPlayNode.stop();
    }
    backgroundPlayNode.disconnect();
    scriptProcessorEnd.port.postMessage({ stop: true });
  }

  scriptProcessorEnd.port.onmessage = (e) => {
    const index = e.data.playingIndex;
    if (index) {
      const time = indexToMs(index, defaultSampleRate);
      updateUITime(time);
    }

    if (e.data.indexIsZero) {
      onStartSound(startTime);
    }
  };

  return { scriptProcessorEnd, onStart, onStop };
}

export function createServerProcessorNode(audioContext, clientAmount) {
  return new AudioWorkletNode(audioContext, "server-processor", {
    processorOptions: {
      masterDelayBufferAmount,
      clientAmount,
    },
  });
}
export function changeGain(participantId, scriptProcessorEnd, gain) {
  scriptProcessorEnd.port.postMessage({
    command: "changeGain",
    participantId,
    gain,
  });
}
export function addParticipant(theirID, scriptProcessorEnd) {
  scriptProcessorEnd.port.postMessage({
    command: "addParticipant",
    participantId: theirID,
  });
}

export function passPCMPacketToServerProcessor(
  data,
  scriptProcessorEnd,
  clientID
) {
  data.PCMPacket.forEach((PCMPacket) => {
    const buffer = PCMPacket.pcm;

    const pcm = decompressPCM(buffer);

    gotRemotePCMPacket({ ...PCMPacket, pcm, clientID }, scriptProcessorEnd);
  });
}
function gotRemotePCMPacket(PCMPacket, scriptProcessorEnd) {
  scriptProcessorEnd.port.postMessage(PCMPacket);
}

export function processAudioFromPCMFactory(PCMbuffer, scriptNodeIndex, status) {
  const processAudioFromPCM = (event) => {
    const bufferDuration = event.inputBuffer.duration;
    const delayBufferAmount = masterDelayBufferAmount;
    let outputBuffer = event.outputBuffer;
    let outputData = outputBuffer.getChannelData(0);
    const playingIndex = scriptNodeIndex - delayBufferAmount;
    // console.log(playingIndex, PCMbuffer);

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
