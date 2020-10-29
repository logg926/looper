let twice = false;
export function logThisOnce(log) {
  if (twice) {
    return;
  } else {
    console.log(log);
    twice = true
  }
}
