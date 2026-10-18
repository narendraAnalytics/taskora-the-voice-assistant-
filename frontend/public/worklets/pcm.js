// Forwards raw mic samples (mono, native sample rate) to the main thread.
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice());
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
