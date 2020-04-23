/**
 * @module
 */

import BasePluginStamp from './base-plugin-stamp';

/**
 * @lends ScreenSharePlugin
 */
const properties = {
  /**
   * @override
   */
  name: 'janus.plugin.videoroom',
  memeberList: {},
  vid_local_screen: document.createElement('video'),
  room_id: 1234,
};

/**
 * @lends ScreenSharePlugin.prototype
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
    // const that = this;
    console.log('on receive ScreenSharePlugin', msg);
    if (msg.plugindata && msg.plugindata.data.error_code) {
      console.error('plugindata.data ScreenSharePlugin error :', msg.plugindata.data);
    } else if (msg.plugindata && msg.plugindata.data.videoroom === 'joined') {
      console.log('Self Joiend event ', msg.plugindata.data.id);
      console.log('VideoRoomPlugin ', this.VideoRoomPlugin);
      this.VideoRoomPlugin.myFeedList.push(msg.plugindata.data.id);
    } /* else {
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

        if (!this.memeberList[publisher.id]) {
          this.memeberList[publisher.id] = new Member(publisher, this);
          this.memeberList[publisher.id].AttachMember();
        }
      });
      //
      that.publishers = msg.plugindata.data.publishers;
      that.private_id = msg.plugindata.data.private_id;
      //   that.attachedStream();
      //  console.log('attach Resualt',attachResualt);
    } */
    this.logger.info('Received  message from Janus ScreenSharePlugin', msg);
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
    console.log('onAttached ScreenSharePlugin !!!!!!!!!!!!!!!!!!!!!!');
    this.logger.info('Asking user to share media. Please wait...');

    let localmedia;

    try {
      localmedia = await navigator.mediaDevices.getDisplayMedia();
      this.logger.info('Got local user Screen .');

      console.log('Got local user Screen  localmedia:', localmedia);
    } catch (e) {
      console.error('No screen share on this browser ...');
      return;
    }

    const joinResualt = await this.sendMessage({
      request: 'join', room: this.room_id, ptype: 'publisher', display: 'Screen Share', opaque_id: this.opaqueId,
    });

    console.log('Playing local user media in video element.', joinResualt);
    this.logger.info('Playing local user media in video element.');
    this.vid_local_screen.srcObject = localmedia;
    this.vid_local_screen.play();
    this.logger.info('Adding local user media to RTCPeerConnection.');
    this.rtcconn.addStream(localmedia);
    this.logger.info('Creating SDP offer. Please wait...');
    const jsepOffer = await this.rtcconn.createOffer({
      audio: false,
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
    const confResult = await this.sendMessage({ request: 'configure', audio: false, video: true }, jsepOffer);
    console.log('Received SDP answer from Janus for ScreenShare.', confResult);
    this.logger.debug('Setting the SDP answer on RTCPeerConnection. The `onaddstream` event will fire soon.');
    await this.rtcconn.setRemoteDescription(confResult.jsep);
  },
};

/**
 * @constructs ScreenSharePlugin
 * @mixes BasePlugin
 */
function init() {
  // eslint-disable-next-line no-use-before-define
  this.opaqueId = `videoroomtest-${randomString(12)}`;
  console.log('Init plugin', this);
  // this.vid_remote.width = 320;
  this.vid_local_screen.width = 320;

  this.rtcconn = new RTCPeerConnection();
  // Send ICE events to Janus.
  this.rtcconn.onicecandidate = (event) => {
    //   console.log("onnegotiationneeded",event);
    if (this.rtcconn.signalingState !== 'stable') return;
    this.sendTrickle(event.candidate || null);
  };

  this.vid_local_screen.controls = true;
  this.vid_local_screen.muted = true;
  document.body.appendChild(this.vid_local_screen);

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
