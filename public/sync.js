import { PCMbufferSize, MasterDelay } from "./constants.js";

export let PCMbuffer = [];

let scriptEndNodeStartingTime;
export function pushPCMbuffer(item) {
  PCMbuffer.push(item);
  //insertion sort with only last item unsorted
  let pos = PCMbuffer.length - 2;
  while (
    pos >= 0 &&
    PCMbuffer[pos].correspondingSecond > item.correspondingSecond
  ) {
    PCMbuffer[pos + 1] = PCMbuffer[pos];
    pos--;
  }
  PCMbuffer[pos + 1] = item;
  return PCMbuffer;
}

export function processAudioFromPCM(event) {
  const startSecond = event.playbackTime;
  const bufferSize = event.inputBuffer.length;
  const bufferDuration = event.inputBuffer.duration;
  const endSecond = event.playbackTime + bufferDuration;
  startScriptEndNodeStartingTime(startSecond);

  const delay = MasterDelay;
  if (scriptEndNodeStartingTime) {
    const result = popPCMbuffer(
      PCMbuffer,
      startSecond - scriptEndNodeStartingTime - delay,
      endSecond - scriptEndNodeStartingTime - delay
    );

    //Test for PCM Buffer (it works)
    /*
      console.log(
        "now",
        startSecond,
        "from",
        startSecond - scriptEndNodeStartingTime - delay,
        "to",
        endSecond - scriptEndNodeStartingTime - delay
      );
      */
    console.log(
      "PCMbuffer",
      PCMbuffer.map((x) => x.correspondingSecond)
    );
    console.log(
      "PCM",
      result.map((x) => x.correspondingSecond)
    );
    //play
    // The output buffer contains the samples that will be modified and played

    let outputBuffer = event.outputBuffer;
    let outputData = outputBuffer.getChannelData(0);
    if (result.length == 0) {
      for (var sample = 0; sample < outputBuffer.length; sample++) {
        // make output equal to the same as the input
        outputData[sample] = 0;
      }
    }
    /*
    result.map((input) => {
      const inputData = input.pcm;
      //console.log('inputputData',inputData)
      // Loop through the 4096 samples
      for (var sample = 0; sample < outputBuffer.length; sample++) {
        // make output equal to the same as the input
        outputData[sample] = inputData[sample];
      }
    });
    */

    result.forEach((input) => {
      const inputData = input.pcm;
      //console.log('inputputData',inputData)
      // Loop through the 4096 samples
      for (var sample = 0; sample < outputBuffer.length; sample++) {
        // make output equal to the same as the input
        outputData[sample] = inputData[sample];
      }
    });

    console.log("outputData", outputData);
    //console.log(inputData && inputData.sum())
  }
}

function popPCMbuffer(PCMbuffer, time, end) {
  // past  remove from buffer, future keep in buffer
  const returnBufers = [];
  while (PCMbuffer[0] && PCMbuffer[0].correspondingSecond < time) {
    PCMbuffer.shift();
  }
  while (PCMbuffer[0] && PCMbuffer[0].correspondingSecond < end) {
    const temp = PCMbuffer.shift();
    //console.log("temp",temp)
    returnBufers.push(temp);
  }
  // PCMbuffer search for correspondingSecond from time to end

  return returnBufers;
}

function startScriptEndNodeStartingTime(startSecond) {
  if (PCMbuffer.length > 0 && !scriptEndNodeStartingTime) {
    scriptEndNodeStartingTime = startSecond;
  }
}
