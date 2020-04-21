/* eslint-disable no-console */
/*
minnie-janus - Minimal and modern JavaScript interface for the Janus WebRTC gateway

Copyright 2018 Michael Karl Franzl

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * @module
 */

import BasePluginStamp from './base-plugin-stamp';
import Member from './memeber';

/**
 * @lends EchotestPlugin
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
 * @lends EchotestPlugin.prototype
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
    const localmedia = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    this.logger.info('Got local user media.');

    console.log('Lets Join a room ');
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
 * @constructs EchotestPlugin
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
  // Send ICE events to Janus.
  /* this.rtcconn1.onicecandidate = (event) => {
    //    console.log("onnegotiationneeded1",event);
    if (this.rtcconn1.signalingState !== 'stable') return;
    this.sendTrickle(event.candidate || null);
  };
*/
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

// Extend BasePlugin and export a factory function which directly returns an instance.
/*
import basePlugin from '../src/base-plugin.js';

function factory(...args) {
  const prototype = {
    ...basePlugin.properties,
    ...basePlugin.methods,
    ...methods,
    ...properties,
  };
  const instance = Object.create(prototype);
  basePlugin.init.call(instance, ...args);
  init.call(instance, ...args);

  return instance;
}
export default factory;
*/

// Extend BasePlugin and export a constructor function which returns an instance using the `new`
// keyword.
/*
import basePlugin from '../src/base-plugin.js';

function EchotestPlugin(...args) {
  basePlugin.init.call(this, ...args);
  init.call(this, ...args);
}

Object.assign(EchotestPlugin.prototype, basePlugin.properties);
Object.assign(EchotestPlugin.prototype, basePlugin.methods);
Object.assign(EchotestPlugin.prototype, methods); // your own methods
Object.assign(EchotestPlugin.prototype, properties); // your own properties

export default EchotestPlugin;
*/

// Extend BasePlugin and return a class, which returns an instance using the `new` keyword.
/*
import basePlugin from '../src/base-plugin.js';

function BasePlugin(...args) {
  basePlugin.init.call(this, ...args);
}

Object.assign(BasePlugin.prototype, basePlugin.properties);
Object.assign(BasePlugin.prototype, basePlugin.methods);

class EchotestPlugin extends BasePlugin {
  constructor(...args) {
    super(...args);
    init.call(this, ...args);
  }
}

Object.assign(EchotestPlugin.prototype, properties);
Object.assign(EchotestPlugin.prototype, methods);

export default EchotestPlugin;
*/

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