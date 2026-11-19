export async function publishToRoom(roomId: string, eventName: string, payload: unknown): Promise<void> {
  const key = process.env.ABLY_API_KEY;
  if (!key) return;

  const { default: Ably } = await import('ably');
  const rest = new Ably.Rest(key);
  const channel = rest.channels.get(`room:${roomId}`);
  await channel.publish(eventName, payload);
}
