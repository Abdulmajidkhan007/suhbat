// Ilova bo'yicha bitta qo'ng'iroq menejeri (`@suhbat/client`), brauzer WebRTC bilan.
import { createCallManager } from '@suhbat/client';
import { api, socket } from './api';
import { browserMediaDevices, createBrowserPeer } from './webrtc';

export const callManager = createCallManager<MediaStream>({
  events:        socket,
  signaling:     socket,
  media:         browserMediaDevices(),
  createPeer:    (iceServers, events) => createBrowserPeer(iceServers, events),
  getIceServers: async () => (await api.getIceServers()).iceServers,
});
