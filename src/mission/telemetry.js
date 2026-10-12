// A tiny telemetry registry, shaped like Open MCT's TelemetryAPI:
// - a channel is the label on the jar: key, name, unit, which provider feeds it and what it means;
// - a provider brings the numbers through two windows: request() for the history and
//   subscribe() for live values (optional);
// - points are { sol, value }: the mission sol is the domain (x axis), the value the range (y axis).
export function createTelemetry() {
  const channels = [];
  const providers = new Map();

  const providerOf = (channel) => {
    const provider = providers.get(channel.provider);
    if (!provider) throw new Error(`No telemetry provider "${channel.provider}" for ${channel.key}`);
    return provider;
  };

  return {
    addProvider: (provider) => providers.set(provider.key, provider),
    addChannel: (channel) => channels.push(channel),
    channels: () => channels,
    providerOf,
    request: (channel) => providerOf(channel).request(channel),
    // Calls fn(point) with each new live value; returns a function that stops it
    subscribe: (channel, fn) => providerOf(channel).subscribe?.(channel, fn) ?? (() => {}),
  };
}
