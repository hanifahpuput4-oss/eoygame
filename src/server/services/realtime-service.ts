import { broadcastRoomEvent } from './ws-hub';

export async function publishToRoom(roomId: string, eventName: string, payload: unknown): Promise<void> {
  broadcastRoomEvent(roomId, {
    t: 'evt',
    name: eventName,
    data: payload,
  });

  const key = process.env.ABLY_API_KEY;
  if (!key) return;

  try {
    const { default: Ably } = await import('ably');
    const rest = new Ably.Rest(key);
    const channel = rest.channels.get(`room:${roomId}`);
    await channel.publish(eventName, payload);
  } catch {
    // non-fatal
  }
}
