/**
 * @module
 */

import BasePluginStamp from './base-plugin-stamp';
import Member from './memeber';

/**
 * @lends VideoRoomPlugin
 */
const properties = {
  /**
   * @override
   */
  name: 'janus.plugin.videoroom',
  memeberList: {},
  vid_local: document.createElement('video'),
  room_id: 1234,
};

/**
 * @lends VideoRoomPlugin.prototype
 */
const methods = {
  /**
   * Start or stop echoing video.
   *
   * @public
   * @param {Boolean} enabled
   * @return {Object} The response from Janus
   */
  async enableVideo(enabled) {
    return this.sendMessage({ video: enabled });
  },

  /**
   * Start or stop echoing audio.
   *
   * @public
   * @param {Boolean} enabled
   * @return {Object} The response from Janus
   */
  async enableAudio(enabled) {
    return this.sendMessage({ audio: enabled });
  },

  /**
   * Send a REMB packet to the browser to set the media submission bandwidth.
   *
   * @public
   * @param {Number} bitrate - Bits per second
   * @return {Object} The response from Janus
   */
  async setBitrate(bitrate) {
    return this.sendMessage({ bitrate });
  },

  /**
   * Receive an asynchronous ('pushed') message sent by the Janus core.
   *
   * @public
   * @override
   */
  receive(msg) {
    const that = this;
    console.log('on receive', msg);
    if (msg.plugindata && msg.plugindata.data.error_code) {
      console.error('plugindata.data error :', msg.plugindata.data);
    } else if (msg.plugindata && msg.plugindata.data.videoroom === 'attached') {
      if (this.memeberList[msg.plugindata.data.id]) {
        this.memeberList[msg.plugindata.data.id].awnserAttachedStream(msg);
      } else {
        this.awnserAttachedStream(msg);
      }
    } else if (msg.janus === 'hangup') {
      const hangupMember = (Object.values(this.memeberList).filter(
        (member) => member.HandleId === msg.sender,
      ))[0];
      hangupMember.hangup();
    } else if (msg.plugindata && msg.plugindata.data.publishers) {
      // let private_id=msg.plugindata.data.private_id
      msg.plugindata.data.publishers.forEach((publisher) => {
        console.log('plugindata.data.publishers', publisher);

        if (!this.memeberList[publisher.id] && !this.myFeedList.includes(publisher.id)) {
          this.memeberList[publisher.id] = new Member(publisher, this);
          this.memeberList[publisher.id].AttachMember();
        }
      });
      //
      that.publishers = msg.plugindata.data.publishers;
      that.private_id = msg.plugindata.data.private_id;
      //   that.attachedStream();
      //  console.log('attach Resualt',attachResualt);
    }
    this.logger.info('Received message from Janus', msg);
  },
  /**
   * Set up a bi-directional WebRTC connection:
   *
   * 1. get local media
   * 2. create and send a SDP offer
   * 3. receive a SDP answer and add it to the RTCPeerConnection
   * 4. negotiate ICE (can happen concurrently with the SDP exchange)
   * 5. Play the video via the `onaddstream` event of RTCPeerConnection
   *
   * @private
   * @override
   */
  async onAttached() {
    console.log('onAttached !!!!!!!!!!!!!!!!!!!!!!');
    this.logger.info('Asking user to share media. Please wait...');
    let localmedia;
    try {
      localmedia = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      this.logger.info('Got local user media.');

      console.log('Lets Join a room localmedia:', localmedia);
    } catch (e) {
      try {
        console.log('Can get Video Lets try audio only ...');
        localmedia = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch (ex) {
        console.log('Can get audio as well Lets try no input ...', ex);
        localmedia = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: false,
        });
      }
    }
    const joinResualt = await this.sendMessage({
      request: 'join', room: this.room_id, ptype: 'publisher', display: '33333', opaque_id: this.opaqueId,
    });

    console.log('Playing local user media in video element.', joinResualt);
    /*      let attachResualt = await this.send({janus: "attach"})

          console.log('attach Resualt',attachResualt); */
    this.logger.info('Playing local user media in video element.');
    this.vid_local.srcObject = localmedia;
    this.vid_local.play();

    this.logger.info('Adding local user media to RTCPeerConnection.');
    this.rtcconn.addStream(localmedia);

    this.logger.info('Creating SDP offer. Please wait...');
    const jsepOffer = await this.rtcconn.createOffer({
      audio: true,
      video: true,
    });


    this.logger.info('SDP offer created.');

    this.logger.info('Setting SDP offer on RTCPeerConnection');
    await this.rtcconn.setLocalDescription(jsepOffer);

    this.logger.info('Getting SDP answer from Janus to our SDP offer. Please wait...');
    /*    const { jsep: jsep } = await this.sendJsep(jsepOffer);

        this.logger.debug('Received SDP answer from Janus.');

    */
    //
    // await this.send({janus: "attach",opaque_id: this.opaqueId,plugin: "janus.plugin.videoroom"})
    const confResult = await this.sendMessage({ request: 'configure', audio: true, video: true }, jsepOffer);
    console.log('Received SDP answer from Janus.', confResult);
    this.logger.debug('Setting the SDP answer on RTCPeerConnection. The `onaddstream` event will fire soon.');
    await this.rtcconn.setRemoteDescription(confResult.jsep);
  },
  async awnserAttachedStream(attachedStreamInfo) {
    console.log('attachedStreamInfo for non memeber WTF ???', attachedStreamInfo);
  },
};

/**
 * @constructs VideoRoomPlugin
 * @mixes BasePlugin
 */
function init() {
  // eslint-disable-next-line no-use-before-define
  this.opaqueId = `videoroomtest-${randomString(12)}`;
  console.log('Init plugin', this);
  // this.vid_remote.width = 320;
  this.vid_local.width = 320;

  this.rtcconn = new RTCPeerConnection();
  // Send ICE events to Janus.
  this.rtcconn.onicecandidate = (event) => {
    //   console.log("onnegotiationneeded",event);
    if (this.rtcconn.signalingState !== 'stable') return;
    this.sendTrickle(event.candidate || null);
  };

  this.vid_local.controls = true;
  this.vid_local.muted = true;
  document.body.appendChild(this.vid_local);

  /*
  this.vid1_remote.controls = true;
  this.vid1_remote.muted = true;
  document.body.appendChild(this.vid1_remote);
*/

  console.log('Finish init ', this);
}


// Extend BasePlugin and return a "Stamp", which directly returns an instance.
const factory = BasePluginStamp.compose({
  methods,
  properties,
  initializers: [init],
});

export default factory;

function randomString(len) {
  const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomStr = '';
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < len; i++) {
    const randomPoz = Math.floor(Math.random() * charSet.length);
    randomStr += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomStr;
}
