// eg
// const nodeStatus = {};
// scriptProcessor.onaudioprocess = processAudioToPCMFactory(
//       sendPCMToServerFactory(dataConnection),
//       nodeStatus
//     );

export const processAudioToPCMFactory = (sendPCMToServerFn, nodeStatus) => {
  const processAudioToPCM = (event) => {
    const array = event.inputBuffer.getChannelData(0);
    const startSecond = event.playbackTime;
    const bufferSize = event.inputBuffer.length;
    const bufferDuration = event.inputBuffer.duration;
    const endSecond = event.playbackTime + bufferDuration;
    if (!nodeStatus.scriptNodeStartingTime) {
      nodeStatus.scriptNodeStartingTime = startSecond;
      nodeStatus.index = 0;
    }
    const pcm = [...array];
    const outputsample = {
      //legacy
      correspondingSecond: startSecond - nodeStatus.scriptNodeStartingTime,
      //new added index
      packageIndex: nodeStatus.index,
      pcm,
    };

    // try to make it async
    (async (outputsample) => {
      // Code that runs in your function
      sendPCMToServerFn(outputsample);
    })(outputsample);

    nodeStatus.index += 1;
  };

  return processAudioToPCM;
};
