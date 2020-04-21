/* eslint-disable no-console */
module.exports = class Memeber {
  constructor(memeberInfo, plugin) {
    this.Info = memeberInfo;
    this.Plugin = plugin;
    this.HandleId = 0;
    this.Video = null;
    this.RTCPeer = null;
    console.log('Memeber constructor Is Done ... memeberInfo:', memeberInfo);
  }

  async AttachMember() {
    // eslint-disable-next-line no-await-in-loop
    const attachResult = await this.Plugin.send({ janus: 'attach', opaque_id: this.Plugin.opaqueId, plugin: 'janus.plugin.videoroom' });
    console.log('attach member Result ', attachResult);
    this.HandleId = attachResult.data.id;

    // eslint-disable-next-line no-await-in-loop
    const joinResult = await this.Plugin.sendMessage({
      request: 'join', room: this.Plugin.room_id, feed: this.Info.id, ptype: 'subscriber', private_id: this.Plugin.private_id,
    }, undefined, { handle_id: this.HandleId });
    console.log('joinResualt', joinResult);
    this.Video = document.createElement('video');
    this.Video.controls = true;
    this.Video.muted = true;
    document.body.appendChild(this.Video);
  }

  async awnserAttachedStream(attachedStreamInfo) {
    const that = this;
    async function RTCPeerOnAddStream(event) {
      console.log('onaddstream Memeber', event);
      const answerSdp = await that.RTCPeer.createAnswer({
        audio: true,
        video: true,
      });
      await that.RTCPeer.setLocalDescription(answerSdp);
      // Send the answer to the remote peer through the signaling server.
      await that.Plugin.sendMessage({ request: 'start', room: that.Plugin.room_id }, answerSdp, { handle_id: that.HandleId });
      that.Video.srcObject = event.stream;
      await that.Video.play();
    }
    // Send ICE events to Janus.
    function RTCPeerOnIceCandidate(event) {
      if (that.RTCPeer.signalingState !== 'stable') return;
      that.Plugin.sendTrickle(event.candidate || null);
    }
    this.RTCPeer = new RTCPeerConnection();
    this.RTCPeer.onaddstream = RTCPeerOnAddStream;
    this.RTCPeer.onicecandidate = RTCPeerOnIceCandidate;
    console.log('attachedStreamInfo', attachedStreamInfo);
    this.RTCPeer.sender = attachedStreamInfo.sender;
    await this.RTCPeer.setRemoteDescription(attachedStreamInfo.jsep);
  }

  hangup() {
    console.log('hangup', this.Info);
    this.RTCPeer.close();
    this.RTCPeer = null;
    this.Video.pause();
    this.Video.removeAttribute('src'); // empty source
    this.Video.load();
    this.Video.disabled = true;
  }
};
