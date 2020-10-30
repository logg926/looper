let scriptNodeStartingTime;
let index;
export const processAudioToPCMFactory = (sendPCMToServerFn) => {
  const processAudioToPCM = (event) => {
    var array, i, networkLatency;
    var correspondingSecond, boundarySample, currentPlaybackTime;
    var playbackTimeAdjustment;

    array = event.inputBuffer.getChannelData(0);
    const startSecond = event.playbackTime;
    const bufferSize = event.inputBuffer.length;
    const bufferDuration = event.inputBuffer.duration;
    const endSecond = event.playbackTime + bufferDuration;
    if (!scriptNodeStartingTime) {
      scriptNodeStartingTime = startSecond;
      index = 0;
    }
    const outputsample = {
      //legacy
      correspondingSecond: startSecond - scriptNodeStartingTime,
      //new added index
      packageIndex: index,
      pcm: array,
    };
    sendPCMToServerFn(outputsample);

    index += 1;
  };

  return processAudioToPCM;
};
