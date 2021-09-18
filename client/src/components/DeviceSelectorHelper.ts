export const Device = (): { value: string; label: string } => {
  const value = "default";
  const label = "";
  return { value, label };
};

const defaultOnError = (e: MediaStreamError): void => {
  console.warn(e);
  return;
};

// return a list of available input audio devices
export const listInputDevices = (
  onError: (MediaStreamError) => void = defaultOnError
): Promise<{ value: string; label: string }[]> => {
  const inputs: { value: string; label: string }[] = [];
  if (navigator.mediaDevices) {
    return navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        devices.map((device) => {
          if (device.kind === "audioinput") {
            const input = Device();
            input.value = device.deviceId;
            input.label = device.label;
            inputs.push(input);
            return null;
          }
        });
        return inputs;
      })
      .catch((e) => {
        onError(e);
        return [Device()];
      });
  }
  return new Promise(() => {
    return [Device()];
  });
};

// select a device as the input device
export const selectInputDevice = (
  id: string,
  useStream: (MediaStream) => void,
  onError: (MediaStreamError) => void = defaultOnError
): void => {
  if (navigator.mediaDevices) {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: id,
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: false,
      })
      .then((stream) => {
        useStream(stream);
      })
      .catch((e) => {
        onError(e);
      });
  }
};
